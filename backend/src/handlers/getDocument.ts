import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getDocument } from "../lib/dynamo";

function errorResponse(
  statusCode: number,
  code: string,
  message: string
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ error: { code, message } }),
  };
}

/**
 * GET /documents/:id
 *
 * Returns one source and its full status information.
 * Includes `claims: []` on Day 1 (Bedrock extraction is optional/later).
 * Response shape matches 04_DAY1_API_CONTRACT.md exactly.
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const id = event.pathParameters?.id;

  if (!id) {
    return errorResponse(400, "DOCUMENT_NOT_FOUND", "Document ID is required.");
  }

  let document;
  try {
    document = await getDocument(id);
  } catch (err) {
    console.error(`DynamoDB getDocument error for id ${id}:`, err);
    return errorResponse(502, "INTERNAL_ERROR", "Failed to retrieve document.");
  }

  if (!document) {
    return errorResponse(404, "DOCUMENT_NOT_FOUND", `Document with id '${id}' was not found.`);
  }

  // Ensure claims is always an array (defensive, in case of legacy records)
  const response = {
    ...document,
    claims: document.claims ?? [],
  };

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(response),
  };
};
