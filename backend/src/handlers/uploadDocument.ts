import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { v4 as uuidv4 } from "uuid";
import { parseMultipartFile } from "../lib/multipart";
import { uploadToS3 } from "../lib/s3";
import { putDocument, updateDocument } from "../lib/dynamo";
import { identifyPaper } from "../services/paperIdentifier";
import { Document } from "../types/document";

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
 * 1. Parse multipart PDF from request
 * 2. Validate file type and size
 * 3. Generate documentId
 * 4. Upload PDF to S3
 * 5. Create DynamoDB record with status PROCESSING
 * 6. Return the document record
 *
 * DOI extraction and Crossref lookup happen in a later milestone (Step 3+).
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
    // Non-fatal — document is stored; identification defaults to unknown
    identification = { title: null, doi: null, identificationMethod: "unknown" };
  }

  // ── 7. Update DynamoDB with identified metadata ───────────────────────────
  const identifiedAt = new Date().toISOString();
  try {
    await updateDocument(documentId, {
      title: identification.title,
      doi: identification.doi,
      updatedAt: identifiedAt,
    });
  } catch (err) {
    console.error("DynamoDB update (identification) error:", err);
    // Non-fatal — return what we have
  }

  // ── 8. Return enriched document ───────────────────────────────────────────
  const responseDocument: Document = {
    ...document,
    title: identification.title,
    doi: identification.doi,
    updatedAt: identifiedAt,
  };

  return {
    statusCode: 202, // 202 Accepted — Crossref lookup runs in next milestone
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(responseDocument),
  };
};
