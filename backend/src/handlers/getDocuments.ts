import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { listDocuments } from "../lib/dynamo";
import { DocumentSummary } from "../types/document";
import { getWorkspaceId } from "../lib/workspace";

/**
 * GET /documents
 *
 * Returns the workspace source list.
 * Response shape matches 04_DAY1_API_CONTRACT.md exactly.
 *
 * List items use DocumentSummary (no retractionNotice, claims, timestamps)
 * to keep the payload compact for the source health dashboard.
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const workspaceId = getWorkspaceId(event);
  let documents;
  try {
    documents = await listDocuments(workspaceId);
  } catch (err) {
    console.error("DynamoDB listDocuments error:", err);
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to retrieve documents.",
        },
      }),
    };
  }

  const items: DocumentSummary[] = documents
    .filter((doc) => doc.status !== "DELETED")
    .map((doc) => ({
      id: doc.id,
      filename: doc.filename,
      title: doc.title,
      doi: doc.doi,
      status: doc.status,
      retractionStatus: doc.retractionStatus,
    }));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ items }),
  };
};
