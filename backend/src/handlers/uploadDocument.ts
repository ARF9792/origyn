import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { v4 as uuidv4 } from "uuid";
import { parseMultipartFile } from "../lib/multipart";
import { uploadToS3 } from "../lib/s3";
import { putDocument, updateDocument, findDocumentByDoi } from "../lib/dynamo";
import { identifyPaper } from "../services/paperIdentifier";
import { checkRetractionStatus, searchByTitle } from "../services/crossrefService";
import { Document, DocumentStatus, RetractionStatus } from "../types/document";

const ALLOWED_CONTENT_TYPES = ["application/pdf"];
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

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

function normalizeDoi(doi: string): string {
  let normalized = doi.trim().toLowerCase();
  normalized = normalized.replace(/^https?:\/\/doi\.org\//, "");
  normalized = normalized.replace(/^doi:\s*/, "");
  return normalized;
}

/**
 * POST /documents
 *
 * Full synchronous pipeline:
 * 1. Parse + validate multipart PDF
 * 2. Identify paper — extract DOI / title from PDF text
 * 3. Normalize DOI and check for duplicates (409 Conflict)
 * 4. Generate document ID
 * 5. Upload PDF to S3
 * 6. Create DynamoDB record (PROCESSING)
 * 7. Crossref retraction lookup (if DOI found)
 * 8. Finalize status: ACTIVE | RETRACTED | UNKNOWN
 * 9. Update DynamoDB with final metadata
 * 10. Return resolved document
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // ── 1. Parse multipart ────────────────────────────────────────────────────
  let parsedFile: Awaited<ReturnType<typeof parseMultipartFile>>;
  try {
    parsedFile = await parseMultipartFile(event);
  } catch (err) {
    console.error("Multipart parse error:", err);
    return errorResponse(400, "INVALID_FILE", "Could not parse file from request. Send a PDF as multipart/form-data.");
  }

  // ── 2. Validate ───────────────────────────────────────────────────────────
  if (!ALLOWED_CONTENT_TYPES.includes(parsedFile.contentType)) {
    return errorResponse(400, "INVALID_FILE", "Only PDF files are accepted.");
  }

  if (parsedFile.buffer.length > MAX_SIZE_BYTES) {
    return errorResponse(413, "INVALID_FILE", "File exceeds the 20 MB limit.");
  }

  if (parsedFile.buffer.length === 0) {
    return errorResponse(400, "INVALID_FILE", "Uploaded file is empty.");
  }

  // ── 3. Identify paper (DOI / title) ──────────────────────────────────────
  let identification: Awaited<ReturnType<typeof identifyPaper>>;
  try {
    identification = await identifyPaper(parsedFile.buffer);
  } catch (err) {
    console.error("Paper identification error:", err);
    identification = { title: null, doi: null, identificationMethod: "unknown" };
  }

  // ── 4. Crossref Title Fallback & Normalize DOI ────────────────────────────
  if (!identification.doi && identification.title) {
    try {
      const fallbackDoi = await searchByTitle(identification.title);
      if (fallbackDoi) {
        identification.doi = fallbackDoi;
        identification.identificationMethod = "crossref_title_search" as any;
      }
    } catch (err) {
      console.error("Crossref title fallback error:", err);
      // Fall through, leaves doi as null
    }
  }

  let normalizedDoi: string | null = null;
  if (identification.doi) {
    normalizedDoi = normalizeDoi(identification.doi);
    try {
      // Re-importing dynamically or using the imported findDocumentByDoi
      const existingDoc = await findDocumentByDoi(normalizedDoi);
      if (existingDoc) {
        return {
          statusCode: 409,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({
            error: {
              code: "DUPLICATE_DOCUMENT",
              message: "A document with this DOI already exists.",
              existingDocumentId: existingDoc.id
            }
          }),
        };
      }
    } catch (err) {
      console.error("DynamoDB duplicate check error:", err);
      // Fall through on DB read error
    }
  }

  // ── 5. Generate IDs ───────────────────────────────────────────────────────
  const documentId = `doc_${uuidv4().replace(/-/g, "").slice(0, 12)}`;
  const s3Key = `uploads/${documentId}.pdf`;
  const now = new Date().toISOString();

  // ── 6. Upload to S3 ───────────────────────────────────────────────────────
  try {
    await uploadToS3(s3Key, parsedFile.buffer, parsedFile.contentType);
  } catch (err) {
    console.error("S3 upload error:", err);
    return errorResponse(502, "UPLOAD_FAILED", "Failed to store the document. Please try again.");
  }

  // ── 7. Write DynamoDB record ──────────────────────────────────────────────
  const document: Document = {
    id: documentId,
    filename: parsedFile.filename,
    s3Key,
    title: null,
    doi: normalizedDoi, // Use normalized DOI here
    status: "PROCESSING",
    retractionStatus: "UNKNOWN",
    retractionNotice: null,
    claims: [],
    createdAt: now,
    updatedAt: now,
  };

  try {
    await putDocument(document);
  } catch (err) {
    console.error("DynamoDB write error:", err);
    return errorResponse(502, "INTERNAL_ERROR", "Document stored in S3 but failed to create record. Contact support.");
  }

  // ── 8. Crossref retraction lookup ──────────────────────────────────────
  let finalRetractionStatus: RetractionStatus = "UNKNOWN";
  let retractionNotice = null;
  let crossrefTitle: string | null = null;

  if (normalizedDoi) {
    try {
      const crossrefResult = await checkRetractionStatus(normalizedDoi);
      finalRetractionStatus = crossrefResult.retractionStatus;
      retractionNotice = crossrefResult.retractionNotice;
      // Prefer Crossref-resolved title if we didn't get one from the PDF
      crossrefTitle = crossrefResult.title;
    } catch (err) {
      console.error("Crossref lookup error:", err);
      // Non-fatal — falls through to UNKNOWN
    }
  }

  // ── 9. Compute final document status ────────────────────────────────────
  //
  // PATH A — DOI PRESENT: status directly mirrors the Crossref retraction result.
  //   RETRACTED   → formally retracted by Crossref
  //   ACTIVE      → Crossref confirmed no retraction (NONE_FOUND)
  //   UNKNOWN     → DOI present but Crossref was unreachable / returned ambiguous data
  //
  // PATH B — NO DOI: document is a local source (private report, whitepaper, etc.).
  //   status          = ACTIVE   (document is usable as evidence)
  //   retractionStatus = UNKNOWN  (formal retraction verification is not possible)
  //
  // "No DOI" is NOT the same as "invalid document". It only means that
  // Crossref-based scholarly retraction verification cannot be performed.
  let finalStatus: DocumentStatus;
  if (normalizedDoi) {
    // DOI path — preserve existing Crossref-driven logic exactly
    finalStatus =
      finalRetractionStatus === "RETRACTED"
        ? "RETRACTED"
        : finalRetractionStatus === "NONE_FOUND"
          ? "ACTIVE"
          : "UNKNOWN";
  } else {
    // No-DOI path — document is usable; retraction simply cannot be verified
    finalStatus = "ACTIVE";
  }

  // Filename-derived fallback: strip .pdf extension and replace hyphens/underscores
  // with spaces so "remote-work-study-2026.pdf" becomes "remote-work-study-2026".
  // Only used when neither the PDF nor Crossref yielded a title.
  const filenameFallback = parsedFile.filename
    .replace(/\.pdf$/i, "")
    .replace(/[-_]+/g, " ")
    .trim() || null;
  const resolvedTitle = identification.title ?? crossrefTitle ?? filenameFallback;
  const finalUpdatedAt = new Date().toISOString();

  // ── 10. Update DynamoDB with all final metadata ────────────────────────────
  try {
    await updateDocument(documentId, {
      title: resolvedTitle,
      doi: normalizedDoi, // Use normalized DOI here as well
      status: finalStatus,
      retractionStatus: finalRetractionStatus,
      retractionNotice,
      updatedAt: finalUpdatedAt,
    });
  } catch (err) {
    console.error("DynamoDB final update error:", err);
    // Non-fatal — document is in S3; return what we have
  }

  // ── 11. Return fully resolved document ─────────────────────────────────────
  const finalDocument: Document = {
    ...document,
    title: resolvedTitle,
    doi: normalizedDoi,
    status: finalStatus,
    retractionStatus: finalRetractionStatus,
    retractionNotice,
    updatedAt: finalUpdatedAt,
  };

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(finalDocument),
  };
};
