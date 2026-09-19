/**
 * Origyn — Real-mode graph service.
 *
 * Implements the same load() contract as graph-service.ts using GET /graph.
 *
 * Adaptor rules:
 *   Backend node type: "DOCUMENT" | "CLAIM" | "ANSWER"
 *   → Frontend node type: "document" | "claim" | "answer"
 *
 *   Backend edge: { source, target, type: "SUPPORTS" | "USED_BY" }
 *   → Frontend edge: { from, to, affected: boolean }
 *
 * PROVENANCE RULE:
 *   Edges are PRESERVED even when source/claim/answer status changes.
 *   Edges represent historical provenance, not current validity.
 *   node.status represents current state; edges represent history.
 *
 * Node inspectors are enriched from hydrated documents/answers.
 *
 * startReplay / retract remain mock-only (demo feature, not connected to real mode).
 */

import type {
  Document,
  Answer,
  AnswerStatus,
  BackendAnswer,
} from './types';
import {
  getRawGraph,
  getDocuments,
  getDocument,
  getAnswers,
} from './api';
import type {
  GraphInternalNode,
  GraphInternalEdge,
  InternalGraphData,
  ReplayState,
} from './graph-types';
import { isAffected } from './graph-service';
import type { LoadOptions } from './graph-service';

// ─── Backend → Frontend answer adaptor ───────────────────────────────────────
function adaptAnswer(raw: BackendAnswer): Answer & { threadId: string } {
  const threadId = `conv_${raw.previousAnswerId ? 'chain' : raw.id}`;
  return {
    id: raw.id,
    question: raw.question,
    text: raw.text,
    status: raw.status as AnswerStatus,
    createdAt: raw.createdAt,
    claimIds: raw.claimIds,
    sourceIds: raw.sourceDocumentIds,
    previousVersionId: raw.previousAnswerId,
    updatedVersionId: raw.supersededByAnswerId,
    version: 1,
    evidenceAtGeneration: raw.createdAt,
    sourceStatusSnapshot: {},
    threadId,
  };
}

// ─── Real graph service factory ───────────────────────────────────────────────
export function createRealGraphService() {
  // Cache hydrated records to avoid redundant requests within a load cycle
  let docCache: Map<string, Document> = new Map();
  let answerCache: Map<string, Answer & { threadId: string }> = new Map();

  async function load({
    sourceId = null,
    answerId = null,
    claimId = null,
  }: LoadOptions = {}): Promise<InternalGraphData> {
    // Fetch all data in parallel
    const [rawGraph, { items: docSummaries }, { items: rawAnswers }] =
      await Promise.all([getRawGraph(), getDocuments(), getAnswers()]);

    // Hydrate referenced documents (focus ids + any docs in graph)
    const docIdsInGraph = new Set(
      rawGraph.nodes.filter((n) => n.type === 'DOCUMENT').map((n) => n.id)
    );

    // Always hydrate the focused document
    if (sourceId) docIdsInGraph.add(sourceId);

    // Hydrate documents for claim/source inspection
    const hydrateResults = await Promise.allSettled(
      Array.from(docIdsInGraph).map(async (id) => {
        if (docCache.has(id)) return docCache.get(id)!;
        const doc = await getDocument(id);
        docCache.set(id, doc);
        return doc;
      })
    );

    for (const r of hydrateResults) {
      if (r.status === 'fulfilled') {
        docCache.set(r.value.id, r.value);
      }
    }

    // Build answer cache
    answerCache = new Map(rawAnswers.map((raw) => [raw.id, adaptAnswer(raw)]));

    // Also build a document summary map for nodes not hydrated
    const summaryMap = new Map(docSummaries.map((s) => [s.id, s]));

    // ── Build internal nodes ─────────────────────────────────────────────────
    const nodes: GraphInternalNode[] = [];
    const nodeMap = new Map<string, GraphInternalNode>();

    for (const backendNode of rawGraph.nodes) {
      const type = backendNode.type.toLowerCase() as 'document' | 'claim' | 'answer';
      let record: GraphInternalNode['record'];
      let title = backendNode.label;

      if (type === 'document') {
        const hydrated = docCache.get(backendNode.id);
        const summary = summaryMap.get(backendNode.id);
        record = hydrated ?? (summary as unknown as Document) ?? { id: backendNode.id } as Document;
        title = (hydrated?.title ?? summary?.title ?? backendNode.label) || backendNode.id;
      } else if (type === 'answer') {
        const ans = answerCache.get(backendNode.id);
        record = ans ?? { id: backendNode.id } as Answer & { threadId: string };
        title = ans?.question ?? backendNode.label;
      } else {
        // CLAIM — no separate endpoint; use label from graph
        // Build a minimal ChatClaim-like record
        record = {
          id: backendNode.id,
          text: backendNode.label,
          status: backendNode.status as 'SUPPORTED' | 'UNSUPPORTED',
          sourceIds: [],
        } as any;
        title = backendNode.label;
      }

      const node: GraphInternalNode = {
        id: backendNode.id,
        type,
        title,
        status: backendNode.status,
        record,
        ...(type === 'answer' && answerCache.has(backendNode.id)
          ? { threadId: (answerCache.get(backendNode.id) as any).threadId }
          : {}),
      };

      nodes.push(node);
      nodeMap.set(node.id, node);
    }

    // ── Build internal edges (preserve provenance — no filtering by status) ──
    const edges: GraphInternalEdge[] = rawGraph.edges.map((e) => ({
      from: e.source,
      to: e.target,
      affected: false, // will be computed below
    }));

    // Mark affected edges (both endpoints in an affected path)
    for (const edge of edges) {
      const from = nodeMap.get(edge.from);
      const to = nodeMap.get(edge.to);
      edge.affected = !!(from && to && isAffected(from) && isAffected(to));
    }

    // ── Determine missing flag ────────────────────────────────────────────────
    const allIds = new Set(nodes.map((n) => n.id));
    const missing =
      (!!sourceId && !allIds.has(sourceId)) ||
      (!!answerId && !allIds.has(answerId)) ||
      (!!claimId && !allIds.has(claimId));

    return {
      nodes,
      edges,
      snapshot: 'current',
      missing,
    };
  }


  // startReplay and retract are mock-only demo features
  async function startReplay(): Promise<ReplayState> {
    throw new Error('startReplay() is a mock-only demo feature.');
  }

  function retract(_threadId: string): void {
    // no-op in real mode
  }

  return { load, startReplay, retract };
}

// ─── Singleton ────────────────────────────────────────────────────────────────
export const realGraphService = createRealGraphService();
