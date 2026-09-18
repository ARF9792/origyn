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
 *   4. Run a real PDF upload and confirm the response shape matches the contract
 */

import type {
  Document,
  DocumentsResponse,
  GraphData,
  UploadOptions,
} from './types';

import {
  mockGetDocuments,
  mockGetDocument,
  mockUploadDocument,
  mockGetGraph,
  mockValidatePDF,
  queryDocuments,
  fixtureForState,
} from './mock-api';

// Re-export client-side helpers that work the same in both modes
export { queryDocuments, fixtureForState };

// ─── Mode detection ───────────────────────────────────────────────────────────
const API_MODE = process.env.NEXT_PUBLIC_API_MODE ?? 'mock';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

const isMock = API_MODE !== 'real';

// ─── Real API helpers ─────────────────────────────────────────────────────────
async function realFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let body: { error?: { code?: string; message?: string } } = {};
    try { body = await res.json(); } catch { /* ignore */ }
    const message = body?.error?.message ?? `Request failed: ${res.status}`;
    const err = new Error(message) as Error & { code?: string };
    err.code = body?.error?.code ?? 'INTERNAL_ERROR';
    throw err;
  }
  return res.json() as Promise<T>;
}

// ─── uploadDocument ───────────────────────────────────────────────────────────
export async function uploadDocument(file: File, options?: UploadOptions): Promise<Document> {
  if (isMock) return mockUploadDocument(file, options);

  // Real mode: multipart POST
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/documents`, {
    method: 'POST',
    body: formData,
    signal: options?.signal,
  });

  if (!res.ok) {
    let body: { error?: { code?: string; message?: string } } = {};
    try { body = await res.json(); } catch { /* ignore */ }
    const message = body?.error?.message ?? `Upload failed: ${res.status}`;
    const err = new Error(message) as Error & { code?: string };
    err.code = body?.error?.code ?? 'UPLOAD_FAILED';
    throw err;
  }

  return res.json() as Promise<Document>;
}

// ─── getDocuments ─────────────────────────────────────────────────────────────
export async function getDocuments(): Promise<DocumentsResponse> {
  if (isMock) return mockGetDocuments();
  return realFetch<DocumentsResponse>('/documents');
}

// ─── getDocument ──────────────────────────────────────────────────────────────
export async function getDocument(id: string): Promise<Document> {
  if (isMock) return mockGetDocument(id);
  return realFetch<Document>(`/documents/${encodeURIComponent(id)}`);
}

// ─── getGraph ─────────────────────────────────────────────────────────────────
export async function getGraph(): Promise<GraphData> {
  if (isMock) return mockGetGraph();
  return realFetch<GraphData>('/graph');
}

// ─── validatePDF (client-side pre-check) ─────────────────────────────────────
export async function validatePDF(file: File): Promise<File> {
  return mockValidatePDF(file);
}
