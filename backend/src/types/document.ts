/**
 * document.ts — core Origyn data types shared across all Lambda handlers.
 *
 * IMPORTANT — status wording rule (from shared context):
 *   NONE_FOUND means "no known retraction found".
 *   It does NOT mean the science is valid.
 *   Never display it as "Valid" in the frontend.
 */

// ─── Document status ──────────────────────────────────────────────────────────

/** Lifecycle status of a document in the Origyn system. */
export type DocumentStatus =
  | "PROCESSING"  // upload received, pipeline running
  | "ACTIVE"      // no known retraction found, usable as evidence
  | "RETRACTED"   // known retraction detected via Crossref or manual flag
  | "UNKNOWN"     // paper could not be identified with confidence
  | "INVALID";    // manually invalidated by the workspace owner

/** Result of a Crossref retraction check. */
export type RetractionStatus =
  | "NONE_FOUND"  // checked Crossref — no retraction record found
  | "RETRACTED"   // Crossref (or Retraction Watch) confirms retraction
  | "UNKNOWN";    // DOI could not be found or Crossref returned ambiguous data

// ─── Retraction notice ────────────────────────────────────────────────────────

export interface RetractionNotice {
  doi: string;
  date: string;   // ISO date string e.g. "2026-01-10"
  source: string; // e.g. "publisher" | "retraction-watch"
}

// ─── Document record ─────────────────────────────────────────────────────────

/** Full document record as stored in DynamoDB and returned by GET /documents/:id */
export interface Document {
  id: string;
  filename: string;
  s3Key: string;
  workspaceId?: string;
  title: string | null;
  doi: string | null;
  status: DocumentStatus;
  retractionStatus: RetractionStatus;
  retractionNotice: RetractionNotice | null;
  claims: Claim[];
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/** Abbreviated document as returned by GET /documents list */
export type DocumentSummary = Pick<
  Document,
  "id" | "filename" | "title" | "doi" | "status" | "retractionStatus"
>;

// ─── Claim ────────────────────────────────────────────────────────────────────

/**
 * ClaimStatus — Day 2 API contract (06_DAY2_API_CONTRACT_ADDENDUM.md).
 * UNSUPPORTED replaces the Day 1 stub value INVALID.
 */
export type ClaimStatus = "SUPPORTED" | "UNSUPPORTED";

/** Bedrock-extracted claim from a document, with full Day 2 provenance fields. */
export interface Claim {
  id: string;
  documentId: string;
  workspaceId?: string;
  /** All source document IDs that support this claim (currently always [documentId]). */
  sourceDocumentIds: string[];
  text: string;
  status: ClaimStatus;
  createdAt: string;
  updatedAt: string;
}

// ─── Answer ───────────────────────────────────────────────────────────────────

export type AnswerStatus = "CURRENT" | "EVIDENCE_CHANGED";

/**
 * Persisted answer produced by Evidence-Locked chat.
 * Stores exact claim and document IDs used so provenance is auditable.
 */
export interface Answer {
  id: string;
  question: string;
  text: string;
  workspaceId?: string;
  claimIds: string[];
  sourceDocumentIds: string[];
  status: AnswerStatus;
  /** ID of the answer this regenerates (null for original answers). */
  previousAnswerId: string | null;
  /** ID of the newer answer that superseded this one (null if still current). */
  supersededByAnswerId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── API response shapes ──────────────────────────────────────────────────────

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

export interface DocumentListResponse {
  items: DocumentSummary[];
}

export interface GraphNode {
  id: string;
  /** Uppercase node types per Day 2 contract (06_DAY2_API_CONTRACT_ADDENDUM.md). */
  type: "DOCUMENT" | "CLAIM" | "ANSWER";
  label: string;
  /** Status drawn from the appropriate type — DocumentStatus | ClaimStatus | AnswerStatus. */
  status: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  /** SUPPORTS: Document→Claim | USED_BY: Claim→Answer */
  type: "SUPPORTS" | "USED_BY";
}

export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ─── Answer list response ─────────────────────────────────────────────────────

export interface AnswerListResponse {
  items: Answer[];
}
