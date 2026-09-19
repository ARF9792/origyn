/**
 * Origyn — Evidence domain preview configuration.
 * TypeScript port of Astra Pass 4 evidence/mock-data.js.
 *
 * Preview scenarios are ISOLATED to CL-061 (doc_006_claim_1).
 * They do NOT mutate shared source, chat, or graph records.
 *
 * supportedCheck describes CL-011 retaining its independent support
 * from doc_001. doc_002 does NOT support CL-011; the retraction of
 * doc_002 simply does not affect CL-011's evidence from doc_001.
 */

import type { ClaimStatus } from './types';

// ─── Status label map ──────────────────────────────────────────────────────────
export const claimStatusLabels: Record<ClaimStatus, string> = {
  SUPPORTED:           'Supported',
  PARTIALLY_SUPPORTED: 'Partially supported',
  AFFECTED:            'Affected',
  UNSUPPORTED:         'Unsupported',
  NEEDS_REVIEW:        'Needs review',
  INVALID:             'Invalid',
};

// ─── Review state menus ────────────────────────────────────────────────────────
export type ClaimPreviewMode =
  | 'normal'
  | 'supported'
  | 'affected'
  | 'partial'
  | 'unsupported'
  | 'review'
  | 'empty'
  | 'loading'
  | 'error';

export type AlertPreviewMode =
  | 'normal'
  | 'retraction'
  | 'unknown'
  | 'supported'
  | 'empty'
  | 'loading'
  | 'error';

export const claimPreviewStates: [ClaimPreviewMode, string][] = [
  ['normal',     'Current claims'],
  ['supported',  'Supported claim'],
  ['affected',   'Affected claim'],
  ['partial',    'Partially supported'],
  ['unsupported','Unsupported claim'],
  ['review',     'Needs review'],
  ['empty',      'Empty claims'],
  ['loading',    'Loading claims'],
  ['error',      'Loading error'],
];

export const alertPreviewStates: [AlertPreviewMode, string][] = [
  ['normal',     'Evidence changes'],
  ['retraction', 'Retraction impact'],
  ['unknown',    'Source needs review'],
  ['supported',  'Claim remains supported'],
  ['empty',      'No evidence changes'],
  ['loading',    'Loading changes'],
  ['error',      'Loading error'],
];

// ─── Isolated claim preview scenarios ─────────────────────────────────────────
// These override the display status of CL-061 (doc_006_claim_1) only.
// The actual source, claim, and answer records are not mutated.
export interface ClaimScenario {
  claimId: string;
  status: ClaimStatus;
  reason: string;
}

export const claimScenarios: Partial<Record<ClaimPreviewMode, ClaimScenario>> = {
  partial: {
    claimId: 'doc_006_claim_1',
    status:  'PARTIALLY_SUPPORTED',
    reason:  'Only part of the recorded support is currently usable. Review the evidence before relying on the full claim.',
  },
  unsupported: {
    claimId: 'doc_006_claim_1',
    status:  'UNSUPPORTED',
    reason:  'The current evidence context cannot support this claim. It remains visible for provenance.',
  },
  review: {
    claimId: 'doc_006_claim_1',
    status:  'NEEDS_REVIEW',
    reason:  'This claim needs a researcher to review its evidence mapping before it is used in a new answer.',
  },
};

// ─── Supported-check record ────────────────────────────────────────────────────
// CL-011 (doc_001_claim_1) retains its independent support from doc_001.
// doc_002 was retracted, but doc_002 is NOT and was NEVER a supporting
// source for CL-011. This record captures the fact that a retraction event
// (involving doc_002) did not affect an unrelated claim (CL-011).
export const supportedCheck = {
  id:               'support-retained-doc_001_claim_1',
  claimId:          'doc_001_claim_1',
  /** The retracted source that triggered the check — NOT a CL-011 supporter. */
  retractedSourceId:'doc_002',
  /** The independent source that still supports CL-011. */
  supportingSourceId:'doc_001',
  detectedAt:       '2026-09-18T08:41:00Z',
} as const;
