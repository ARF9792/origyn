import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getDocument, updateDocument } from "../lib/dynamo";
import { getWorkspaceId } from "../lib/auth";
import { applyDocumentImpact } from "../services/impactService";

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
 * DELETE /documents/{id}
 *
 * Soft-deletes a document and propagates the impact to its claims and answers.
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const id = event.pathParameters?.id;
  if (!id) {
    return errorResponse(400, "DOCUMENT_NOT_FOUND", "Document ID is required.");
  }


  // ── Load document ──────────────────────────────────────────────────────────
  const ownerId = getWorkspaceId(event);

  let document;
  try {
    document = await getDocument(id, ownerId);
  } catch (err) {
    console.error(`getDocument error for ${id}:`, err);
    return errorResponse(502, "INTERNAL_ERROR", "Failed to retrieve document.");
  }

  if (!document) {
    return errorResponse(404, "DOCUMENT_NOT_FOUND", `Document '${id}' not found.`);
  }

  if (document.status === "DELETED") {
    // Already deleted — idempotent
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        documentId: id,
        status: "DELETED",
        impact: { claimIds: [], answerIds: [], claimCount: 0, answerCount: 0 },
      }),
    };
  }

  // ── Set document status to DELETED ────────────────────────────────────────
  try {
    await updateDocument(id, { status: "DELETED" });
  } catch (err) {
    console.error(`updateDocument error for ${id}:`, err);
    return errorResponse(502, "INTERNAL_ERROR", "Failed to delete document.");
  }

  // ── Propagate impact to claims and answers ────────────────────────────────
  let impact = { claimIds: [] as string[], answerIds: [] as string[], claimCount: 0, answerCount: 0 };
  try {
    impact = await applyDocumentImpact(id, ownerId);
  } catch (err) {
    console.error(`Impact traversal error for ${id}:`, err);
    // Non-fatal — document is already DELETED; report partial impact.
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({
      documentId: id,
      status: "DELETED",
      impact,
    }),
  };
};
