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
  // The `update-to` array on the original paper's record lists all
  // updates; an entry with type === "retraction" means the paper is retracted.
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

  // No retraction entry found
  return {
    found: true,
    doi: resolvedDoi,
    title,
    retractionStatus: "NONE_FOUND",
    retractionNotice: null,
  };
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
  // Extract date from Crossref's nested date-parts array [[YYYY, MM, DD]]
  const dateParts = entry.updated?.["date-parts"]?.[0];
  const date = dateParts
    ? `${dateParts[0]}-${String(dateParts[1] ?? 1).padStart(2, "0")}-${String(dateParts[2] ?? 1).padStart(2, "0")}`
    : (entry.updated?.["date-time"]?.split("T")[0] ?? "unknown");

  return {
    doi: entry.DOI ?? "unknown",
    date,
    source: "crossref",
  };
}
