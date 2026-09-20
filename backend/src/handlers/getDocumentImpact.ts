import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getDocument, listClaimsByDocument, listAllAnswers } from "../lib/dynamo";
import { Claim } from "../types/document";
import { getAuthenticatedOwnerId } from "../lib/auth";

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
 * GET /documents/{id}/impact
 *
 * Read-only blast-radius view for a document.
 * Returns the document's current status plus all currently affected
 * claims (UNSUPPORTED) and answers (EVIDENCE_CHANGED) derived from it.
 *
 * Does NOT mutate any records — use POST /recheck or POST /invalidate
 * to trigger actual impact propagation.
 *
 * Response shape matches 06_DAY2_API_CONTRACT_ADDENDUM.md exactly.
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const id = event.pathParameters?.id;
  const ownerId = getAuthenticatedOwnerId(event);
  if (!id) {
    return errorResponse(400, "DOCUMENT_NOT_FOUND", "Document ID is required.");
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

  // ── Find unsupported claims from this document ────────────────────────────
  let claims: { id: string; text: string; status: Claim["status"] }[];
  try {
    const allClaims = await listClaimsByDocument(id, ownerId);
    claims = allClaims
      .filter((c) => c.status === "UNSUPPORTED")
      .map((c) => ({ id: c.id, text: c.text, status: c.status }));
  } catch (err) {
    console.error(`listClaimsByDocument error for ${id}:`, err);
    claims = [];
  }

  // ── Find answers affected by unsupported claims ────────────────────────────
  let answers: { id: string; question: string; status: string }[] = [];
  try {
    if (claims.length > 0) {
      const unsupportedClaimIds = new Set(claims.map((c) => c.id));
      const allAnswers = await listAllAnswers(ownerId);
      answers = allAnswers
        .filter(
          (a) =>
            a.status === "EVIDENCE_CHANGED" &&
            a.claimIds.some((cid) => unsupportedClaimIds.has(cid))
        )
        .map((a) => ({ id: a.id, question: a.question, status: a.status }));
    }
  } catch (err) {
    console.error(`listAllAnswers error for impact view of ${id}:`, err);
    answers = [];
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({
      document: {
        id: document.id,
        title: document.title,
        status: document.status,
        retractionStatus: document.retractionStatus,
      },
      claims,
      answers,
      summary: {
        claimCount: claims.length,
        answerCount: answers.length,
      },
    }),
  };
};
