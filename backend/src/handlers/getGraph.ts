import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { listDocuments } from "../lib/dynamo";
import { GraphResponse } from "../types/document";

/**
 * GET /graph
 *
 * Day 1 minimal — builds a graph of document nodes from the documents table.
 * Edges are empty on Day 1 (Document → Claim → Answer graph comes on Day 2).
 *
 * Response shape matches 04_DAY1_API_CONTRACT.md exactly.
 */
export const handler = async (
  _event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  let documents;
  try {
    documents = await listDocuments();
  } catch (err) {
    console.error("DynamoDB listDocuments error (graph):", err);
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        error: { code: "INTERNAL_ERROR", message: "Failed to build graph." },
      }),
    };
  }

  const graph: GraphResponse = {
    nodes: documents.map((doc) => ({
      id: doc.id,
      type: "DOCUMENT",
      label: doc.title ?? doc.filename,
      status: doc.status,
    })),
    edges: [],
  };

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(graph),
  };
};
