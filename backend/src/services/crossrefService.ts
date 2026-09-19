/**
 * crossrefService.ts — isolated Crossref retraction lookup.
 *
 * ALL Crossref API parsing is contained in this module.
 * No raw Crossref response objects escape to route handlers.
 *
 * Rule from shared context:
 *   NONE_FOUND means "no known retraction found in Crossref".
 *   It does NOT mean the science is valid.
 *
 * Crossref polite pool:
 *   Include a contact email in the User-Agent header.
 *   https://api.crossref.org/swagger-ui/index.html#/Polite-pool
 */
import { config } from "../config";
import { RetractionNotice, RetractionStatus } from "../types/document";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface CrossrefResult {
  found: boolean;
  doi: string | null;
  title: string | null;
  retractionStatus: RetractionStatus;
  retractionNotice: RetractionNotice | null;
}

// ─── Internal Crossref API shapes (partial) ───────────────────────────────────

interface CrossrefUpdateEntry {
  DOI?: string;
  type?: string;
  updated?: {
    "date-parts"?: number[][];
    "date-time"?: string;
  };
  label?: string;
}

interface CrossrefWork {
  DOI?: string;
  title?: string[];
  "update-to"?: CrossrefUpdateEntry[];
}

interface CrossrefResponse {
  status?: string;
  message?: CrossrefWork;
}

interface CrossrefListResponse {
  status?: string;
  message?: {
    items?: CrossrefWork[];
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check Crossref for known retraction status of a paper by DOI.
 *
 * @param doi - The normalized DOI string e.g. "10.1038/nature12373"
 * @returns CrossrefResult with retractionStatus and optional notice metadata
 */
export async function checkRetractionStatus(
  doi: string
): Promise<CrossrefResult> {
  const url = `${config.crossref.baseUrl}/works/${encodeURIComponent(doi)}`;

  const userAgent = config.crossref.contactEmail
    ? `Origyn/1.0 (mailto:${config.crossref.contactEmail})`
    : "Origyn/1.0";

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent": userAgent,
        Accept: "application/json",
      },
    });
  } catch (networkErr) {
    console.error(`Crossref network error for DOI ${doi}:`, networkErr);
    return unknownResult(doi);
  }

  // 404 — DOI not in Crossref
  if (response.status === 404) {
    return {
      found: false,
      doi,
      title: null,
      retractionStatus: "UNKNOWN",
      retractionNotice: null,
    };
  }

  if (!response.ok) {
    console.error(`Crossref returned HTTP ${response.status} for DOI ${doi}`);
    return unknownResult(doi);
  }

  let data: CrossrefResponse;
  try {
    data = (await response.json()) as CrossrefResponse;
  } catch (parseErr) {
    console.error(`Crossref JSON parse error for DOI ${doi}:`, parseErr);
    return unknownResult(doi);
  }

  if (data.status !== "ok" || !data.message) {
    console.warn(`Crossref unexpected response shape for DOI ${doi}`);
    return unknownResult(doi);
  }

  const work = data.message;
  const resolvedDoi = work.DOI ?? doi;
  const title = extractTitle(work);

  // ── Retraction check ───────────────────────────────────────────────────────
  const retractionEntry = (work["update-to"] ?? []).find(
    (u) => u.type?.toLowerCase() === "retraction"
  );

  if (retractionEntry) {
    return {
      found: true,
      doi: resolvedDoi,
      title,
      retractionStatus: "RETRACTED",
      retractionNotice: buildNotice(retractionEntry),
    };
  }

  return {
    found: true,
    doi: resolvedDoi,
    title,
    retractionStatus: "NONE_FOUND",
    retractionNotice: null,
  };
}

/**
 * Searches Crossref by title and returns a validated DOI if confidence is high.
 * Returns null if no match, ambiguous match, or network error.
 */
export async function searchByTitle(title: string): Promise<string | null> {
  const url = `${config.crossref.baseUrl}/works?query.title=${encodeURIComponent(
    title
  )}&select=DOI,title,author,issued&rows=3`;

  const userAgent = config.crossref.contactEmail
    ? `Origyn/1.0 (mailto:${config.crossref.contactEmail})`
    : "Origyn/1.0";

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent": userAgent,
        Accept: "application/json",
      },
    });
  } catch (err) {
    console.error("Crossref searchByTitle network error:", err);
    return null; // Safe fallback
  }

  if (!response.ok) {
    console.error(`Crossref searchByTitle returned HTTP ${response.status}`);
    return null;
  }

  let data: CrossrefListResponse;
  try {
    data = (await response.json()) as CrossrefListResponse;
  } catch (err) {
    console.error("Crossref searchByTitle parse error:", err);
    return null;
  }

  const items = data.message?.items ?? [];
  if (items.length === 0) return null;

  // Evaluate candidates
  const candidates = items.map((item) => {
    const candidateTitle = extractTitle(item) ?? "";
    const sim = calculateJaccardSimilarity(title, candidateTitle);
    return { doi: item.DOI, sim, title: candidateTitle };
  });

  // Sort by similarity descending
  candidates.sort((a, b) => b.sim - a.sim);

  const best = candidates[0];
  const threshold = 0.75;

  if (best.sim < threshold) {
    return null; // Not confident enough
  }

  // Check for ambiguity: if the runner-up is within 0.15 of the best score,
  // the result is too close to commit to safely.
  if (candidates.length > 1) {
    const runnerUp = candidates[1];
    if ((best.sim - runnerUp.sim) < 0.15) {
      // Too ambiguous to pick safely
      return null;
    }
  }

  return best.doi ?? null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function unknownResult(doi: string): CrossrefResult {
  return {
    found: false,
    doi,
    title: null,
    retractionStatus: "UNKNOWN",
    retractionNotice: null,
  };
}

function extractTitle(work: CrossrefWork): string | null {
  const titles = work.title;
  if (Array.isArray(titles) && titles.length > 0 && titles[0]) {
    return titles[0];
  }
  return null;
}

function buildNotice(entry: CrossrefUpdateEntry): RetractionNotice {
  const dateParts = entry.updated?.["date-parts"]?.[0];
  const date = dateParts
    ? `${dateParts[0]}-${String(dateParts[1] ?? 1).padStart(2, "0")}-${String(
        dateParts[2] ?? 1
      ).padStart(2, "0")}`
    : (entry.updated?.["date-time"]?.split("T")[0] ?? "unknown");

  return {
    doi: entry.DOI ?? "unknown",
    date,
    source: "crossref",
  };
}

/**
 * Calculates Jaccard similarity between two strings.
 * Normalized by lowercasing, removing punctuation, and splitting on whitespace.
 * Does NOT strip domain words like "review", "volume" etc. — legitimate titles
 * may contain these words and stripping them would damage similarity scores.
 */
function calculateJaccardSimilarity(s1: string, s2: string): number {
  const normalize = (str: string) => {
    return str
      .toLowerCase()
      // Normalize unicode apostrophes and quotes
      .replace(/[\u2018\u2019\u201c\u201d]/g, "")
      // Strip punctuation, keeping word chars and spaces
      .replace(/[^\w\s]/g, " ")
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0);
  };

  const set1 = new Set(normalize(s1));
  const set2 = new Set(normalize(s2));

  if (set1.size === 0 || set2.size === 0) return 0;

  let intersection = 0;
  for (const word of set1) {
    if (set2.has(word)) {
      intersection++;
    }
  }

  const union = set1.size + set2.size - intersection;
  return intersection / union;
}
