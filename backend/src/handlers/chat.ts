/**
 * chat.ts
 *
 * POST /chat
 *
 * Evidence-Locked question answering.
 *
 * Flow:
 *  1. Validate question
 *  2. Load ALL claims from origyn-claims
 *  3. Keep only SUPPORTED claims
 *  4. Load source documents for those claims
 *  5. Exclude claims from RETRACTED or INVALID documents
 *  6. If no usable evidence → return NO_USABLE_EVIDENCE (do NOT call model)
 *  7. Call Nova Pro with strictly bounded evidence context
 *  8. Validate every returned claim ID against supplied set (no hallucinated IDs)
 *  9. Derive sourceDocumentIds from validated claim IDs
 * 10. Persist Answer
 * 11. Return answer + citations
 *
 * Key rule: the model NEVER decides what is valid/retracted.
 * All evidence filtering happens in this handler before any LLM call.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { listAllClaims, getDocument, putAnswer, listDocuments } from "../lib/dynamo";
import { generateGroundedAnswer, EvidenceItem } from "../services/bedrockService";
import { Answer, Claim, Document } from "../types/document";
import { v4 as uuidv4 } from "uuid";
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

/** Document statuses that make a source unusable as evidence. */
const UNUSABLE_STATUSES = new Set(["RETRACTED", "INVALID"]);

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const workspaceId = getWorkspaceId(event);

  // ── 1. Parse and validate input ─────────────────────────────────────────────
  let question: string;
  try {
    const body = JSON.parse(event.body ?? "{}");
    question = (body.question ?? "").trim();
  } catch {
    return errorResponse(400, "BAD_REQUEST", "Request body must be valid JSON.");
  }

  if (!question || question.length < 3) {
    return errorResponse(400, "BAD_REQUEST", "A non-empty question is required.");
  }

  if (question.length > 2000) {
    return errorResponse(400, "BAD_REQUEST", "Question must be 2000 characters or fewer.");
  }

  // ── 2. Load all claims ──────────────────────────────────────────────────────
  let allClaims: Claim[];
  try {
    allClaims = await listAllClaims(workspaceId);
  } catch (err) {
    console.error("listAllClaims error:", err);
    return errorResponse(502, "INTERNAL_ERROR", "Failed to load evidence.");
  }

  // ── 3. Keep only SUPPORTED claims ───────────────────────────────────────────
  const supportedClaims = allClaims.filter((c) => c.status === "SUPPORTED");

  if (supportedClaims.length === 0) {
    return errorResponse(422, "NO_USABLE_EVIDENCE", "The current workspace does not contain enough usable evidence to answer this question.");
  }

  // ── 4 & 5. Load documents and filter out unusable sources ───────────────────
  // Build a map of documentId → Document (load only distinct source doc IDs)
  const distinctDocIds = new Set(
    supportedClaims.flatMap((c) => c.sourceDocumentIds)
  );

  const docMap = new Map<string, Document>();
  await Promise.all(
    Array.from(distinctDocIds).map(async (docId) => {
      try {
        const doc = await getDocument(docId, workspaceId);
        if (doc) docMap.set(docId, doc);
      } catch (err) {
        console.error(`getDocument error for ${docId}:`, err);
      }
    })
  );

  // A claim is usable only if ALL its source documents are ACTIVE (not retracted/invalid).
  const usableClaims = supportedClaims.filter((c) =>
    c.sourceDocumentIds.every((docId) => {
      const doc = docMap.get(docId);
      // If doc not found in our system, treat as unusable to be safe.
      if (!doc) return false;
      return !UNUSABLE_STATUSES.has(doc.status);
    })
  );

  if (usableClaims.length === 0) {
    return errorResponse(422, "NO_USABLE_EVIDENCE", "The current workspace does not contain enough usable evidence to answer this question.");
  }

  // ── 6. Build evidence items for the model ───────────────────────────────────
  const evidence: EvidenceItem[] = usableClaims.map((c) => ({
    claimId: c.id,
    claimText: c.text,
    documentId: c.documentId,
    documentTitle: docMap.get(c.documentId)?.title ?? null,
  }));

  const allowedClaimIds = new Set(usableClaims.map((c) => c.id));

  // ── 7. Call Nova Pro ────────────────────────────────────────────────────────
  let result;
  try {
    result = await generateGroundedAnswer(question, evidence, allowedClaimIds);
  } catch (err) {
    console.error("Bedrock generateGroundedAnswer error:", err);
    return errorResponse(502, "BEDROCK_INFERENCE_FAILED", "Failed to generate a grounded answer. Please try again.");
  }

  // ── 8. Validate returned claim IDs (already done in bedrockService) ─────────
  const validClaimIds = result.usedClaimIds;

  // ── 9. Derive source document IDs ───────────────────────────────────────────
  const usedClaimMap = new Map(usableClaims.map((c) => [c.id, c]));
  const sourceDocumentIds = [
    ...new Set(
      validClaimIds.flatMap((cId) => usedClaimMap.get(cId)?.sourceDocumentIds ?? [])
    ),
  ];

  // ── 10. Persist answer ──────────────────────────────────────────────────────
  const now = new Date().toISOString();
  const answer: Answer = {
    id: `ans_${uuidv4().replace(/-/g, "").slice(0, 12)}`,
    question,
    text: result.text,
    workspaceId,
    claimIds: validClaimIds,
    sourceDocumentIds,
    status: "CURRENT",
    previousAnswerId: null,
    supersededByAnswerId: null,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await putAnswer(answer);
  } catch (err) {
    console.error("putAnswer error:", err);
    return errorResponse(502, "INTERNAL_ERROR", "Answer generated but failed to persist. Please retry.");
  }

  // ── 11. Build citations and return ──────────────────────────────────────────
  const citations = validClaimIds
    .map((cId) => {
      const claim = usedClaimMap.get(cId);
      if (!claim) return null; // skip any ID that slipped through filtering
      const doc = docMap.get(claim.documentId);
      return {
        claimId: cId,
        documentId: claim.documentId,
        claimText: claim.text,
        title: doc?.title ?? null,
        doi: doc?.doi ?? null,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);


  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ answer, citations }),
  };
};
