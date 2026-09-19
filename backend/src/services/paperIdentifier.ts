/**
 * paperIdentifier.ts — identify a research paper from its PDF content.
 *
 * Priority:
 *   1. DOI with explicit prefix (doi: 10.xxx, https://doi.org/10.xxx)  → most reliable
 *   2. Bare DOI pattern anywhere in text                                 → reliable
 *   3. PDF metadata title or first title-shaped line                     → fallback
 *   4. UNKNOWN                                                            → ambiguous
 *
 * Rule: never invent a DOI. Ambiguous → UNKNOWN.
 */
import { extractPdfData } from "../lib/pdfExtract";

// ─── Types ────────────────────────────────────────────────────────────────────

export type IdentificationMethod =
  | "doi_in_pdf"       // DOI found directly in extracted text
  | "title_extracted"  // no DOI, but title identified
  | "unknown";         // could not identify paper reliably

export interface PaperIdentification {
  title: string | null;
  doi: string | null;
  identificationMethod: IdentificationMethod;
}

// ─── Regex ────────────────────────────────────────────────────────────────────

/**
 * Matches DOI with an explicit prefix (doi:, DOI:, https://doi.org/, etc.)
 * Capturing group 1 = the raw DOI (10.XXXX/...)
 */
const DOI_WITH_PREFIX =
  /(?:doi[:\s]+|https?:\/\/(?:dx\.)?doi\.org\/)(10\.\d{4,9}\/[^\s"'<>,;)\]\n]+)/i;

/**
 * Matches a bare DOI anywhere in the text.
 * Slightly stricter than the prefix version to reduce false positives.
 */
const DOI_BARE = /\b(10\.\d{4,9}\/[a-zA-Z0-9\-_.()/:]+)/;

/** Lines that are almost certainly NOT a paper title. */
const NOT_TITLE =
  /^(abstract|introduction|keywords?|references?|doi|received|accepted|published|copyright|volume|vol\.|journal|issn|isbn|correspondence|\d+[\s.])/i;

// ─── Public API ───────────────────────────────────────────────────────────────

export async function identifyPaper(buffer: Buffer): Promise<PaperIdentification> {
  let text = "";
  let info: Record<string, string> = {};

  try {
    const data = await extractPdfData(buffer);
    text = data.text;
    info = data.info;
  } catch {
    // PDF could not be parsed — treat as unknown
    return { title: null, doi: null, identificationMethod: "unknown" };
  }

  // ── 1. DOI with explicit prefix ───────────────────────────────────────────
  const prefixMatch = text.match(DOI_WITH_PREFIX);
  if (prefixMatch) {
    const doi = cleanDoi(prefixMatch[1]);
    return {
      title: extractTitle(text, info),
      doi,
      identificationMethod: "doi_in_pdf",
    };
  }

  // ── 2. Bare DOI ───────────────────────────────────────────────────────────
  const bareMatch = text.match(DOI_BARE);
  if (bareMatch) {
    const doi = cleanDoi(bareMatch[1]);
    return {
      title: extractTitle(text, info),
      doi,
      identificationMethod: "doi_in_pdf",
    };
  }

  // ── 3. Title only ─────────────────────────────────────────────────────────
  const title = extractTitle(text, info);
  if (title) {
    return { title, doi: null, identificationMethod: "title_extracted" };
  }

  // ── 4. Unknown ────────────────────────────────────────────────────────────
  return { title: null, doi: null, identificationMethod: "unknown" };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Strip trailing punctuation that may have been swept up by the regex. */
function cleanDoi(raw: string): string {
  return raw.replace(/[.,;)\]\s]+$/, "").trim();
}

/**
 * Best-effort title extraction.
 *   1. PDF metadata `Title` field if it looks meaningful.
 *   2. First line of extracted text that looks like a title.
 */
function extractTitle(
  text: string,
  info: Record<string, string>
): string | null {
  // 1. Metadata title
  if (info.Title && info.Title.trim().length > 10) {
    return info.Title.trim();
  }

  // 2. Heuristic — first line that:
  //    - is between 15 and 300 characters
  //    - doesn't start with a skip pattern
  const candidate = text
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length >= 15 && l.length <= 300 && !NOT_TITLE.test(l));

  return candidate ?? null;
}
