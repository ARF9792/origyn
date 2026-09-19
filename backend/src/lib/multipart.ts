import Busboy from "busboy";
import { APIGatewayProxyEvent } from "aws-lambda";

export interface ParsedFile {
  filename: string;
  buffer: Buffer;
  contentType: string;
}

/**
 * Parse the first file from a multipart/form-data Lambda event.
 *
 * API Gateway passes the body as a base64-encoded string when
 * `isBase64Encoded: true`. This function decodes it and streams
 * it through busboy to extract the uploaded file.
 */
export function parseMultipartFile(
  event: APIGatewayProxyEvent
): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    const contentType =
      event.headers["content-type"] || event.headers["Content-Type"] || "";

    if (!contentType.includes("multipart/form-data")) {
      return reject(new Error("Expected multipart/form-data content type"));
    }

    const bb = Busboy({ headers: { "content-type": contentType } });

    bb.on(
      "file",
      (
        _fieldname: string,
        file: NodeJS.ReadableStream,
        info: { filename: string; mimeType: string }
      ) => {
        const chunks: Buffer[] = [];
        file.on("data", (chunk: Buffer) => chunks.push(chunk));
        file.on("end", () => {
          resolve({
            filename: info.filename || "upload.pdf",
            buffer: Buffer.concat(chunks),
            contentType: info.mimeType || "application/pdf",
          });
        });
        file.on("error", reject);
      }
    );

    bb.on("error", reject);
    bb.on("finish", () => {
      // Resolve with a default if no file field was found
      reject(new Error("No file field found in multipart body"));
    });

    const body = event.isBase64Encoded
      ? Buffer.from(event.body ?? "", "base64")
      : Buffer.from(event.body ?? "", "utf-8");

    bb.write(body);
    bb.end();
  });
}
