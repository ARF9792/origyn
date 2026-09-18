import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getDocument, updateDocument } from "../lib/dynamo";
import { checkRetractionStatus } from "../services/crossrefService";
import { applyDocumentImpact } from "../services/impactService";
import { DocumentStatus, RetractionStatus } from "../types/document";

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
 * POST /documents/{id}/recheck
 *
 * Re-runs the Crossref retraction lookup for a document.
 * If the status has changed to RETRACTED, propagates downstream impact
 * to claims and answers via impactService.
 *
 * Rules:
 *   - Only re-checks documents with a known DOI.
 *   - RETRACTED is reserved for formal Crossref-detected retractions.
 *   - Manual invalidation uses POST /documents/{id}/invalidate instead.
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const id = event.pathParameters?.id;
  if (!id) {
    return errorResponse(400, "DOCUMENT_NOT_FOUND", "Document ID is required.");
  }

  // ── Load document ──────────────────────────────────────────────────────────
  let document;
  try {
    document = await getDocument(id);
  } catch (err) {
    console.error(`getDocument error for ${id}:`, err);
    return errorResponse(502, "INTERNAL_ERROR", "Failed to retrieve document.");
  }

  if (!document) {
    return errorResponse(404, "DOCUMENT_NOT_FOUND", `Document '${id}' not found.`);
  }

  if (!document.doi) {
    // No DOI → cannot re-check Crossref. Return current status unchanged.
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        documentId: id,
        changed: false,
        status: document.status,
        retractionStatus: document.retractionStatus,
        impact: { claimIds: [], answerIds: [] },
      }),
    };
  }

  // ── Re-run Crossref lookup ─────────────────────────────────────────────────
  let crossrefResult;
  try {
    crossrefResult = await checkRetractionStatus(document.doi);
  } catch (err) {
    console.error(`Crossref recheck error for DOI ${document.doi}:`, err);
    return errorResponse(502, "INTERNAL_ERROR", "Crossref lookup failed during recheck.");
  }

  const newRetractionStatus: RetractionStatus = crossrefResult.retractionStatus;
  const newStatus: DocumentStatus =
    newRetractionStatus === "RETRACTED"
      ? "RETRACTED"
      : newRetractionStatus === "NONE_FOUND"
        ? "ACTIVE"
        : "UNKNOWN";

  // ── Compare old vs new ────────────────────────────────────────────────────
  const statusChanged = newStatus !== document.status;

  if (!statusChanged) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        documentId: id,
        changed: false,
        status: document.status,
        retractionStatus: document.retractionStatus,
        impact: { claimIds: [], answerIds: [] },
      }),
    };
  }

  // ── Status changed — persist updated document ─────────────────────────────
  try {
    await updateDocument(id, {
      status: newStatus,
      retractionStatus: newRetractionStatus,
      retractionNotice: crossrefResult.retractionNotice,
    });
  } catch (err) {
    console.error(`updateDocument error for ${id}:`, err);
    return errorResponse(502, "INTERNAL_ERROR", "Failed to update document status.");
  }

  // ── If newly retracted, propagate downstream impact ───────────────────────
  // Note: recheck only produces RETRACTED (formal Crossref detection).
  // INVALID is only set by POST /documents/{id}/invalidate.
  let impact = { claimIds: [] as string[], answerIds: [] as string[], claimCount: 0, answerCount: 0 };
  if (newStatus === "RETRACTED") {
    try {
      impact = await applyDocumentImpact(id);
    } catch (err) {
      console.error(`Impact traversal error for ${id}:`, err);
      // Non-fatal — document status is already updated; report partial impact.
    }
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({
      documentId: id,
      changed: true,
      status: newStatus,
      retractionStatus: newRetractionStatus,
      impact,
    }),
  };
};
