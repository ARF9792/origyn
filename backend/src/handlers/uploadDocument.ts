import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { v4 as uuidv4 } from "uuid";
import { parseMultipartFile } from "../lib/multipart";
import { uploadToS3 } from "../lib/s3";
import { putDocument, updateDocument } from "../lib/dynamo";
import { identifyPaper } from "../services/paperIdentifier";
import { checkRetractionStatus } from "../services/crossrefService";
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

/**
 * POST /documents
 *
 * Full synchronous pipeline:
 * 1. Parse + validate multipart PDF
 * 2. Generate document ID
 * 3. Upload PDF to S3
 * 4. Create DynamoDB record (PROCESSING)
 * 5. Identify paper — extract DOI / title from PDF text
 * 6. Crossref retraction lookup (if DOI found)
 * 7. Finalize status: ACTIVE | RETRACTED | UNKNOWN
 * 8. Update DynamoDB with final metadata
 * 9. Return resolved document
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

  // ── 3. Generate IDs ───────────────────────────────────────────────────────
  const documentId = `doc_${uuidv4().replace(/-/g, "").slice(0, 12)}`;
  const s3Key = `uploads/${documentId}.pdf`;
  const now = new Date().toISOString();

  // ── 4. Upload to S3 ───────────────────────────────────────────────────────
  try {
    await uploadToS3(s3Key, parsedFile.buffer, parsedFile.contentType);
  } catch (err) {
    console.error("S3 upload error:", err);
    return errorResponse(502, "UPLOAD_FAILED", "Failed to store the document. Please try again.");
  }

  // ── 5. Write DynamoDB record ──────────────────────────────────────────────
  const document: Document = {
    id: documentId,
    filename: parsedFile.filename,
    s3Key,
    title: null,
    doi: null,
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

  // ── 6. Identify paper (DOI / title) ──────────────────────────────────────
  let identification: Awaited<ReturnType<typeof identifyPaper>>;
  try {
    identification = await identifyPaper(parsedFile.buffer);
  } catch (err) {
    console.error("Paper identification error:", err);
    identification = { title: null, doi: null, identificationMethod: "unknown" };
  }

  // ── 7. Crossref retraction lookup ──────────────────────────────────────
  let finalRetractionStatus: RetractionStatus = "UNKNOWN";
  let retractionNotice = null;
  let crossrefTitle: string | null = null;

  if (identification.doi) {
    try {
      const crossrefResult = await checkRetractionStatus(identification.doi);
      finalRetractionStatus = crossrefResult.retractionStatus;
      retractionNotice = crossrefResult.retractionNotice;
      // Prefer Crossref-resolved title if we didn't get one from the PDF
      crossrefTitle = crossrefResult.title;
    } catch (err) {
      console.error("Crossref lookup error:", err);
      // Non-fatal — falls through to UNKNOWN
    }
  }

  // ── 8. Compute final document status ────────────────────────────────────
  const finalStatus: DocumentStatus =
    finalRetractionStatus === "RETRACTED"
      ? "RETRACTED"
      : finalRetractionStatus === "NONE_FOUND"
        ? "ACTIVE"
        : "UNKNOWN";

  const resolvedTitle = identification.title ?? crossrefTitle ?? null;
  const finalUpdatedAt = new Date().toISOString();

  // ── 9. Update DynamoDB with all final metadata ────────────────────────────
  try {
    await updateDocument(documentId, {
      title: resolvedTitle,
      doi: identification.doi,
      status: finalStatus,
      retractionStatus: finalRetractionStatus,
      retractionNotice,
      updatedAt: finalUpdatedAt,
    });
  } catch (err) {
    console.error("DynamoDB final update error:", err);
    // Non-fatal — document is in S3; return what we have
  }

  // ── 10. Return fully resolved document ─────────────────────────────────────
  const finalDocument: Document = {
    ...document,
    title: resolvedTitle,
    doi: identification.doi,
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
