import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { config } from "../config";
import { Document } from "../types/document";

const rawClient = new DynamoDBClient({ region: config.aws.region });
export const dynamo = DynamoDBDocumentClient.from(rawClient);

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

/** List all documents (full scan — acceptable for Day 1 scale). */
export async function listDocuments(): Promise<Document[]> {
  const result = await dynamo.send(
    new ScanCommand({
      TableName: config.dynamodb.documentsTable,
    })
  );
  return (result.Items as Document[]) ?? [];
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
