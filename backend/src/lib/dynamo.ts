import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { config } from "../config";
import { Document, Claim, Answer } from "../types/document";

const rawClient = new DynamoDBClient({ region: config.aws.region });
export const dynamo = DynamoDBDocumentClient.from(rawClient);

// ─── Document repository ──────────────────────────────────────────────────────

/** Persist a new document record. */
export async function putDocument(doc: Document): Promise<void> {
  await dynamo.send(
    new PutCommand({
      TableName: config.dynamodb.documentsTable,
      Item: doc,
    })
  );
}

/** Fetch a single document by ID. Returns null if not found. */
export async function getDocument(id: string): Promise<Document | null> {
  const result = await dynamo.send(
    new GetCommand({
      TableName: config.dynamodb.documentsTable,
      Key: { id },
    })
  );
  return (result.Item as Document) ?? null;
}

/** List all documents (full scan — acceptable at hackathon scale). */
export async function listDocuments(): Promise<Document[]> {
  const result = await dynamo.send(
    new ScanCommand({
      TableName: config.dynamodb.documentsTable,
    })
  );
  return (result.Items as Document[]) ?? [];
}

/** Find a document by exact DOI match (full scan — acceptable at hackathon scale). */
export async function findDocumentByDoi(doi: string): Promise<Document | null> {
  const result = await dynamo.send(
    new ScanCommand({
      TableName: config.dynamodb.documentsTable,
      FilterExpression: "doi = :doi",
      ExpressionAttributeValues: { ":doi": doi },
    })
  );
  return (result.Items && result.Items.length > 0) ? (result.Items[0] as Document) : null;
}

/**
 * Partially update a document record.
 * Always stamps updatedAt automatically.
 */
export async function updateDocument(
  id: string,
  updates: Partial<Omit<Document, "id">>
): Promise<void> {
  const merged = { ...updates, updatedAt: new Date().toISOString() };
  const entries = Object.entries(merged);

  const UpdateExpression =
    "SET " + entries.map((_, i) => `#k${i} = :v${i}`).join(", ");
  const ExpressionAttributeNames = Object.fromEntries(
    entries.map(([k], i) => [`#k${i}`, k])
  );
  const ExpressionAttributeValues = Object.fromEntries(
    entries.map(([, v], i) => [`:v${i}`, v])
  );

  await dynamo.send(
    new UpdateCommand({
      TableName: config.dynamodb.documentsTable,
      Key: { id },
      UpdateExpression,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
    })
  );
}

// ─── Claim repository ─────────────────────────────────────────────────────────

/** Persist a single claim record. */
export async function putClaim(claim: Claim): Promise<void> {
  await dynamo.send(
    new PutCommand({
      TableName: config.dynamodb.claimsTable,
      Item: claim,
    })
  );
}

/** Persist multiple claims in parallel. All-or-nothing at the caller level
 *  (caller should not persist partial results on error). */
export async function putClaims(claims: Claim[]): Promise<void> {
  await Promise.all(claims.map((c) => putClaim(c)));
}

/** Fetch a single claim by ID. Returns null if not found. */
export async function getClaim(id: string): Promise<Claim | null> {
  const result = await dynamo.send(
    new GetCommand({
      TableName: config.dynamodb.claimsTable,
      Key: { id },
    })
  );
  return (result.Item as Claim) ?? null;
}

/**
 * List all claims for a given document (full scan, filtered server-side).
 * Acceptable at hackathon scale; would need a GSI on documentId at production.
 */
export async function listClaimsByDocument(documentId: string): Promise<Claim[]> {
  const result = await dynamo.send(
    new ScanCommand({
      TableName: config.dynamodb.claimsTable,
      FilterExpression: "documentId = :docId",
      ExpressionAttributeValues: { ":docId": documentId },
    })
  );
  return (result.Items as Claim[]) ?? [];
}

/** List ALL claims across all documents (used by chat and graph). */
export async function listAllClaims(): Promise<Claim[]> {
  const result = await dynamo.send(
    new ScanCommand({
      TableName: config.dynamodb.claimsTable,
    })
  );
  return (result.Items as Claim[]) ?? [];
}

/**
 * Update a claim's status (used during impact propagation).
 * Only updates status + updatedAt — text and provenance are immutable.
 */
export async function updateClaimStatus(
  id: string,
  status: Claim["status"]
): Promise<void> {
  await dynamo.send(
    new UpdateCommand({
      TableName: config.dynamodb.claimsTable,
      Key: { id },
      UpdateExpression: "SET #s = :s, updatedAt = :u",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":s": status,
        ":u": new Date().toISOString(),
      },
    })
  );
}

// ─── Answer repository ────────────────────────────────────────────────────────

/** Persist a new answer record. */
export async function putAnswer(answer: Answer): Promise<void> {
  await dynamo.send(
    new PutCommand({
      TableName: config.dynamodb.answersTable,
      Item: answer,
    })
  );
}

/** Fetch a single answer by ID. Returns null if not found. */
export async function getAnswer(id: string): Promise<Answer | null> {
  const result = await dynamo.send(
    new GetCommand({
      TableName: config.dynamodb.answersTable,
      Key: { id },
    })
  );
  return (result.Item as Answer) ?? null;
}

/** List all answers (used by GET /answers and impact traversal). */
export async function listAllAnswers(): Promise<Answer[]> {
  const result = await dynamo.send(
    new ScanCommand({
      TableName: config.dynamodb.answersTable,
    })
  );
  return (result.Items as Answer[]) ?? [];
}

/**
 * Update an answer's status (used when evidence becomes unusable).
 * Preserves all provenance fields — only stamps status + updatedAt.
 */
export async function updateAnswerStatus(
  id: string,
  status: Answer["status"],
  supersededByAnswerId?: string
): Promise<void> {
  const extra = supersededByAnswerId
    ? ", supersededByAnswerId = :sup"
    : "";
  const values: Record<string, string> = {
    ":s": status,
    ":u": new Date().toISOString(),
  };
  if (supersededByAnswerId) values[":sup"] = supersededByAnswerId;

  await dynamo.send(
    new UpdateCommand({
      TableName: config.dynamodb.answersTable,
      Key: { id },
      UpdateExpression: `SET #s = :s, updatedAt = :u${extra}`,
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: values,
    })
  );
}
