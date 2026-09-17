/**
 * pdfExtract.ts — thin wrapper around pdf-parse.
 *
 * Isolated here so the rest of the codebase can mock this module in tests
 * without triggering pdf-parse's internal test-file side-effect.
 */
import pdfParse from "pdf-parse";

export interface PdfData {
  text: string;
  info: Record<string, string>;
}

export async function extractPdfData(buffer: Buffer): Promise<PdfData> {
  const result = await pdfParse(buffer);
  return {
    text: result.text ?? "",
    info: (result.info ?? {}) as Record<string, string>,
  };
}
