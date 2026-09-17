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

/** Day 1 optional — Bedrock-extracted claim from a document. */
export interface Claim {
  id: string;
  documentId: string;
  text: string;
  status: "SUPPORTED" | "INVALID";
  createdAt: string;
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
  type: "document" | "claim" | "answer";
  label: string;
  status: DocumentStatus;
}

export interface GraphResponse {
  nodes: GraphNode[];
  edges: { source: string; target: string }[];
}
