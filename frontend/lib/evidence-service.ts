/**
 * Origyn — Evidence domain service.
 * TypeScript port of Astra Pass 4 evidence/service.js.
 *
 * Adapts existing production services (MOCK_DOCUMENTS, chatService,
 * chatClaims) into the evidence domain. Does NOT create a second
 * data universe. All source/claim/answer records come from shared
 * production fixtures.
 *
 * Session-only review state is held inside the service closure (a Set).
 * It is never persisted and resets on page reload, matching Astra behaviour.
 */

import type {
  Document,
  Claim,
  ClaimStatus,
  Answer,
} from './types';
import { MOCK_DOCUMENTS } from './mock-data';
import { chatService } from './chat-service';
import {
  chatClaims,
  evidenceEvent,
} from './chat-mock-data';
import {
  claimStatusLabels,
  claimScenarios,
  supportedCheck,
} from './evidence-mock-data';
import type { ClaimPreviewMode } from './evidence-mock-data';

// ─── Enriched claim ────────────────────────────────────────────────────────────
export interface EvidenceClaim {
  id: string;
  label: string;
  text: string;
  status: ClaimStatus;
  sourceIds: string[];
  sources: Document[];
  page?: number;
  quote?: string;
  answers: (Answer & { threadId: string })[];
  lastEvaluated: string | null | undefined;
  /** True when isolated preview override is active */
  preview?: boolean;
  /** Reason text for isolated preview */
  previewReason?: string;
}

// ─── Alert ────────────────────────────────────────────────────────────────────
export type AlertType = 'RETRACTION' | 'UNKNOWN' | 'SUPPORTED';
export type AlertReviewStatus = 'NEEDS_REVIEW' | 'RESOLVED';

export interface EvidenceAlert {
  id: string;
  type: AlertType;
  title: string;
  source: Document;
  /** The single claim for SUPPORTED alerts */
  claim?: EvidenceClaim;
  claimIds: string[];
  claims: EvidenceClaim[];
  answers: (Answer & { threadId: string })[];
  detectedAt: string;
  reviewStatus: AlertReviewStatus;
}

// ─── Service data ─────────────────────────────────────────────────────────────
export interface EvidenceData {
  sources: Document[];
  claims: EvidenceClaim[];
  answers: (Answer & { threadId: string })[];
  alerts: EvidenceAlert[];
}

// ─── Status evaluation ────────────────────────────────────────────────────────
export function evaluateClaim(sourceIds: string[], sources: Document[]): ClaimStatus {
  if (!sourceIds.length) return 'UNSUPPORTED';
  const support = sourceIds.map((id) => sources.find((s) => s.id === id));
  const active  = support.filter((s) => s?.status === 'ACTIVE').length;
  if (active === sourceIds.length) return 'SUPPORTED';
  if (active > 0)                  return 'PARTIALLY_SUPPORTED';
  if (support.some((s) => s?.status === 'RETRACTED')) return 'AFFECTED';
  if (support.some((s) => ['UNKNOWN', 'PROCESSING'].includes(s?.status ?? '')))
    return 'NEEDS_REVIEW';
  return 'UNSUPPORTED';
}

// ─── Reason text ──────────────────────────────────────────────────────────────
export function claimReason(c: EvidenceClaim): string {
  if (c.previewReason) return c.previewReason;
  const reasons: Record<ClaimStatus, string> = {
    SUPPORTED:
      'Current workspace sources support this claim. This records evidence support, not an assessment of scientific correctness.',
    PARTIALLY_SUPPORTED:
      'Some supporting evidence is no longer usable. Remaining sources support part of this claim; review its scope.',
    AFFECTED:
      'Supporting evidence is no longer fully usable because its source has been retracted. The claim remains visible for provenance.',
    UNSUPPORTED:
      'No currently usable supporting evidence is recorded. This claim is retained for provenance.',
    NEEDS_REVIEW:
      'Supporting source identification or evidence mapping needs review before this claim can be used.',
    INVALID:
      'This claim is marked invalid and is retained for provenance only.',
  };
  return reasons[c.status] ?? reasons.NEEDS_REVIEW;
}

// ─── Answer URL ───────────────────────────────────────────────────────────────
export function answerURL(answer: Answer & { threadId: string }): string {
  return (
    `/workspace/chat?conversation=${encodeURIComponent(answer.threadId)}` +
    `&answer=${encodeURIComponent(answer.id)}`
  );
}

// ─── Query / filter helpers ───────────────────────────────────────────────────
export type ClaimsFilterStatus = 'ALL' | ClaimStatus;
export type ClaimsSortKey = 'label' | 'review' | 'usage';

export interface ClaimsQueryOptions {
  search?: string;
  status?: ClaimsFilterStatus;
  sort?: ClaimsSortKey;
}

export function queryClaims(
  items: EvidenceClaim[],
  { search = '', status = 'ALL', sort = 'label' }: ClaimsQueryOptions = {}
): EvidenceClaim[] {
  const q = search.trim().toLowerCase();

  const needsAttention = (s: ClaimStatus) =>
    ['AFFECTED', 'UNSUPPORTED', 'NEEDS_REVIEW', 'PARTIALLY_SUPPORTED'].includes(s);

  return items
    .filter((c) => {
      if (status !== 'ALL' && c.status !== status) return false;
      if (!q) return true;
      const hay = [
        c.label,
        c.text,
        claimStatusLabels[c.status],
        ...c.sources.map((s) => s.title ?? s.filename),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    })
    .sort((a, b) => {
      if (sort === 'usage') {
        return b.answers.length - a.answers.length || a.label.localeCompare(b.label);
      }
      if (sort === 'review') {
        return (
          Number(needsAttention(b.status)) - Number(needsAttention(a.status)) ||
          a.label.localeCompare(b.label)
        );
      }
      return a.label.localeCompare(b.label);
    });
}

export type AlertsFilterStatus = 'review' | 'retractions' | 'unknown' | 'resolved' | 'all';

export interface AlertsQueryOptions {
  search?: string;
  status?: AlertsFilterStatus;
}

export function queryAlerts(
  items: EvidenceAlert[],
  { search = '', status = 'review' }: AlertsQueryOptions = {}
): EvidenceAlert[] {
  const q = search.trim().toLowerCase();
  return items.filter((a) => {
    const matchStatus =
      status === 'all' ||
      (status === 'review'       && a.reviewStatus === 'NEEDS_REVIEW') ||
      (status === 'retractions'  && a.type === 'RETRACTION') ||
      (status === 'unknown'      && a.type === 'UNKNOWN') ||
      (status === 'resolved'     && a.reviewStatus === 'RESOLVED');
    if (!matchStatus) return false;
    if (!q) return true;
    const hay = [
      a.title,
      a.source?.title,
      a.claim?.label,
      a.claim?.text,
      a.reviewStatus === 'RESOLVED' ? 'Resolved' : 'Needs review',
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}

// ─── Preview overlay (isolated) ───────────────────────────────────────────────
export function previewClaims(
  items: EvidenceClaim[],
  mode: ClaimPreviewMode
): EvidenceClaim[] {
  const scenario = claimScenarios[mode];
  if (!scenario) return items;
  return items.map((c) =>
    c.id === scenario.claimId
      ? { ...c, status: scenario.status, preview: true, previewReason: scenario.reason }
      : c
  );
}

// ─── Service factory ──────────────────────────────────────────────────────────
export interface EvidenceServiceOptions {
  getSources?: () => Promise<Document[]>;
  chat?: typeof chatService;
}

export function createEvidenceService(options: EvidenceServiceOptions = {}) {
  const {
    getSources  = async () => JSON.parse(JSON.stringify(MOCK_DOCUMENTS)) as Document[],
    chat        = chatService,
  } = options;

  // Session-only acknowledgement state — resets on reload.
  const reviewed = new Set<string>();

  async function load(): Promise<EvidenceData> {
    const sources = await getSources();

    // Flatten answers from all non-replay conversations
    const answerRecords: (Answer & { threadId: string })[] = chat
      .listConversations()
      .filter((t) => t.snapshot !== 'before-retraction')
      .flatMap((t) => t.answers.map((a) => ({ ...a, threadId: t.id })));

    // Build enriched claim map — prefer chatClaims for excerpt/quote
    const snapshots = new Map(chatClaims.map((c) => [c.id, c]));

    const claims: EvidenceClaim[] = sources.flatMap((s) =>
      s.claims.map((c: Claim) => {
        const record = snapshots.get(c.id) ?? { ...c, sourceIds: [s.id] };
        const sourceIds: string[] = 'sourceIds' in record ? record.sourceIds : [s.id];
        return {
          id:           c.id,
          label:        c.label ?? c.id,
          text:         c.text,
          status:       evaluateClaim(sourceIds, sources),
          sourceIds,
          sources:      sourceIds.map((id) => sources.find((src) => src.id === id)!).filter(Boolean),
          page:         c.page,
          quote:        ('quote' in record ? record.quote : undefined) ?? c.quote,
          answers:      answerRecords.filter((a) => a.claimIds.includes(c.id)),
          lastEvaluated: s.lastChecked,
        };
      })
    );

    const byId = new Map(claims.map((c) => [c.id, c]));
    const alerts: EvidenceAlert[] = [];

    // ── RETRACTION alerts ──────────────────────────────────────────────────────
    for (const source of sources) {
      if (source.status === 'RETRACTED') {
        const allClaims    = claims.filter((c) => c.sourceIds.includes(source.id));
        const cited        = allClaims.filter((c) => c.answers.length > 0);
        const linkedClaims = cited.length ? cited : allClaims;

        // Only answers that are EVIDENCE_CHANGED and reference a linked claim
        const linkedIds = new Set(linkedClaims.map((c) => c.id));
        const answers   = answerRecords.filter(
          (a) =>
            a.status === 'EVIDENCE_CHANGED' &&
            a.claimIds.some((id) => linkedIds.has(id))
        );

        const id = `retraction-${source.id}`;
        alerts.push({
          id,
          type:         'RETRACTION',
          title:        'Retraction detected',
          source,
          claimIds:     linkedClaims.map((c) => c.id),
          claims:       linkedClaims,
          answers,
          detectedAt:
            source.id === evidenceEvent.sourceId
              ? evidenceEvent.detectedAt
              : source.updatedAt,
          reviewStatus: reviewed.has(id) ? 'RESOLVED' : 'NEEDS_REVIEW',
        });
      }

      // ── UNKNOWN alerts ─────────────────────────────────────────────────────
      if (source.status === 'UNKNOWN') {
        const id = `review-${source.id}`;
        alerts.push({
          id,
          type:         'UNKNOWN',
          title:        'Source needs review',
          source,
          claimIds:     [],
          claims:       [],
          answers:      [],
          detectedAt:   source.updatedAt,
          reviewStatus: reviewed.has(id) ? 'RESOLVED' : 'NEEDS_REVIEW',
        });
      }
    }

    // ── SUPPORTED alert — CL-011 retains independent support from doc_001 ─────
    // doc_002 was retracted. CL-011 is supported ONLY by doc_001, not by
    // doc_002. This alert simply notes that the retraction event did not
    // affect CL-011's independent evidence.
    const retainedClaim   = byId.get(supportedCheck.claimId);
    const retractedSource = sources.find((s) => s.id === supportedCheck.retractedSourceId);
    if (retainedClaim?.status === 'SUPPORTED' && retractedSource?.status === 'RETRACTED') {
      alerts.push({
        id:           supportedCheck.id,
        type:         'SUPPORTED',
        title:        'Claim remains supported',
        source:       retractedSource,   // the retracted source (context only)
        claim:        retainedClaim,
        claimIds:     [retainedClaim.id],
        claims:       [retainedClaim],
        answers:      [],
        detectedAt:   supportedCheck.detectedAt,
        reviewStatus: 'RESOLVED',        // Calm state — no action needed
      });
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
export const evidenceService = createEvidenceService();
