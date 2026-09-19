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
const SKIPPABLE_EXACT = /^(abstract|introduction|keywords?|references?|doi|received|accepted|published|copyright|correspondence|research paper|review article|original article|research article)$/i;
const IS_PAGE_NUM = /^\d+$/;
const HAS_VOL_ISSUE = /(volume\s+\d+|vol\.\s*\d+|no\.\s*\d+|issue\s+\d+)/i;
const HAS_ISSN_ISBN = /(issn|isbn)\s*:?\s*[\d-]{8,}/i;
const AUTHOR_AFFILIATION = /\b(university|department|institute|school|college|laboratory|faculty)\b/i;
/**
 * Matches the last word of a title line that strongly suggests the phrase is
 * incomplete and continues on the next line (prepositions, conjunctions, articles).
 */
const INCOMPLETE_ENDING =
  /\b(for|of|on|in|to|and|or|by|at|from|the|a|an|with|between|across|through|into|about|under|over|after|before|during|among|within|without|towards|against|upon|per|as|via|than|nor|but|yet|both|either|neither|whether|while|when|where|which|that|who|whom|whose|how|if|unless|until|since|because|although|though|despite|whereas|its|their|our|this|these|those|such)$/i;

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
 *   2. First line of extracted text that looks like a title (up to 3 lines).
 */
function extractTitle(
  text: string,
  info: Record<string, string>
): string | null {
  // 1. Metadata title
  if (info.Title && info.Title.trim().length > 10) {
    // Make sure metadata title isn't just a generic placeholder like "Microsoft Word - Document1"
    if (!info.Title.toLowerCase().includes("microsoft word") && !info.Title.toLowerCase().includes("untitled")) {
      return info.Title.trim().replace(/\s+/g, ' ');
    }
  }

  // 2. Heuristic multi-line extraction
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];

    if (SKIPPABLE_EXACT.test(l)) continue;
    if (IS_PAGE_NUM.test(l)) continue;
    if (HAS_VOL_ISSUE.test(l)) continue;
    if (HAS_ISSN_ISBN.test(l)) continue;

    // Check length heuristics for first title line
    if (l.length < 15) continue;
    if (l.length > 300) continue;

    // Found a candidate first line
    let title = l;

    // Look ahead to combine up to 2 more lines (multi-line title support).
    // Only continue joining when there is a clear signal that the current line
    // is an incomplete phrase: either it ends with a preposition/conjunction/
    // article (INCOMPLETE_ENDING) or the next line starts with a lowercase
    // letter (PDF layout broke a sentence mid-way through).
    for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
      const currentTail = title;
      const nextLine = lines[j];

      // Stop if the current accumulated title ends with terminal punctuation
      if (/[.?!]$/.test(currentTail.trimEnd())) {
        break;
      }

      // Stop combining if we hit skippable metadata patterns
      if (
        SKIPPABLE_EXACT.test(nextLine) ||
        IS_PAGE_NUM.test(nextLine) ||
        HAS_VOL_ISSUE.test(nextLine) ||
        HAS_ISSN_ISBN.test(nextLine)
      ) {
        break;
      }

      // Stop if it looks like an author affiliation or email
      if (AUTHOR_AFFILIATION.test(nextLine) || nextLine.includes("@")) {
        break;
      }

      // Only join if there is a continuation signal:
      //   (a) current title ends with an incomplete-phrase word, OR
      //   (b) next line starts with a lowercase letter (sentence broken by layout)
      const titleEndsIncomplete = INCOMPLETE_ENDING.test(
        currentTail.trimEnd().split(/\s+/).pop() ?? ""
      );
      const nextLineIsLowercase = /^[a-z]/.test(nextLine);

      if (!titleEndsIncomplete && !nextLineIsLowercase) {
        break; // No continuation signal — stop here
      }

      title += " " + nextLine;
    }

    // Clean up multiple spaces and return
    return title.replace(/\s+/g, " ");
  }

  return null;
}
