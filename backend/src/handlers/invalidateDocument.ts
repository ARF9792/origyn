import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getDocument, updateDocument } from "../lib/dynamo";
import { applyDocumentImpact } from "../services/impactService";
import { getWorkspaceId } from "../lib/auth";

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
 * POST /documents/{id}/invalidate
 *
 * Manually invalidates a document (e.g. superseded by a newer source,
 * known methodology flaw, or workspace owner decision).
 *
 * Rules (05_PERSON1_BACKEND_DAY2.md + 06_DAY2_API_CONTRACT_ADDENDUM.md):
 *   - Sets document status to INVALID — never to RETRACTED.
 *   - RETRACTED is reserved for formal Crossref-detected retractions only.
 *   - retractionStatus is NOT changed (a manually invalidated paper may still
 *     show NONE_FOUND from Crossref — that is intentional and accurate).
 *   - Runs the same impact traversal as recheck (claims → answers).
 *
 * Request body: { "reason": "..." }
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const id = event.pathParameters?.id;
  const ownerId = getWorkspaceId(event);
  if (!id) {
    return errorResponse(400, "DOCUMENT_NOT_FOUND", "Document ID is required.");
  }

  // ── Parse reason ──────────────────────────────────────────────────────────
  let reason = "";
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    reason = typeof body.reason === "string" ? body.reason.trim() : "";
  } catch {
    return errorResponse(400, "INVALID_REQUEST", "Request body must be valid JSON.");
  }

  if (!reason) {
    return errorResponse(400, "INVALID_REQUEST", "A non-empty 'reason' is required.");
  }

  // ── Load document ──────────────────────────────────────────────────────────
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

  if (document.status === "INVALID") {
    // Already invalidated — idempotent: return current state with empty impact.
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        documentId: id,
        status: "INVALID",
        reason,
        impact: { claimIds: [], answerIds: [], claimCount: 0, answerCount: 0 },
      }),
    };
  }

  // ── Set document status to INVALID ────────────────────────────────────────
  // Note: retractionStatus is deliberately NOT touched.
  // A manually invalidated document may still have retractionStatus=NONE_FOUND;
  // that accurately reflects the Crossref result.
  try {
    await updateDocument(id, { status: "INVALID" });
  } catch (err) {
    console.error(`updateDocument error for ${id}:`, err);
    return errorResponse(502, "INTERNAL_ERROR", "Failed to invalidate document.");
  }

  // ── Propagate impact to claims and answers ────────────────────────────────
  let impact = { claimIds: [] as string[], answerIds: [] as string[], claimCount: 0, answerCount: 0 };
  try {
    impact = await applyDocumentImpact(id, ownerId);
  } catch (err) {
    console.error(`Impact traversal error for ${id}:`, err);
    // Non-fatal — document is already INVALID; report partial impact.
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({
      documentId: id,
      status: "INVALID",
      reason,
      impact,
    }),
  };
};
