/**
 * Origyn — Real-mode evidence service.
 *
 * Implements the same load() / markReviewed() / reopen() contract as
 * evidence-service.ts, but derives data from the real backend.
 *
 * Sources:
 *   GET /documents         — lightweight list
 *   GET /documents/{id}    — full detail with claims (hydrated per doc)
 *   GET /answers           — persisted answers
 *   GET /documents/{id}/impact — authoritative current impact for RETRACTED/INVALID
 *
 * Claim status mapping:
 *   SUPPORTED  + ACTIVE source  → SUPPORTED
 *   UNSUPPORTED + RETRACTED source → AFFECTED
 *   UNSUPPORTED + INVALID source  → UNSUPPORTED
 *   UNKNOWN/PROCESSING source     → NEEDS_REVIEW
 *
 * Session-only markReviewed state (no backend persistence).
 * Preview/demo overrides remain mock-only.
 */

import type {
  Document,
  Claim,
  Answer,
  AnswerStatus,
  BackendAnswer,
  BackendImpactResponse,
} from './types';
import {
  getDocuments,
  getDocument,
  getAnswers,
  getDocumentImpact,
} from './api';
import { evaluateClaim } from './evidence-service';
import type { EvidenceClaim, EvidenceAlert, EvidenceData } from './evidence-service';

// ─── Backend → Frontend answer adaptor ───────────────────────────────────────
function adaptAnswer(
  raw: BackendAnswer,
  threadId: string
): Answer & { threadId: string } {
  return {
    id: raw.id,
    question: raw.question,
    text: raw.text,
    status: raw.status as AnswerStatus,
    createdAt: raw.createdAt,
    claimIds: raw.claimIds,
    sourceIds: raw.sourceDocumentIds,
    previousVersionId: raw.previousAnswerId,
    updatedVersionId: raw.supersededByAnswerId,
    version: 1,
    evidenceAtGeneration: raw.createdAt,
    sourceStatusSnapshot: {},
    threadId,
  };
}

// ─── Derive thread ID from root answer ────────────────────────────────────────
function rootId(raw: BackendAnswer, all: BackendAnswer[]): string {
  if (!raw.previousAnswerId) return raw.id;
  const prev = all.find((a) => a.id === raw.previousAnswerId);
  return prev ? rootId(prev, all) : raw.id;
}

// ─── Claim label derivation ───────────────────────────────────────────────────
function claimLabel(claim: Claim, index: number): string {
  if (claim.label) return claim.label;
  // Derive from claim ID if it follows our pattern, else use index
  const match = claim.id.match(/_claim_(\d+)$/);
  if (match) {
    return `CL-${String(parseInt(match[1], 10)).padStart(3, '0')}`;
  }
  return `CL-${String(index + 1).padStart(3, '0')}`;
}

// ─── Map backend claim status + source status → frontend ClaimStatus ──────────
function mapClaimStatus(
  backendStatus: 'SUPPORTED' | 'UNSUPPORTED',
  sourceIds: string[],
  sources: Document[]
): EvidenceClaim['status'] {
  if (backendStatus === 'SUPPORTED') {
    const activeSources = sourceIds.filter(
      (sid) => sources.find((s) => s.id === sid)?.status === 'ACTIVE'
    );
    if (activeSources.length === sourceIds.length) return 'SUPPORTED';
    if (activeSources.length > 0) return 'PARTIALLY_SUPPORTED';
  }

  // UNSUPPORTED — check source statuses
  const srcDocs = sourceIds.map((sid) => sources.find((s) => s.id === sid)).filter(Boolean) as Document[];

  if (srcDocs.some((s) => s.status === 'RETRACTED')) return 'AFFECTED';
  if (srcDocs.some((s) => s.status === 'INVALID')) return 'UNSUPPORTED';
  if (srcDocs.some((s) => s.status === 'UNKNOWN' || s.status === 'PROCESSING')) return 'NEEDS_REVIEW';

  return 'UNSUPPORTED';
}

// ─── Service factory ──────────────────────────────────────────────────────────
export function createRealEvidenceService() {
  const reviewed = new Set<string>();

  async function load(): Promise<EvidenceData> {
    // 1. Get lightweight document list
    const { items: summaries } = await getDocuments();

    // 2. Hydrate each document with full detail (for claims)
    //    Use Promise.allSettled to not fail on any single doc
    const hydratedResults = await Promise.allSettled(
      summaries.map((s) => getDocument(s.id))
    );

    const sources: Document[] = hydratedResults
      .map((r, i) => {
        if (r.status === 'fulfilled') return r.value;
        // Fallback: use summary data if hydration fails
        return summaries[i] as unknown as Document;
      })
      .filter(Boolean);

    // 3. Get persisted answers
    const { items: rawAnswers } = await getAnswers();

    // 4. Get impact for RETRACTED/INVALID sources
    const impactMap = new Map<string, BackendImpactResponse>();
    const problematicSources = sources.filter(
      (s) => s.status === 'RETRACTED' || s.status === 'INVALID'
    );
    await Promise.allSettled(
      problematicSources.map(async (s) => {
        try {
          const impact = await getDocumentImpact(s.id);
          impactMap.set(s.id, impact);
        } catch { /* skip if impact fails */ }
      })
    );

    // 5. Adapt answers → frontend Answer records with threadId
    const answerRecords: (Answer & { threadId: string })[] = rawAnswers.map((raw) => {
      const threadId = `conv_${rootId(raw, rawAnswers)}`;
      return adaptAnswer(raw, threadId);
    });

    // 6. Build claims from hydrated documents
    const claims: EvidenceClaim[] = [];
    let globalClaimIndex = 0;

    for (const source of sources) {
      const docClaims = (source.claims ?? []) as (Claim & {
        sourceDocumentIds?: string[];
        status?: 'SUPPORTED' | 'UNSUPPORTED';
      })[];

      docClaims.forEach((c, i) => {
        // Backend claims have sourceDocumentIds; frontend mock claims have sourceId
        const sourceIds: string[] = (c as any).sourceDocumentIds ?? [source.id];

        // Map backend claim status
        const backendStatus: 'SUPPORTED' | 'UNSUPPORTED' =
          (c.status === 'SUPPORTED' || c.status === 'UNSUPPORTED')
            ? (c.status as 'SUPPORTED' | 'UNSUPPORTED')
            : 'SUPPORTED';

        const claimStatus = mapClaimStatus(backendStatus, sourceIds, sources);

        const claimSources = sourceIds
          .map((sid) => sources.find((s) => s.id === sid))
          .filter((s): s is Document => !!s);

        const usedInAnswers = answerRecords.filter((a) => a.claimIds.includes(c.id));

        claims.push({
          id: c.id,
          label: claimLabel(c, globalClaimIndex++),
          text: c.text,
          status: claimStatus,
          sourceIds,
          sources: claimSources,
          answers: usedInAnswers,
          lastEvaluated: (c as any).updatedAt ?? source.updatedAt ?? null,
        });
      });
    }

    // 7. Build alerts
    const byId = new Map(claims.map((c) => [c.id, c]));
    const alerts: EvidenceAlert[] = [];

    for (const source of sources) {
      if (source.status === 'RETRACTED') {
        const impact = impactMap.get(source.id);
        const impactObj = impact?.impact || (impact as any);
        const affectedClaimIds = impactObj?.claimIds ?? [];
        const affectedAnswerIds = impactObj?.answerIds ?? [];

        const allSourceClaims = claims.filter((c) => c.sourceIds.includes(source.id));
        const impactClaims = affectedClaimIds.length > 0
          ? affectedClaimIds.map((cid: string) => byId.get(cid)).filter((c: any): c is EvidenceClaim => !!c)
          : allSourceClaims;

        const impactAnswers = affectedAnswerIds.length > 0
          ? answerRecords.filter((a) => affectedAnswerIds.includes(a.id))
          : answerRecords.filter(
              (a) => a.status === 'EVIDENCE_CHANGED' &&
                a.claimIds.some((cid) => impactClaims.some((c: EvidenceClaim) => c.id === cid))
            );

        const id = `retraction-${source.id}`;
        alerts.push({
          id,
          type: 'RETRACTION',
          title: 'Retraction detected',
          source,
          claimIds: impactClaims.map((c: EvidenceClaim) => c.id),
          claims: impactClaims,
          answers: impactAnswers,
          detectedAt: source.updatedAt ?? new Date().toISOString(),
          reviewStatus: reviewed.has(id) ? 'RESOLVED' : 'NEEDS_REVIEW',
        });
      }

      if (source.status === 'INVALID') {
        const impact = impactMap.get(source.id);
        const impactObj = impact?.impact || (impact as any);
        const affectedClaimIds = impactObj?.claimIds ?? [];
        const affectedAnswerIds = impactObj?.answerIds ?? [];

        const allSourceClaims = claims.filter((c) => c.sourceIds.includes(source.id));
        const impactClaims = affectedClaimIds.length > 0
          ? affectedClaimIds.map((cid: string) => byId.get(cid)).filter((c: any): c is EvidenceClaim => !!c)
          : allSourceClaims;

        const impactAnswers = affectedAnswerIds.length > 0
          ? answerRecords.filter((a) => affectedAnswerIds.includes(a.id))
          : answerRecords.filter(
              (a) => a.status === 'EVIDENCE_CHANGED' &&
                a.claimIds.some((cid) => impactClaims.some((c: EvidenceClaim) => c.id === cid))
            );

        // INVALID != RETRACTED — use different alert type/title
        const id = `invalid-${source.id}`;
        alerts.push({
          id,
          type: 'RETRACTION', // re-use RETRACTION alert type for UI (same display)
          title: 'Source invalidated',
          source,
          claimIds: impactClaims.map((c: EvidenceClaim) => c.id),
          claims: impactClaims,
          answers: impactAnswers,
          detectedAt: source.updatedAt ?? new Date().toISOString(),
          reviewStatus: reviewed.has(id) ? 'RESOLVED' : 'NEEDS_REVIEW',
        });
      }

      if (source.status === 'UNKNOWN') {
        const id = `review-${source.id}`;
        alerts.push({
          id,
          type: 'UNKNOWN',
          title: 'Source needs review',
          source,
          claimIds: [],
          claims: [],
          answers: [],
          detectedAt: source.updatedAt ?? new Date().toISOString(),
          reviewStatus: reviewed.has(id) ? 'RESOLVED' : 'NEEDS_REVIEW',
        });
      }
    }

    return { sources, claims, answers: answerRecords, alerts };
  }

  function markReviewed(id: string): void {
    reviewed.add(id);
  }

  function reopen(id: string): void {
    reviewed.delete(id);
  }

  return { load, markReviewed, reopen };
}

// ─── Singleton ────────────────────────────────────────────────────────────────
export const realEvidenceService = createRealEvidenceService();
