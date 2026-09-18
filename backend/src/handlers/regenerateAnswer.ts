/**
 * regenerateAnswer.ts
 *
 * POST /answers/{id}/regenerate
 *
 * Regenerates an answer using only the currently usable evidence,
 * preserving the historical answer unchanged.
 *
 * Flow:
 *  1. Load historical Answer — reject if not found
 *  2. Load claims that were referenced by the original answer
 *  3. Filter: keep only SUPPORTED claims from ACTIVE documents
 *  4. If no usable evidence remains → return NO_USABLE_EVIDENCE (no model call)
 *  5. Call Nova Pro with ONLY remaining usable evidence
 *  6. Validate all returned claim IDs
 *  7. Persist NEW answer with previousAnswerId = old answer ID
 *  8. Update old answer: supersededByAnswerId = new answer ID (status unchanged)
 *  9. Return { previousAnswer, answer }
 *
 * Rules:
 *  - Old answer text/status MUST NOT be overwritten.
 *  - The model NEVER decides what evidence is usable.
 *    That determination is made deterministically before any model call.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  getAnswer as getAnswerFromDb,
  getClaim,
  getDocument,
  putAnswer,
  updateAnswerStatus,
} from "../lib/dynamo";
import { generateGroundedAnswer, EvidenceItem } from "../services/bedrockService";
import { Answer, Claim, Document } from "../types/document";
import { v4 as uuidv4 } from "uuid";

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

const UNUSABLE_DOC_STATUSES = new Set(["RETRACTED", "INVALID"]);

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const id = event.pathParameters?.id;
  if (!id) {
    return errorResponse(400, "BAD_REQUEST", "Missing answer ID.");
  }

  // ── 1. Load historical answer ───────────────────────────────────────────────
  let oldAnswer: Answer | null;
  try {
    oldAnswer = await getAnswerFromDb(id);
  } catch (err) {
    console.error(`getAnswer error for ${id}:`, err);
    return errorResponse(502, "INTERNAL_ERROR", "Failed to load answer.");
  }

  if (!oldAnswer) {
    return errorResponse(404, "ANSWER_NOT_FOUND", `No answer with ID ${id}.`);
  }

  // ── 2. Load referenced claims ───────────────────────────────────────────────
  const claimResults = await Promise.allSettled(
    oldAnswer.claimIds.map((cId) => getClaim(cId))
  );

  const originalClaims: Claim[] = claimResults
    .filter(
      (r): r is PromiseFulfilledResult<Claim | null> => r.status === "fulfilled"
    )
    .map((r) => r.value)
    .filter((c): c is Claim => c !== null);

  // ── 3. Filter to usable claims ──────────────────────────────────────────────
  // Load source documents for each claim
  const distinctDocIds = new Set(
    originalClaims.flatMap((c) => c.sourceDocumentIds)
  );
  const docMap = new Map<string, Document>();
  await Promise.all(
    Array.from(distinctDocIds).map(async (docId) => {
      try {
        const doc = await getDocument(docId);
        if (doc) docMap.set(docId, doc);
      } catch (err) {
        console.error(`getDocument error for ${docId}:`, err);
      }
    })
  );

  const usableClaims = originalClaims.filter(
    (c) =>
      c.status === "SUPPORTED" &&
      c.sourceDocumentIds.every((docId) => {
        const doc = docMap.get(docId);
        if (!doc) return false;
        return !UNUSABLE_DOC_STATUSES.has(doc.status);
      })
  );

  // ── 4. No usable evidence ───────────────────────────────────────────────────
  if (usableClaims.length === 0) {
    return errorResponse(
      422,
      "NO_USABLE_EVIDENCE",
      "No usable evidence remains for regenerating this answer."
    );
  }

  // ── 5. Build evidence items and call Nova Pro ────────────────────────────────
  const evidence: EvidenceItem[] = usableClaims.map((c) => ({
    claimId: c.id,
    claimText: c.text,
    documentId: c.documentId,
    documentTitle: docMap.get(c.documentId)?.title ?? null,
  }));
  const allowedClaimIds = new Set(usableClaims.map((c) => c.id));

  let result;
  try {
    result = await generateGroundedAnswer(
      oldAnswer.question,
      evidence,
      allowedClaimIds
    );
  } catch (err) {
    console.error("Bedrock generateGroundedAnswer error:", err);
    return errorResponse(
      502,
      "BEDROCK_INFERENCE_FAILED",
      "Failed to regenerate answer. Please try again."
    );
  }

  // ── 6. Validate returned claim IDs ──────────────────────────────────────────
  // Already filtered by bedrockService; derive source docs from validated IDs
  const validClaimIds = result.usedClaimIds;
  const usedClaimMap = new Map(usableClaims.map((c) => [c.id, c]));
  const sourceDocumentIds = [
    ...new Set(
      validClaimIds.flatMap(
        (cId) => usedClaimMap.get(cId)?.sourceDocumentIds ?? []
      )
    ),
  ];

  // ── 7. Persist new answer ───────────────────────────────────────────────────
  const now = new Date().toISOString();
  const newAnswer: Answer = {
    id: `ans_${uuidv4().replace(/-/g, "").slice(0, 12)}`,
    question: oldAnswer.question,
    text: result.text,
    claimIds: validClaimIds,
    sourceDocumentIds,
    status: "CURRENT",
    previousAnswerId: oldAnswer.id,
    supersededByAnswerId: null,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await putAnswer(newAnswer);
  } catch (err) {
    console.error("putAnswer error:", err);
    return errorResponse(
      502,
      "INTERNAL_ERROR",
      "New answer generated but failed to persist. Please retry."
    );
  }

  // ── 8. Link old answer to new (supersededByAnswerId) ────────────────────────
  // We do NOT change the old answer's status — it was already EVIDENCE_CHANGED.
  // We only stamp supersededByAnswerId so the lineage chain is traversable.
  try {
    await updateAnswerStatus(oldAnswer.id, oldAnswer.status, newAnswer.id);
  } catch (err) {
    // Non-fatal: new answer is persisted; linkage can be repaired manually.
    console.error(`updateAnswerStatus (link) error for ${oldAnswer.id}:`, err);
  }

  // ── 9. Return ───────────────────────────────────────────────────────────────
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({
      previousAnswer: {
        id: oldAnswer.id,
        status: oldAnswer.status,
      },
      answer: newAnswer,
    }),
  };
};
