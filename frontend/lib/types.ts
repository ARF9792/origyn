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
  | 'INVALID'
  | 'DELETED';

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
  | 'DUPLICATE_DOCUMENT'
  | 'NO_USABLE_EVIDENCE'
  | 'PDF_TEXT_EXTRACTION_FAILED'
  | 'CLAIM_EXTRACTION_FAILED'
  | 'INTERNAL_ERROR';

export interface ApiError {
  error: {
    code: ApiErrorCode;
    message: string;
    /** Only present on DUPLICATE_DOCUMENT (HTTP 409) */
    existingDocumentId?: string;
  };
}

// ─── Typed duplicate-document error ──────────────────────────────────────────
export class DuplicateDocumentError extends Error {
  code: 'DUPLICATE_DOCUMENT' = 'DUPLICATE_DOCUMENT';
  existingDocumentId: string;
  constructor(message: string, existingDocumentId: string) {
    super(message);
    this.name = 'DuplicateDocumentError';
    this.existingDocumentId = existingDocumentId;
  }
}

// ─── Backend raw claim (GET /documents/{id} claims array) ─────────────────────
// Backend does NOT expose: excerpt, page, pageNumber
export interface BackendClaim {
  id: string;
  documentId: string;
  sourceDocumentIds: string[];
  text: string;
  status: 'SUPPORTED' | 'UNSUPPORTED';
  createdAt: string;
  updatedAt: string;
}

// ─── Backend raw answer (GET /answers, GET /answers/{id}) ─────────────────────
export interface BackendAnswer {
  id: string;
  question: string;
  text: string;
  claimIds: string[];
  sourceDocumentIds: string[];
  status: 'CURRENT' | 'EVIDENCE_CHANGED';
  previousAnswerId: string | null;
  supersededByAnswerId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Backend chat citation ─────────────────────────────────────────────────────
export interface BackendCitation {
  claimId: string;
  documentId: string;
  claimText: string;
  title: string | null;
  doi: string | null;
}

// ─── Backend POST /chat response ──────────────────────────────────────────────
export interface BackendChatResponse {
  answer: BackendAnswer;
  citations: BackendCitation[];
}

// ─── Backend POST /answers/{id}/regenerate response ───────────────────────────
export interface BackendRegenerateResponse {
  previousAnswer: { id: string; status: 'EVIDENCE_CHANGED' };
  answer: BackendAnswer;
}

// ─── Backend GET /documents/{id}/impact response ─────────────────────────────
export interface BackendImpactResponse {
  documentId: string;
  changed?: boolean;
  status?: string;
  retractionStatus?: string;
  impact: {
    claimIds: string[];
    answerIds: string[];
    claimCount?: number;
    answerCount?: number;
  };
}

// ─── Backend GET /graph node/edge ─────────────────────────────────────────────
export interface BackendGraphNode {
  id: string;
  type: 'DOCUMENT' | 'CLAIM' | 'ANSWER';
  label: string;
  status: string;
}

export interface BackendGraphEdge {
  source: string;
  target: string;
  type: 'SUPPORTS' | 'USED_BY';
}

export interface BackendGraphResponse {
  nodes: BackendGraphNode[];
  edges: BackendGraphEdge[];
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
  DELETED: 'Deleted',
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
  errorCode?: string;
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
