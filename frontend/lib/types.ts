/**
 * Origyn — shared TypeScript types.
 * These types mirror the Day 1 API contract exactly.
 * Presentation-only fields (authors, journal, year, identificationMethod,
 * lastChecked, usage) are optional and must NOT be sent to the backend as
 * part of the core contract. They are populated by the mock layer and, in
 * future, by an optional enrichment response from the backend.
 */

// ─── Document status ────────────────────────────────────────────────────────
export type DocumentStatus =
  | 'PROCESSING'
  | 'ACTIVE'
  | 'RETRACTED'
  | 'UNKNOWN'
  | 'INVALID';

// ─── Retraction status ───────────────────────────────────────────────────────
// NONE_FOUND means no known retraction was found.
// It does NOT mean the research is scientifically valid.
export type RetractionStatus = 'NONE_FOUND' | 'RETRACTED' | 'UNKNOWN';

// ─── Retraction notice ───────────────────────────────────────────────────────
export interface RetractionNotice {
  doi: string;
  date: string;
  source: string;
  /** Presentation-only — not guaranteed from backend on Day 1 */
  title?: string;
  /** Presentation-only — not guaranteed from backend on Day 1 */
  reason?: string;
}

// ─── Claim ───────────────────────────────────────────────────────────────────
export type ClaimStatus =
  | 'SUPPORTED'
  | 'PARTIALLY_SUPPORTED'
  | 'AFFECTED'
  | 'UNSUPPORTED'
  | 'NEEDS_REVIEW'
  | 'INVALID';

export interface Claim {
  id: string;
  /** Presentation label, e.g. "CL-001" */
  label?: string;
  text: string;
  status: ClaimStatus;
  sourceId: string;
  /** Presentation-only fields */
  page?: number;
  quote?: string;
  answerCount?: number;
  createdAt?: string;
}

// ─── Document (list item) ─────────────────────────────────────────────────────
/** Shape returned by GET /documents items array */
export interface DocumentSummary {
  id: string;
  filename: string;
  title: string | null;
  doi: string | null;
  status: DocumentStatus;
  retractionStatus: RetractionStatus;
  createdAt: string;
  updatedAt: string;
}

// ─── Document (full detail) ───────────────────────────────────────────────────
/** Shape returned by GET /documents/:id and POST /documents */
export interface Document extends DocumentSummary {
  retractionNotice: RetractionNotice | null;
  claims: Claim[];

  // ── Presentation-only optional fields ──
  // These are populated by the mock layer or a future enrichment endpoint.
  // They do NOT change the core backend contract.
  authors?: string;
  journal?: string;
  year?: number;
  identificationMethod?: string;
  lastChecked?: string | null;
  usage?: {
    claims: number;
    answers: number;
    summaries: number;
  };
  isMock?: boolean;
}

// ─── GET /documents response ──────────────────────────────────────────────────
export interface DocumentsResponse {
  items: DocumentSummary[];
}

// ─── GET /graph response ──────────────────────────────────────────────────────
export interface GraphNode {
  id: string;
  type: 'document' | 'claim' | 'answer';
  label: string;
  status: DocumentStatus | ClaimStatus | 'CURRENT' | 'EVIDENCE_CHANGED';
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ─── API error ───────────────────────────────────────────────────────────────
export type ApiErrorCode =
  | 'INVALID_FILE'
  | 'UPLOAD_FAILED'
  | 'DOCUMENT_IDENTIFICATION_FAILED'
  | 'CROSSREF_LOOKUP_FAILED'
  | 'DOCUMENT_NOT_FOUND'
  | 'INTERNAL_ERROR';

export interface ApiError {
  error: {
    code: ApiErrorCode;
    message: string;
  };
}

// ─── Upload options ───────────────────────────────────────────────────────────
export interface UploadOptions {
  signal?: AbortSignal;
  /** Mock mode: which outcome to simulate */
  outcome?: 'success' | 'retracted' | 'unknown' | 'failure';
  onStage?: (stageId: string) => void;
}

// ─── Analysis stage ───────────────────────────────────────────────────────────
export interface AnalysisStage {
  id: string;
  label: string;
  done: string;
}

// ─── Status label map ─────────────────────────────────────────────────────────
export const STATUS_LABELS: Record<DocumentStatus, string> = {
  ACTIVE: 'No retraction found',
  RETRACTED: 'Retracted',
  UNKNOWN: 'Unable to verify',
  PROCESSING: 'Processing',
  INVALID: 'Invalid',
};

// ─── Query parameters ─────────────────────────────────────────────────────────
export interface LibraryQuery {
  search: string;
  status: 'ALL' | DocumentStatus;
  sort: 'recent' | 'title' | 'year';
  page: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Chat / Evidence types
// Translated from Astra Pass 2 mock-data.js / service.js.
// ────────────────────────────────────────────────────────────────────────────

// ─── Answer status ────────────────────────────────────────────────────────────
export type AnswerStatus =
  | 'CURRENT'
  | 'EVIDENCE_CHANGED'
  | 'INSUFFICIENT'
  | 'GENERATING';

// ─── Answer ───────────────────────────────────────────────────────────────────
// Immutable once created. Evidence changes create a NEW answer version;
// the original is never mutated.
export interface Answer {
  id: string;
  question: string;
  text: string;
  status: AnswerStatus;
  createdAt: string;
  claimIds: string[];
  sourceIds: string[];
  /** ID of the answer this was generated to replace (updated version only) */
  previousVersionId: string | null;
  /** ID of the updated version if one has been generated */
  updatedVersionId: string | null;
  version: number;
  /** ISO timestamp of the evidence snapshot used at generation time */
  evidenceAtGeneration: string;
  /** Source status at generation time — historical record, never mutated */
  sourceStatusSnapshot: Record<string, DocumentStatus>;
  /** Source IDs removed from evidence (updated version only) */
  removedSourceIds?: string[];
  /** Claim IDs removed from evidence (updated version only) */
  removedClaimIds?: string[];
  /** Evidence change event attached when status becomes EVIDENCE_CHANGED */
  evidenceChange?: EvidenceEvent;
  isMock?: boolean;
}

// ─── Conversation ─────────────────────────────────────────────────────────────
export interface Conversation {
  id: string;
  title: string;
  /** 'current' | 'before-retraction' */
  snapshot: string;
  answers: Answer[];
  keptVersions: string[];
}

// ─── Retraction / evidence event ─────────────────────────────────────────────
export interface EvidenceEvent {
  id?: string;
  sourceId: string;
  detectedAt: string;
  noticeDate: string;
  previousStatus: DocumentStatus;
  currentStatus: DocumentStatus;
}

// ─── Chat claim (extends Claim with multi-source support) ─────────────────────
// In chat, claims can reference multiple sources.
export interface ChatClaim extends Omit<Claim, 'sourceId'> {
  /** All source IDs supporting this claim */
  sourceIds: string[];
  quote?: string;
}

// ─── Evidence context ─────────────────────────────────────────────────────────
export interface EvidenceContext {
  sources: Document[];
  usable: Document[];
  excluded: Document[];
  snapshot: string;
}

// ─── Evidence result (for inspector) ─────────────────────────────────────────
export interface EvidenceResult {
  answer: Answer;
  context: EvidenceContext;
  claims: (ChatClaim & { sources: Document[] })[];
  sources: Document[];
}

// ─── Generation pending state ─────────────────────────────────────────────────
export interface GenerationPending {
  kind: 'generate' | 'regenerate';
  question: string;
  answerId: string | null;
  stage: string;
  error: string | null;
  cancelled: boolean;
  preview?: boolean;
}

// ─── Demo state options ───────────────────────────────────────────────────────
export type ChatDemoState =
  | 'normal'
  | 'empty'
  | 'loading'
  | 'insufficient'
  | 'evidence'
  | 'historical'
  | 'regenerating'
  | 'updated'
  | 'failure';
