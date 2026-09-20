import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getDocument, listClaimsByDocument } from "../lib/dynamo";
import { Claim } from "../types/document";
import { getWorkspaceId } from "../lib/workspace";

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
 * Day 2: `claims` is populated from the origyn-claims table (persisted by
 * the extract endpoint) rather than from the embedded document record array.
 *
 * Response shape matches 04_DAY1_API_CONTRACT.md + 06_DAY2_API_CONTRACT_ADDENDUM.md.
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const id = event.pathParameters?.id;
  const workspaceId = getWorkspaceId(event);

  if (!id) {
    return errorResponse(400, "DOCUMENT_NOT_FOUND", "Document ID is required.");
  }

  let document;
  try {
    document = await getDocument(id, workspaceId);
  } catch (err) {
    console.error(`DynamoDB getDocument error for id ${id}:`, err);
    return errorResponse(502, "INTERNAL_ERROR", "Failed to retrieve document.");
  }

  if (!document) {
    return errorResponse(404, "DOCUMENT_NOT_FOUND", `Document with id '${id}' was not found.`);
  }

  // Day 2: fetch persisted claims from origyn-claims table.
  // Falls back to [] gracefully if the table is empty or the lookup fails.
  let claims: Claim[];
  try {
    claims = await listClaimsByDocument(id, workspaceId);
  } catch (err) {
    console.error(`DynamoDB listClaimsByDocument error for document ${id}:`, err);
    claims = [];
  }

  const response = {
    ...document,
    claims,
  };

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(response),
  };
};
