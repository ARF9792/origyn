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
export async function getDocument(id: string, ownerId: string): Promise<Document | null> {
  const result = await dynamo.send(
    new GetCommand({
      TableName: config.dynamodb.documentsTable,
      Key: { id },
    })
  );
  const doc = (result.Item as Document) ?? null;
  if (!doc) return null;
  if (doc.ownerId !== ownerId) return null;
  return doc;
}

/** List all documents for the owner. */
export async function listDocuments(ownerId: string): Promise<Document[]> {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: config.dynamodb.documentsTable,
      IndexName: "ownerId-index",
      KeyConditionExpression: "ownerId = :ownerId",
      ExpressionAttributeValues: { ":ownerId": ownerId },
    })
  );
  return (result.Items as Document[]) ?? [];
}

/** Find a document by exact DOI match for the owner. */
export async function findDocumentByDoi(doi: string, ownerId: string): Promise<Document | null> {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: config.dynamodb.documentsTable,
      IndexName: "ownerId-index",
      KeyConditionExpression: "ownerId = :ownerId",
      FilterExpression: "doi = :doi",
      ExpressionAttributeValues: { ":ownerId": ownerId, ":doi": doi },
    })
  );
  const item = (result.Items && result.Items.length > 0) ? (result.Items[0] as Document) : null;
  return item;
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
export async function getClaim(id: string, ownerId: string): Promise<Claim | null> {
  const result = await dynamo.send(
    new GetCommand({
      TableName: config.dynamodb.claimsTable,
      Key: { id },
    })
  );
  const claim = (result.Item as Claim) ?? null;
  if (!claim) return null;
  if (claim.ownerId !== ownerId) return null;
  return claim;
}

/**
 * List all claims for a given document for the owner.
 */
export async function listClaimsByDocument(documentId: string, ownerId: string): Promise<Claim[]> {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: config.dynamodb.claimsTable,
      IndexName: "ownerId-index",
      KeyConditionExpression: "ownerId = :ownerId",
      FilterExpression: "documentId = :docId",
      ExpressionAttributeValues: { ":ownerId": ownerId, ":docId": documentId },
    })
  );
  return (result.Items as Claim[]) ?? [];
}

/** List ALL claims for the owner (used by chat and graph). */
export async function listAllClaims(ownerId: string): Promise<Claim[]> {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: config.dynamodb.claimsTable,
      IndexName: "ownerId-index",
      KeyConditionExpression: "ownerId = :ownerId",
      ExpressionAttributeValues: { ":ownerId": ownerId },
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
export async function getAnswer(id: string, ownerId: string): Promise<Answer | null> {
  const result = await dynamo.send(
    new GetCommand({
      TableName: config.dynamodb.answersTable,
      Key: { id },
    })
  );
  const answer = (result.Item as Answer) ?? null;
  if (!answer) return null;
  if (answer.ownerId !== ownerId) return null;
  return answer;
}

/** List all answers for the owner (used by GET /answers and impact traversal). */
export async function listAllAnswers(ownerId: string): Promise<Answer[]> {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: config.dynamodb.answersTable,
      IndexName: "ownerId-index",
      KeyConditionExpression: "ownerId = :ownerId",
      ExpressionAttributeValues: { ":ownerId": ownerId },
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
