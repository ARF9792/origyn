/**
 * impactService.ts — shared evidence-impact traversal.
 *
 * When a document's status becomes RETRACTED or INVALID, this service:
 *   1. Finds all claims sourced from that document.
 *   2. Marks those claims UNSUPPORTED.
 *   3. Finds all answers that cited any of those claims.
 *   4. Marks those answers EVIDENCE_CHANGED.
 *
 * Rules (from 05_PERSON1_BACKEND_DAY2.md):
 *   - RETRACTED is reserved for formal Crossref-detected retractions.
 *   - INVALID is for manual invalidation — never label it RETRACTED.
 *   - Old answers are NEVER deleted — they are preserved with EVIDENCE_CHANGED status.
 *   - DynamoDB scans are acceptable at hackathon scale when isolated here.
 */
import {
  listAllClaims,
  listAllAnswers,
  updateClaimStatus,
  updateAnswerStatus,
} from "../lib/dynamo";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ImpactResult {
  /** Claim IDs that were marked UNSUPPORTED as a result of this change. */
  claimIds: string[];
  /** Answer IDs that were marked EVIDENCE_CHANGED as a result of this change. */
  answerIds: string[];
  claimCount: number;
  answerCount: number;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Traverse and apply downstream impact for a document that has become unusable.
 *
 * @param documentId - The document that is now RETRACTED or INVALID.
 * @returns ImpactResult listing every affected claim and answer ID.
 */
export async function applyDocumentImpact(documentId: string, workspaceId?: string): Promise<ImpactResult> {
  // ── Step 1: Find claims sourced from this document ──────────────────────────
  const allClaims = await listAllClaims(workspaceId);
  const affectedClaims = allClaims.filter(
    (c) =>
      c.sourceDocumentIds.includes(documentId) &&
      c.status === "SUPPORTED"
  );

  // ── Step 2: Mark affected claims UNSUPPORTED ────────────────────────────────
  await Promise.all(
    affectedClaims.map((c) => updateClaimStatus(c.id, "UNSUPPORTED"))
  );

  const affectedClaimIds = affectedClaims.map((c) => c.id);

  // ── Step 3: Find answers that cite any of the now-unsupported claims ────────
  if (affectedClaimIds.length === 0) {
    // No claims affected → no answers affected.
    return { claimIds: [], answerIds: [], claimCount: 0, answerCount: 0 };
  }

  const claimIdSet = new Set(affectedClaimIds);
  const allAnswers = await listAllAnswers(workspaceId);
  const affectedAnswers = allAnswers.filter(
    (a) =>
      a.status === "CURRENT" &&
      a.claimIds.some((cid) => claimIdSet.has(cid))
  );

  // ── Step 4: Mark affected answers EVIDENCE_CHANGED ──────────────────────────
  await Promise.all(
    affectedAnswers.map((a) => updateAnswerStatus(a.id, "EVIDENCE_CHANGED"))
  );

  const affectedAnswerIds = affectedAnswers.map((a) => a.id);

  return {
    claimIds: affectedClaimIds,
    answerIds: affectedAnswerIds,
    claimCount: affectedClaimIds.length,
    answerCount: affectedAnswerIds.length,
  };
}

/**
 * Read-only impact view for GET /documents/{id}/impact.
 * Does NOT mutate any records — only reports what is currently affected.
 *
 * @param documentId - The document to inspect.
 */
export async function getDocumentImpactView(documentId: string, workspaceId?: string): Promise<{
  claimIds: string[];
  answerIds: string[];
  claimCount: number;
  answerCount: number;
}> {
  const allClaims = await listAllClaims(workspaceId);
  const affectedClaims = allClaims.filter(
    (c) =>
      c.sourceDocumentIds.includes(documentId) &&
      c.status === "UNSUPPORTED"
  );
  const affectedClaimIds = affectedClaims.map((c) => c.id);

  if (affectedClaimIds.length === 0) {
    return { claimIds: [], answerIds: [], claimCount: 0, answerCount: 0 };
  }

  const claimIdSet = new Set(affectedClaimIds);
  const allAnswers = await listAllAnswers(workspaceId);
  const affectedAnswers = allAnswers.filter(
    (a) =>
      a.status === "EVIDENCE_CHANGED" &&
      a.claimIds.some((cid) => claimIdSet.has(cid))
  );

  return {
    claimIds: affectedClaimIds,
    answerIds: affectedAnswers.map((a) => a.id),
    claimCount: affectedClaimIds.length,
    answerCount: affectedAnswers.length,
  };
}
