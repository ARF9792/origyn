/**
 * Origyn — Graph service layer.
 * TypeScript port of Astra Pass 3 dist/workspace/graph/service.js.
 *
 * Derives graph nodes/edges from EXISTING production services and fixtures:
 *   - chatService (singleton, from lib/chat-service.ts)
 *   - chatClaims, chatSourceIds, CHAT_QUESTION (from lib/chat-mock-data.ts)
 *   - MOCK_DOCUMENTS (indirectly via chatService.context)
 *
 * Does NOT create competing fixture data. All source, claim, and answer
 * records come from the shared production services.
 */

import type { Document, ChatClaim, Answer } from './types';
import { chatService } from './chat-service';
import {
  chatClaims,
  chatSourceIds,
  CHAT_QUESTION,
} from './chat-mock-data';
import type {
  GraphInternalNode,
  GraphInternalEdge,
  InternalGraphData,
  ImpactResult,
  GraphTypeFilter,
  GraphStatusFilter,
  ReplayState,
} from './graph-types';
import { GRAPH_LAYOUT, NODE_TYPES } from './graph-types';

// ─── Status classification ────────────────────────────────────────────────────

export function isAffected(node: GraphInternalNode): boolean {
  return ['RETRACTED', 'AFFECTED', 'UNSUPPORTED', 'PARTIALLY_SUPPORTED', 'EVIDENCE_CHANGED'].includes(
    node.status
  );
}

// ─── BFS traversal ────────────────────────────────────────────────────────────

export function traverse(
  graph: InternalGraphData,
  id: string,
  direction: 'upstream' | 'downstream' = 'downstream'
): Set<string> {
  const seen = new Set<string>([id]);
  const queue: string[] = [id];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of graph.edges) {
      const match =
        direction === 'upstream' ? edge.to === current : edge.from === current;
      const next = direction === 'upstream' ? edge.from : edge.to;
      if (match && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }

  return seen;
}

// ─── Impact computation ───────────────────────────────────────────────────────

export function impactFor(graph: InternalGraphData, id: string): ImpactResult {
  const path = traverse(graph, id);
  const nodes = graph.nodes.filter((n) => path.has(n.id));
  return {
    ids: path,
    sources: nodes.filter((n) => n.type === 'document' && n.status === 'RETRACTED'),
    claims:  nodes.filter((n) => n.type === 'claim'    && isAffected(n)),
    answers: nodes.filter((n) => n.type === 'answer'   && n.status === 'EVIDENCE_CHANGED'),
  };
}

// ─── Visibility filter ────────────────────────────────────────────────────────

interface VisibilityFilters {
  search?: string;
  type?: GraphTypeFilter;
  status?: GraphStatusFilter;
}

export function visibleGraph(
  graph: InternalGraphData,
  { search = '', type = 'all', status = 'all' }: VisibilityFilters = {}
): InternalGraphData {
  const q = search.trim().toLowerCase();
  let ids = new Set<string>(graph.nodes.map((n) => n.id));

  // Search: match and include connected lineage
  if (q) {
    ids = new Set<string>();
    const record = (n: GraphInternalNode) => n.record as unknown as Record<string, unknown>;
    const matchingNodes = graph.nodes.filter((n) => {
      const haystack = [n.title, n.id, record(n).label, record(n).doi, record(n).authors]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
    for (const n of matchingNodes) {
      for (const id of [
        ...Array.from(traverse(graph, n.id, 'upstream')),
        ...Array.from(traverse(graph, n.id)),
      ]) {
        ids.add(id);
      }
    }
  }

  // Type + status filter
  const nodes = graph.nodes.filter((n) => {
    if (!ids.has(n.id)) return false;
    if (type !== 'all' && n.type !== type) return false;
    if (status === 'all') return true;
    if (status === 'current')    return ['ACTIVE', 'SUPPORTED', 'CURRENT'].includes(n.status);
    if (status === 'retracted')  return n.status === 'RETRACTED';
    if (status === 'affected')   return ['AFFECTED', 'PARTIALLY_SUPPORTED', 'EVIDENCE_CHANGED'].includes(n.status);
    if (status === 'unsupported') return ['UNSUPPORTED', 'INSUFFICIENT'].includes(n.status);
    return true;
  });

  const kept = new Set(nodes.map((n) => n.id));
  return {
    ...graph,
    nodes,
    edges: graph.edges.filter((e) => kept.has(e.from) && kept.has(e.to)),
  };
}

// ─── Layout ───────────────────────────────────────────────────────────────────

/** Keep a large workspace navigable by showing one provenance path at a time. */
export function scopedGraph(
  graph: InternalGraphData,
  anchorId: string,
  page: number,
  pageSize = 3
): { graph: InternalGraphData; claimCount: number; pageCount: number; page: number } {
  const anchor = graph.nodes.find((node) => node.id === anchorId);
  if (!anchor) return { graph, claimCount: 0, pageCount: 1, page: 0 };

  const path = anchor.type === 'document'
    ? traverse(graph, anchorId)
    : anchor.type === 'answer'
      ? traverse(graph, anchorId, 'upstream')
      : new Set([
          ...Array.from(traverse(graph, anchorId, 'upstream')),
          ...Array.from(traverse(graph, anchorId)),
        ]);
  const claims = graph.nodes.filter((node) => path.has(node.id) && node.type === 'claim');
  const pageCount = Math.max(1, Math.ceil(claims.length / pageSize));
  const currentPage = Math.min(Math.max(0, page), pageCount - 1);
  const ids = new Set<string>([
    anchorId,
    ...claims.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map((node) => node.id),
  ]);
  const nodeType = new Map(graph.nodes.map((node) => [node.id, node.type]));

  // Bring in the documents and answers adjacent to this page of claims.
  for (const edge of graph.edges) {
    if (ids.has(edge.from) && path.has(edge.to) && nodeType.get(edge.to) !== 'claim') ids.add(edge.to);
    if (ids.has(edge.to) && path.has(edge.from) && nodeType.get(edge.from) !== 'claim') ids.add(edge.from);
  }

  return {
    graph: {
      ...graph,
      nodes: graph.nodes.filter((node) => ids.has(node.id)),
      edges: graph.edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to)),
    },
    claimCount: claims.length,
    pageCount,
    page: currentPage,
  };
}

export function layoutGraph(graph: InternalGraphData): InternalGraphData {
  const totals: Record<string, number> = { document: 0, claim: 0, answer: 0 };
  for (const node of graph.nodes) totals[node.type]++;
  const maxCount = Math.max(...Object.values(totals));
  const count: Record<string, number> = { document: 0, claim: 0, answer: 0 };
  const nodes: GraphInternalNode[] = graph.nodes.map((n) => ({
    ...n,
    x:
      GRAPH_LAYOUT.padding +
      NODE_TYPES[n.type].column * (GRAPH_LAYOUT.nodeWidth + GRAPH_LAYOUT.columnGap),
    y: 58 + (count[n.type]++ + (maxCount - totals[n.type]) / 2) *
      (GRAPH_LAYOUT.nodeHeight + GRAPH_LAYOUT.rowGap),
  }));
  return {
    ...graph,
    nodes,
    width: GRAPH_LAYOUT.width,
    height: Math.max(420, 58 + maxCount * (GRAPH_LAYOUT.nodeHeight + GRAPH_LAYOUT.rowGap)),
  };
}

// ─── Chat deep link ───────────────────────────────────────────────────────────

export function chatLink(
  node: GraphInternalNode,
  { evidence = false }: { evidence?: boolean } = {}
): string {
  const threadId = node.threadId ?? '';
  return (
    `/workspace/chat?conversation=${encodeURIComponent(threadId)}` +
    `&answer=${encodeURIComponent(node.id)}` +
    (evidence ? '&inspect=1' : '')
  );
}

// ─── Graph service factory ────────────────────────────────────────────────────

interface GraphServiceOptions {
  chat?: typeof chatService;
}

export interface LoadOptions {
  sourceId?: string | null;
  answerId?: string | null;
  claimId?: string | null;
  threadId?: string | null;
}

export function createGraphService() {
  async function load({
    sourceId = null,
    answerId = null,
    claimId = null,
    threadId = null,
  }: LoadOptions = {}): Promise<InternalGraphData> {
    const threads = chatService.listConversations();

    // Locate the target thread (by threadId or answerId)
    const target = threads.find(
      (t) =>
        t.id === threadId ||
        t.answers.some((a) => a.id === answerId)
    );

    // Load sources via context (respects before-retraction snapshot)
    const sources: Document[] = target
      ? (await chatService.context(target.id)).sources
      : (await chatService.context(threads[0]?.id ?? '')).sources.concat(
          // Fall back to listing all conversations' sources
        ).filter((_, i, arr) => arr.findIndex(d => d.id === _.id) === i);

    // Flatten answers from relevant threads
    const answers: (Answer & { threadId: string })[] = threads
      .filter((t) =>
        target?.snapshot === 'before-retraction'
          ? t === target
          : t.snapshot !== 'before-retraction' || t === target
      )
      .flatMap((t) => t.answers.map((a) => ({ ...a, threadId: t.id })));

    // Build claim map — prefer chatClaims, supplement with document claims
    const claimMap = new Map<string, ChatClaim>(
      chatClaims.map((c) => [c.id, c])
    );
    for (const s of sources) {
      for (const c of s.claims ?? []) {
        if (!claimMap.has(c.id)) {
          claimMap.set(c.id, { ...c, sourceIds: [s.id] });
        }
      }
    }

    // Determine which claims to include
    const wantedClaims = new Set<string>(answers.flatMap((a) => a.claimIds));
    if (claimId) wantedClaims.add(claimId);

    // If a sourceId is focused but has no answer-referenced claims, include its claims
    if (
      sourceId &&
      !Array.from(wantedClaims).some((id) =>
        (claimMap.get(id)?.sourceIds ?? []).includes(sourceId)
      )
    ) {
      for (const c of Array.from(claimMap.values())) {
        if (c.sourceIds.includes(sourceId)) wantedClaims.add(c.id);
      }
    }

    const claims = Array.from(claimMap.values()).filter((c) => wantedClaims.has(c.id));
    const wantedSources = new Set<string>(claims.flatMap((c) => c.sourceIds));
    if (sourceId) wantedSources.add(sourceId);

    // Build nodes
    const nodes: GraphInternalNode[] = [];
    const ids = new Set<string>();

    // Document nodes
    for (const s of sources) {
      if (wantedSources.has(s.id)) {
        nodes.push({
          id: s.id,
          type: 'document',
          title: s.title ?? s.filename,
          status: s.status,
          record: s,
        });
        ids.add(s.id);
      }
    }

    // Claim nodes
    for (const c of claims) {
      const supporting = sources.filter((s) => c.sourceIds.includes(s.id));
      const activeCount = supporting.filter((s) => s.status === 'ACTIVE').length;
      const status =
        activeCount === c.sourceIds.length
          ? 'SUPPORTED'
          : activeCount > 0
          ? 'PARTIALLY_SUPPORTED'
          : supporting.some((s) => s.status === 'RETRACTED')
          ? 'AFFECTED'
          : 'UNSUPPORTED';

      nodes.push({
        id: c.id,
        type: 'claim',
        title: c.text,
        status,
        record: c,
      });
      ids.add(c.id);
    }

    // Answer nodes
    for (const a of answers) {
      nodes.push({
        id: a.id,
        type: 'answer',
        title: a.question,
        status: a.status,
        record: a,
        threadId: a.threadId,
      });
      ids.add(a.id);
    }

    // Build edges
    const edges: GraphInternalEdge[] = [];
    for (const c of claims) {
      for (const sid of c.sourceIds) {
        if (ids.has(sid)) edges.push({ from: sid, to: c.id, affected: false });
      }
    }
    for (const a of answers) {
      for (const cid of a.claimIds) {
        if (ids.has(cid)) edges.push({ from: cid, to: a.id, affected: false });
      }
    }

    // Mark affected edges
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    for (const edge of edges) {
      const from = nodeMap.get(edge.from);
      const to = nodeMap.get(edge.to);
      edge.affected = !!(from && to && isAffected(from) && isAffected(to));
    }

    const missing =
      (!!sourceId && !ids.has(sourceId)) ||
      (!!answerId && !ids.has(answerId)) ||
      (!!claimId && !ids.has(claimId));

    return {
      nodes,
      edges,
      snapshot: target?.snapshot ?? 'current',
      missing,
    };
  }

  async function startReplay(): Promise<ReplayState> {
    const t = chatService.createConversation({ replay: true });
    const answer = await chatService.generateAnswer(t.id, CHAT_QUESTION);
    return {
      threadId: t.id,
      answerId: answer.id,
      sourceId: chatSourceIds.removed,
    };
  }

  function retract(threadId: string): void {
    chatService.applyRetraction(threadId);
  }

  return { load, startReplay, retract };
}

// ─── Singleton ────────────────────────────────────────────────────────────────
export const graphService = createGraphService();
