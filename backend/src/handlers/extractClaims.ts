/**
 * extractClaims.ts
 *
 * POST /documents/{id}/claims/extract
 *
 * Flow:
 *  1. Load Document — reject if missing (404)
 *  2. Reject RETRACTED or INVALID documents (409 DOCUMENT_NOT_USABLE)
 *  3. Idempotency: if claims already exist and ?force=true is not set, return them
 *  4. Read PDF from S3
 *  5. Extract text (reuse existing pdfParse pipeline)
 *  6. Send to Nova 2 Lite via bedrockService
 *  7. Persist claims to origyn-claims
 *  8. Return persisted claims
 *
 * Error codes (per Day 2 API contract):
 *   DOCUMENT_NOT_FOUND
 *   DOCUMENT_NOT_USABLE
 *   PDF_TEXT_EXTRACTION_FAILED
 *   BEDROCK_INFERENCE_FAILED
 *   CLAIM_EXTRACTION_FAILED
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getDocument, listClaimsByDocument, putClaims } from "../lib/dynamo";
import { getFromS3 } from "../lib/s3";
import { extractClaimsFromText } from "../services/bedrockService";
import { Claim } from "../types/document";
import pdfParse from "pdf-parse";
import { getWorkspaceId } from "../lib/workspace";

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

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const id = event.pathParameters?.id;
  const workspaceId = getWorkspaceId(event);
  if (!id) {
    return errorResponse(400, "BAD_REQUEST", "Missing document ID.");
  }

  // Parse ?force=true query param for re-extraction
  const force = event.queryStringParameters?.force === "true";

  // ── 1. Load Document ────────────────────────────────────────────────────────
  let document;
  try {
    document = await getDocument(id, workspaceId);
  } catch (err) {
    console.error(`DynamoDB getDocument error for ${id}:`, err);
    return errorResponse(502, "INTERNAL_ERROR", "Failed to load document.");
  }

  if (!document) {
    return errorResponse(404, "DOCUMENT_NOT_FOUND", `No document with ID ${id}.`);
  }

  // ── 2. Reject unusable documents ────────────────────────────────────────────
  if (document.status === "RETRACTED" || document.status === "INVALID") {
    return errorResponse(
      409,
      "DOCUMENT_NOT_USABLE",
      `Document status is ${document.status}. Only ACTIVE documents can be used for claim extraction.`
    );
  }

  if (document.status === "PROCESSING" || document.status === "UNKNOWN") {
    return errorResponse(
      409,
      "DOCUMENT_NOT_USABLE",
      `Document status is ${document.status}. Claims can only be extracted from ACTIVE documents.`
    );
  }

  // ── 3. Idempotency — return existing claims unless force=true ────────────────
  let existingClaims: Claim[] = [];
  try {
    existingClaims = await listClaimsByDocument(id, workspaceId);
  } catch (err) {
    console.error(`listClaimsByDocument error for ${id}:`, err);
    // Non-fatal: proceed with fresh extraction
  }

  if (existingClaims.length > 0 && !force) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        documentId: id,
        claims: existingClaims,
        cached: true,
      }),
    };
  }

  // ── 4. Read PDF from S3 ─────────────────────────────────────────────────────
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await getFromS3(document.s3Key);
  } catch (err) {
    console.error(`S3 read error for key ${document.s3Key}:`, err);
    return errorResponse(502, "PDF_TEXT_EXTRACTION_FAILED", "Failed to retrieve PDF from storage.");
  }

  // ── 5. Extract text ─────────────────────────────────────────────────────────
  let pdfText: string;
  try {
    const parsed = await pdfParse(pdfBuffer);
    pdfText = parsed.text;
    if (!pdfText || pdfText.trim().length < 50) {
      return errorResponse(422, "PDF_TEXT_EXTRACTION_FAILED", "PDF text extraction returned empty or unusably short text.");
    }
  } catch (err) {
    console.error("PDF parse error:", err);
    return errorResponse(422, "PDF_TEXT_EXTRACTION_FAILED", "Failed to extract text from PDF.");
  }

  // ── 6. Extract claims via Nova 2 Lite ───────────────────────────────────────
  let newClaims: Claim[];
  try {
    newClaims = (await extractClaimsFromText(pdfText, id)).map((claim) => ({
      ...claim,
      workspaceId,
    }));
  } catch (err) {
    console.error("Bedrock claim extraction error:", err);
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("JSON") || message.includes("schema")) {
      return errorResponse(502, "CLAIM_EXTRACTION_FAILED", `Model returned malformed output: ${message}`);
    }
    return errorResponse(502, "BEDROCK_INFERENCE_FAILED", `Bedrock inference failed: ${message}`);
  }

  if (newClaims.length === 0) {
    return errorResponse(422, "CLAIM_EXTRACTION_FAILED", "Model returned no usable claims for this document.");
  }

  // ── 7. Persist claims ───────────────────────────────────────────────────────
  try {
    await putClaims(newClaims);
  } catch (err) {
    console.error("DynamoDB putClaims error:", err);
    return errorResponse(502, "INTERNAL_ERROR", "Claims were extracted but failed to persist. Please retry.");
  }

  // ── 8. Return ───────────────────────────────────────────────────────────────
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({
      documentId: id,
      claims: newClaims,
      cached: false,
    }),
  };
};
