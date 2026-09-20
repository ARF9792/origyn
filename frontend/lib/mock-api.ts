/**
 * Origyn — mock API implementation.
 * Simulates the Day 1 API contract in memory.
 * No network calls, no PDF retention, no browser storage.
 * Used when NEXT_PUBLIC_API_MODE=mock (default).
 */

import type {
  Document,
  DocumentSummary,
  DocumentsResponse,
  GraphData,
  UploadOptions,
  ApiErrorCode,
} from './types';
import { MOCK_DOCUMENTS, ANALYSIS_STAGES } from './mock-data';
import { getWorkspaceId } from './workspace';

// In-memory store — partitioned by workspace so signups do not share state
const sourceStores = new Map<string, Document[]>();

function cloneDocument(doc: Document): Document {
  return {
    ...doc,
    claims: doc.claims.map((claim) => ({ ...claim })),
  };
}

async function getSources(): Promise<Document[]> {
  const workspaceId = await getWorkspaceId();
  if (!sourceStores.has(workspaceId)) {
    sourceStores.set(workspaceId, MOCK_DOCUMENTS.map(cloneDocument));
  }
  return sourceStores.get(workspaceId)!;
}

// ─── Error factory ────────────────────────────────────────────────────────────
function apiError(code: ApiErrorCode, message: string): Error {
  const err = new Error(message) as Error & { code: ApiErrorCode };
  (err as unknown as Record<string, unknown>).code = code;
  return err;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Cancelled', 'AbortError'));
    const onAbort = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')); };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

// ─── getDocuments ─────────────────────────────────────────────────────────────
export async function mockGetDocuments(): Promise<DocumentsResponse> {
  // In Day 1, the mock returns full documents so the table can display authors, usage, etc.
  const sources = await getSources();
  const items = sources as unknown as DocumentSummary[];
  return { items };
}

// ─── getDocument ─────────────────────────────────────────────────────────────
export async function mockGetDocument(id: string): Promise<Document> {
  const sources = await getSources();
  const doc = sources.find((d) => d.id === id);
  if (!doc) throw apiError('DOCUMENT_NOT_FOUND', 'This source is not in the current session.');
  return cloneDocument(doc);
}

// ─── deleteDocument (mock) ───────────────────────────────────────────────────
export async function mockDeleteDocument(id: string): Promise<void> {
  const index = sources.findIndex((d) => d.id === id);
  if (index === -1) throw apiError('DOCUMENT_NOT_FOUND', 'This source is not in the current session.');
  sources[index] = { ...sources[index], status: 'DELETED' };
}

// ─── getDocumentUrl (mock) ───────────────────────────────────────────────────
export async function mockGetDocumentUrl(id: string): Promise<{ url: string }> {
  const doc = sources.find((d) => d.id === id);
  if (!doc) throw apiError('DOCUMENT_NOT_FOUND', 'This source is not in the current session.');
  return { url: '#' }; // Return dummy URL for mock mode
}

// ─── validatePDF (client-side pre-check only) ─────────────────────────────────
export async function mockValidatePDF(file: File): Promise<File> {
  if (!file) throw apiError('INVALID_FILE', 'Choose a PDF to continue.');
  if (!/\.pdf$/i.test(file.name) || file.size === 0)
    throw apiError('INVALID_FILE', 'This file could not be processed as a PDF. Choose a non-empty PDF document.');
  if (file.size > 25 * 1024 * 1024)
    throw apiError('INVALID_FILE', 'This PDF exceeds the 25 MB limit. Choose a smaller document.');
  const signature = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer());
  if (signature !== '%PDF-')
    throw apiError('INVALID_FILE', 'This file does not have a PDF signature. Renaming another file to .pdf does not make it a PDF.');
  return file;
}

// ─── uploadDocument ───────────────────────────────────────────────────────────
export async function mockUploadDocument(
  file: File,
  options: UploadOptions = {}
): Promise<Document> {
  const { outcome = 'success', onStage, signal } = options;

  await mockValidatePDF(file);

  for (const step of ANALYSIS_STAGES) {
    onStage?.(step.id);
    await wait(900, signal);
    if (outcome === 'failure' && step.id === 'checking') {
      throw apiError(
        'CROSSREF_LOOKUP_FAILED',
        'The paper was identified, but scholarly status could not be checked right now.'
      );
    }
  }

  const fixture =
    outcome === 'retracted' ? MOCK_DOCUMENTS[1] :
    outcome === 'unknown'   ? MOCK_DOCUMENTS[2] :
                              MOCK_DOCUMENTS[0];

  const doc: Document = {
    ...fixture,
    claims: fixture.claims.map((c, i) => ({ ...c, id: `doc_demo_${Date.now()}_claim_${i + 1}` })),
    id: `doc_demo_${Date.now()}`,
    filename: file.name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastChecked: new Date().toISOString(),
  };

  // Prepend to the current workspace store
  const sources = await getSources();
  sources.unshift(doc);
  return doc;
}

// ─── getGraph ─────────────────────────────────────────────────────────────────
export async function mockGetGraph(): Promise<GraphData> {
  const sources = await getSources();
  return {
    nodes: sources
      .filter((d) => d.status !== 'PROCESSING')
      .map((d) => ({
        id: d.id,
        type: 'document',
        label: d.title ?? d.filename,
        status: d.status,
      })),
    edges: [],
  };
}

// ─── queryDocuments (client-side filter/sort/search) ─────────────────────────
export function queryDocuments(
  items: Document[],
  { search = '', status = 'ALL', sort = 'recent' }: { search?: string; status?: string; sort?: string } = {}
): Document[] {
  let result = items.filter(
    (d) =>
      ((status === 'ALL' && d.status !== 'DELETED') || d.status === status) &&
      [d.title, d.filename, d.authors, d.doi]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(search.trim().toLowerCase())
  );
  return result.sort((a, b) =>
    sort === 'title'
      ? (a.title ?? a.filename).localeCompare(b.title ?? b.filename)
      : sort === 'year'
      ? (b.year ?? 0) - (a.year ?? 0)
      : (b.createdAt || '').localeCompare(a.createdAt || '')
  );
}

// ─── fixtureForState ─────────────────────────────────────────────────────────
export function fixtureForState(state: string): Document {
  return state === 'retracted' ? { ...MOCK_DOCUMENTS[1] } :
         state === 'unknown'   ? { ...MOCK_DOCUMENTS[2] } :
                                 { ...MOCK_DOCUMENTS[0] };
}
