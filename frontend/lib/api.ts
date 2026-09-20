/**
 * Origyn — frontend API abstraction layer.
 *
 * Components must ONLY call these functions.
 * No raw backend URLs anywhere else in the codebase.
 *
 * Mode configuration (via environment variables):
 *   NEXT_PUBLIC_API_MODE=mock     → uses in-memory mock (default)
 *   NEXT_PUBLIC_API_MODE=real     → calls the real backend
 *   NEXT_PUBLIC_API_BASE_URL=...  → required when mode=real
 *
 * To integrate the real backend:
 *   1. Set NEXT_PUBLIC_API_MODE=real in .env.local
 *   2. Set NEXT_PUBLIC_API_BASE_URL=https://your-api-gateway-url
 *   3. Verify CORS is configured on the backend
 */

import type {
  Document,
  DocumentsResponse,
  GraphData,
  UploadOptions,
  BackendClaim,
  BackendAnswer,
  BackendChatResponse,
  BackendRegenerateResponse,
  BackendImpactResponse,
  BackendGraphResponse,
} from './types';
import { DuplicateDocumentError } from './types';

import {
  mockGetDocuments,
  mockGetDocument,
  mockUploadDocument,
  mockGetGraph,
  mockValidatePDF,
  mockDeleteDocument,
  mockGetDocumentUrl,
  queryDocuments,
  fixtureForState,
} from './mock-api';

// Re-export client-side helpers that work the same in both modes
export { queryDocuments, fixtureForState };

// ─── Mode detection ───────────────────────────────────────────────────────────
const API_MODE = process.env.NEXT_PUBLIC_API_MODE ?? 'mock';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

export const isMock = API_MODE !== 'real';

// ─── Real API base fetch ──────────────────────────────────────────────────────
async function realFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = new URL(path, API_BASE);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> ?? {}),
  };

  const res = await fetch(url.toString(), {
    ...init,
    headers,
  });

  if (!res.ok) {
    let body: { error?: { code?: string; message?: string; existingDocumentId?: string } } = {};
    try { body = await res.json(); } catch { /* ignore */ }

    const code = body?.error?.code ?? 'INTERNAL_ERROR';
    const message = body?.error?.message ?? `Request failed: ${res.status}`;

    if (code === 'DUPLICATE_DOCUMENT' && body?.error?.existingDocumentId) {
      throw new DuplicateDocumentError(message, body.error.existingDocumentId);
    }

    const err = new Error(message) as Error & { code?: string };
    err.code = code;
    throw err;
  }

  return res.json() as Promise<T>;
}

// ─── Health ───────────────────────────────────────────────────────────────────
export async function checkHealth(): Promise<{ status: string }> {
  if (isMock) return { status: 'ok' };
  return realFetch<{ status: string }>('/health');
}

// ─── uploadDocument ───────────────────────────────────────────────────────────
export async function uploadDocument(file: File, options?: UploadOptions): Promise<Document> {
  if (isMock) return mockUploadDocument(file, options);



  // Client-side size validation.
  // Current architecture: Browser → API Gateway → Lambda (synchronous).
  // Lambda sync payload limit is 6 MB. API Gateway base64-encodes binary bodies
  // before passing to Lambda, so ~4.5 MB raw binary saturates that limit.
  // Advertised and enforced limit is 4 MB with margin.
  const MAX_BYTES = 4 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    const err = new Error('File is too large. Maximum supported size is 4 MB.') as Error & { code?: string };
    err.code = 'INVALID_FILE';
    throw err;
  }

  options?.onStage?.('uploading');

  const formData = new FormData();
  formData.append('file', file);

  const uploadUrl = new URL('/documents', API_BASE);

  const headers: Record<string, string> = {};

  // DO NOT manually set Content-Type — browser sets it with multipart boundary
  const res = await fetch(uploadUrl.toString(), {
    method: 'POST',
    body: formData,
    headers,
    signal: options?.signal,
  });

  if (!res.ok) {
    let body: { error?: { code?: string; message?: string; existingDocumentId?: string } } = {};
    try { body = await res.json(); } catch { /* ignore */ }

    // 413 from API Gateway or Lambda means payload exceeded infrastructure limit.
    if (res.status === 413) {
      const err = new Error('File is too large. Maximum supported size is 4 MB.') as Error & { code?: string };
      err.code = 'INVALID_FILE';
      throw err;
    }

    const code = body?.error?.code ?? 'UPLOAD_FAILED';
    const message = body?.error?.message ?? `Upload failed: ${res.status}`;

    if (code === 'DUPLICATE_DOCUMENT' && body?.error?.existingDocumentId) {
      throw new DuplicateDocumentError(message, body.error.existingDocumentId);
    }

    const err = new Error(message) as Error & { code?: string };
    err.code = code;
    throw err;
  }

  options?.onStage?.('checking');
  const doc = await res.json() as Document;
  options?.onStage?.('done');
  return doc;
}

// ─── getDocuments (lightweight list) ─────────────────────────────────────────
export async function getDocuments(): Promise<DocumentsResponse> {
  if (isMock) return mockGetDocuments();
  const res = await realFetch<DocumentsResponse>('/documents');
  return {
    ...res,
    items: res.items.filter((doc) => doc.status !== 'DELETED'),
  };
}

// ─── getDocument (full detail, returned directly not wrapped) ─────────────────
export async function getDocument(id: string): Promise<Document> {
  if (isMock) return mockGetDocument(id);
  const doc = await realFetch<Document>(`/documents/${encodeURIComponent(id)}`);
  
  try {
    const impactData = await getDocumentImpact(id);
    const impactObj = impactData.impact || (impactData as any);
    doc.usage = {
      claims: doc.claims?.length || impactObj.claimCount || impactObj.claimIds?.length || 0,
      answers: impactObj.answerCount || impactObj.answerIds?.length || 0,
      summaries: 0,
    };
  } catch {
    doc.usage = {
      claims: doc.claims?.length || 0,
      answers: 0,
      summaries: 0,
    };
  }
  
  return doc;
}

// ─── extractClaims ────────────────────────────────────────────────────────────
export interface ExtractClaimsResponse {
  documentId: string;
  claims: BackendClaim[];
  cached: boolean;
}

export async function extractClaims(id: string): Promise<ExtractClaimsResponse> {
  if (isMock) {
    const doc = await mockGetDocument(id);
    return {
      documentId: id,
      claims: doc.claims.map((c) => ({
        id: c.id,
        documentId: id,
        sourceDocumentIds: [id],
        text: c.text,
        status: (c.status === 'AFFECTED' ? 'UNSUPPORTED' : 'SUPPORTED') as 'SUPPORTED' | 'UNSUPPORTED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
      cached: true,
    };
  }
  return realFetch<ExtractClaimsResponse>(
    `/documents/${encodeURIComponent(id)}/claims/extract`,
    { method: 'POST' }
  );
}

// ─── recheckDocument ──────────────────────────────────────────────────────────
export interface RecheckResponse {
  documentId: string;
  changed: boolean;
  status: string;
  retractionStatus: string;
  impact: { claimIds: string[]; answerIds: string[]; claimCount?: number; answerCount?: number };
}

export async function recheckDocument(id: string): Promise<RecheckResponse> {
  if (isMock) {
    return { documentId: id, changed: false, status: 'ACTIVE', retractionStatus: 'NONE_FOUND', impact: { claimIds: [], answerIds: [] } };
  }
  return realFetch<RecheckResponse>(
    `/documents/${encodeURIComponent(id)}/recheck`,
    { method: 'POST' }
  );
}

// ─── invalidateDocument ───────────────────────────────────────────────────────
export async function invalidateDocument(id: string, reason: string): Promise<void> {
  if (isMock) return;
  await realFetch<unknown>(
    `/documents/${encodeURIComponent(id)}/invalidate`,
    { method: 'POST', body: JSON.stringify({ reason }) }
  );
}

// ─── deleteDocument ───────────────────────────────────────────────────────────
export async function deleteDocument(id: string): Promise<void> {
  if (isMock) {
    return mockDeleteDocument(id);
  }
  await realFetch<unknown>(
    `/documents/${encodeURIComponent(id)}`,
    { method: 'DELETE' }
  );
}

// ─── getDocumentUrl ───────────────────────────────────────────────────────────
export async function getDocumentUrl(id: string): Promise<{ url: string }> {
  if (isMock) {
    return mockGetDocumentUrl(id);
  }
  return realFetch<{ url: string }>(`/documents/${encodeURIComponent(id)}/url`);
}

// ─── getDocumentImpact ────────────────────────────────────────────────────────
export async function getDocumentImpact(id: string): Promise<BackendImpactResponse> {
  if (isMock) {
    return { documentId: id, impact: { claimIds: [], answerIds: [] } };
  }
  return realFetch<BackendImpactResponse>(`/documents/${encodeURIComponent(id)}/impact`);
}

// ─── chat ─────────────────────────────────────────────────────────────────────
export async function chatRequest(
  question: string,
  signal?: AbortSignal
): Promise<BackendChatResponse> {
  // Real mode only — mock mode uses chatService.generateAnswer()
  return realFetch<BackendChatResponse>('/chat', {
    method: 'POST',
    body: JSON.stringify({ question }),
    signal,
  });
}

// ─── getAnswers ───────────────────────────────────────────────────────────────
export async function getAnswers(): Promise<{ items: BackendAnswer[] }> {
  if (isMock) return { items: [] };
  return realFetch<{ items: BackendAnswer[] }>('/answers');
}

// ─── getAnswer (returned directly, not wrapped) ───────────────────────────────
export async function getAnswer(id: string): Promise<BackendAnswer> {
  return realFetch<BackendAnswer>(`/answers/${encodeURIComponent(id)}`);
}

// ─── regenerateAnswer ─────────────────────────────────────────────────────────
export async function regenerateAnswerRequest(
  id: string,
  signal?: AbortSignal
): Promise<BackendRegenerateResponse> {
  return realFetch<BackendRegenerateResponse>(
    `/answers/${encodeURIComponent(id)}/regenerate`,
    { method: 'POST', signal }
  );
}

// ─── getGraph ─────────────────────────────────────────────────────────────────
export async function getGraph(): Promise<GraphData> {
  if (isMock) return mockGetGraph();
  const raw = await realFetch<BackendGraphResponse>('/graph');
  return {
    nodes: raw.nodes.map((n) => ({
      id: n.id,
      type: n.type.toLowerCase() as 'document' | 'claim' | 'answer',
      label: n.label,
      status: n.status as any,
    })),
    edges: raw.edges.map((e) => ({
      id: `${e.source}->${e.target}`,
      source: e.source,
      target: e.target,
    })),
  };
}

/** Raw backend graph — used by real-graph-service for full adaption */
export async function getRawGraph(): Promise<BackendGraphResponse> {
  return realFetch<BackendGraphResponse>('/graph');
}

// ─── validatePDF (client-side pre-check) ─────────────────────────────────────
export async function validatePDF(file: File): Promise<File> {
  return mockValidatePDF(file);
}
