import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getDocument } from "../lib/dynamo";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../lib/s3";
import { config } from "../config";

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
 * GET /documents/{id}/url
 *
 * Generates a presigned S3 URL for viewing/downloading the document's PDF.
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const id = event.pathParameters?.id;

  if (!id) {
    return errorResponse(400, "DOCUMENT_NOT_FOUND", "Document ID is required.");
  }

  let document;
  try {
    document = await getDocument(id);
  } catch (err) {
    console.error(`DynamoDB getDocument error for id ${id}:`, err);
    return errorResponse(502, "INTERNAL_ERROR", "Failed to retrieve document.");
  }

  if (!document) {
    return errorResponse(404, "DOCUMENT_NOT_FOUND", `Document with id '${id}' was not found.`);
  }

  try {
    const command = new GetObjectCommand({
      Bucket: config.s3.bucketName,
      Key: document.s3Key,
      ResponseContentDisposition: `inline; filename="${document.filename}"`,
    });
    
    // URL expires in 1 hour
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ url }),
    };
  } catch (err) {
    console.error(`S3 presign error for document ${id}:`, err);
    return errorResponse(502, "INTERNAL_ERROR", "Failed to generate download URL.");
  }
};
