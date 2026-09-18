/**
 * Origyn — Chat / Evidence mock data.
 * TypeScript translation of Astra Pass 2 dist/workspace/chat/mock-data.js.
 *
 * Fictional research records referencing the SAME source and claim IDs
 * already present in the workspace fixture library.
 * No real scholarly status or scientific conclusion is asserted.
 */

import type { Answer, Conversation, EvidenceEvent, ChatClaim, ChatDemoState } from './types';
import { MOCK_DOCUMENTS } from './mock-data';

// ─── Prepared question ────────────────────────────────────────────────────────
export const CHAT_QUESTION =
  'What does the current evidence say about repeated cognitive training and neural adaptation?';

export const INSUFFICIENT_QUESTION = 'Does cognitive training prevent dementia?';

// ─── Source / claim ID sets ───────────────────────────────────────────────────
export const chatSourceIds = {
  remaining: ['doc_001', 'doc_006'] as string[],
  removed: 'doc_002',
};

export const chatClaimIds = {
  remaining: ['doc_001_claim_1', 'doc_006_claim_1'] as string[],
  removed: 'doc_002_claim_1',
};

// ─── Excerpt snapshots per claim ──────────────────────────────────────────────
const excerptSnapshots: Record<string, string> = {
  doc_001_claim_1: 'Task retention improved after a period of sleep within the study sample.',
  doc_006_claim_1:
    'Measured task performance changed across successive sessions; this observation alone does not establish a shared neural mechanism.',
  doc_002_claim_1:
    'Repeated training was associated with changes in task performance within the study sample.',
};

// ─── Chat claims (derived from workspace fixtures) ────────────────────────────
// Translate Astra: flatMap(source => source.claims.map(...))
export const chatClaims: ChatClaim[] = MOCK_DOCUMENTS.flatMap((source) =>
  source.claims.map((claim) => ({
    id: claim.id,
    label: claim.label,
    text: claim.text,
    status: claim.status,
    sourceIds: [source.id],
    page: claim.page,
    quote: excerptSnapshots[claim.id] ?? claim.quote,
    answerCount: claim.answerCount,
    createdAt: claim.createdAt,
  }))
);

// ─── Answer copy ──────────────────────────────────────────────────────────────
export const answerCopy = {
  current: [
    'Current workspace evidence describes changes in learning and task performance, but it does not establish a direct conclusion about repeated cognitive training and neural adaptation.',
    'Chen and colleagues report improved task retention after sleep. Silva and colleagues describe changes in measured performance across sessions. These are related observations, not interchangeable measures of neural adaptation.',
    'The training-specific paper is excluded because it has been retracted. A conclusion about its reported training effect is unsupported by current workspace evidence.',
  ],
  original: [
    'The workspace papers describe learning-related changes in task performance. Morgan and colleagues report an association between repeated training and changes in task performance.',
    'Alongside reports of sleep-dependent retention and performance changes across sessions, this provides an initial basis for investigating training-related adaptation. The studies do not establish a common mechanism or a comparable effect size.',
    'This interpretation depends in part on the repeated-training paper. It should be revisited if the status of that source changes.',
  ],
  updated: [
    'The remaining current evidence describes sleep-dependent retention and changes in measured performance across sessions. It does not establish the repeated-training association described in the original answer.',
    'The Morgan study is no longer included because it was retracted. Its supporting claim and the training-specific inference have been removed from this version.',
    'Chen and Silva remain in the evidence context. They provide related observations, but additional usable evidence is needed before drawing a conclusion about repeated cognitive training and neural adaptation.',
  ],
  insufficient: [
    'The current workspace does not contain enough usable evidence to support that conclusion.',
  ],
  failure:
    'Origyn found the evidence, but the answer could not be generated. Your question and the source records have been preserved.',
};

// ─── Change summary ───────────────────────────────────────────────────────────
export const changeSummary = {
  removedInference: 'The training-specific association from Morgan et al.',
  explanation:
    'Removed the repeated-training source and its supporting claim. Related observations remain; the original inference is not carried forward.',
};

// ─── Demo state menu ──────────────────────────────────────────────────────────
export const chatDemoStates: [ChatDemoState, string][] = [
  ['normal',      'Normal answer'],
  ['empty',       'Empty conversation'],
  ['loading',     'Answer loading'],
  ['insufficient','Insufficient evidence'],
  ['evidence',    'Evidence inspector'],
  ['historical',  'Evidence changed'],
  ['regenerating','Regeneration in progress'],
  ['updated',     'Updated answer'],
  ['failure',     'Generation failure'],
];

// ─── Evidence event ───────────────────────────────────────────────────────────
export const evidenceEvent: EvidenceEvent = {
  id: 'event_retraction_doc_002',
  sourceId: 'doc_002',
  detectedAt: '2026-09-18T08:40:00Z',
  noticeDate: '2026-09-16',
  previousStatus: 'ACTIVE',
  currentStatus: 'RETRACTED',
};

// ─── Answer factory ───────────────────────────────────────────────────────────
export function makeAnswer(
  id: string,
  kind: 'current' | 'original' | 'updated' | 'insufficient',
  extra: Partial<Answer> = {}
): Answer {
  const isOriginal = kind === 'original';
  return {
    id,
    question: CHAT_QUESTION,
    text: answerCopy[kind].join('\n\n'),
    status: isOriginal ? 'EVIDENCE_CHANGED' : 'CURRENT',
    createdAt: isOriginal ? '2026-09-15T14:20:00Z' : '2026-09-18T09:12:00Z',
    claimIds: isOriginal
      ? [...chatClaimIds.remaining, chatClaimIds.removed]
      : [...chatClaimIds.remaining],
    sourceIds: isOriginal
      ? [...chatSourceIds.remaining, chatSourceIds.removed]
      : [...chatSourceIds.remaining],
    previousVersionId: null,
    updatedVersionId: null,
    version: 1,
    evidenceAtGeneration: isOriginal ? '2026-09-15T14:20:00Z' : '2026-09-18T08:40:00Z',
    sourceStatusSnapshot: Object.fromEntries(
      (isOriginal
        ? [...chatSourceIds.remaining, chatSourceIds.removed]
        : chatSourceIds.remaining
      ).map((sid) => [sid, 'ACTIVE' as const])
    ),
    isMock: true,
    ...extra,
  };
}

// ─── Seed conversation threads ────────────────────────────────────────────────
// These are recreated fresh each time createChatService() is called (via clone).
export const chatThreads: Conversation[] = [
  {
    id: 'review',
    title: 'Current evidence review',
    snapshot: 'current',
    answers: [makeAnswer('ans_review_1', 'current')],
    keptVersions: [],
  },
  {
    id: 'history',
    title: 'Training study · evidence changed',
    snapshot: 'current',
    answers: [makeAnswer('ans_history_1', 'original')],
    keptVersions: [],
  },
];
