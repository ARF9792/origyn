/**
 * EvidenceGraph — main graph page orchestrator.
 * TypeScript/React port of Astra Pass 3 controller.js + GraphPage() component.
 *
 * Manages all graph state: camera, view state, inspector, demo states.
 * Reads URL params (?source=, ?answer=, ?claim=, ?direction=) via
 * useSearchParams() inside a Suspense boundary (see page.tsx).
 *
 * Data flows:
 *   graphService.load() → InternalGraphData
 *   → visibleGraph() + layoutGraph()
 *   → GraphCanvas + MobileLineageList + GraphInspector
 */

'use client';

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { GraphControls } from './GraphControls';
import { GraphCanvas } from './GraphCanvas';
import type { GraphCanvasHandle } from './GraphCanvas';
import { GraphInspector } from './GraphInspector';
import { GraphLegend } from './GraphLegend';
import { ImpactSummary } from './ImpactSummary';
import { MobileLineageList } from './MobileLineageList';
import { activeGraphService as graphService } from '@/lib/service-selector';
import { traverse, visibleGraph, layoutGraph, scopedGraph } from '@/lib/graph-service';
import {
  defaultViewState,
} from '@/lib/graph-types';
import type {
  InternalGraphData,
  GraphViewState,
  GraphDemoState,
  CameraState,
  GraphInternalNode,
} from '@/lib/graph-types';

// ─── Announce helper (ARIA live region) ───────────────────────────────────────
function announce(message: string) {
  const el = document.getElementById('announcer');
  if (el) el.textContent = message;
}

// ─── EvidenceGraph ─────────────────────────────────────────────────────────────
export function EvidenceGraph() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // ── State ──────────────────────────────────────────────────────────────────
  const [graph, setGraph]         = useState<InternalGraphData | null>(null);
  const [view,  setView]          = useState<InternalGraphData | null>(null);
  const [state, setState]         = useState<GraphViewState>(() => {
    const s = defaultViewState();
    s.sourceId  = searchParams.get('source');
    s.answerId  = searchParams.get('answer');
    s.claimId   = searchParams.get('claim');
    s.selected  = s.sourceId ?? s.answerId ?? searchParams.get('claim');
    s.focus     = s.selected;
    const dirParam = searchParams.get('direction');
    s.direction = dirParam === 'upstream' || s.answerId ? 'upstream' : 'downstream';
    return s;
  });
  const [camera, setCamera]       = useState<CameraState>({ x: 0, y: 0, z: 1 });
  const [inspectedNode, setInspectedNode] = useState<GraphInternalNode | null>(null);
  const [loading, setLoading]     = useState(true);
  const [pathId, setPathId]       = useState<string | null>(null);
  const [claimPage, setClaimPage] = useState(0);
  const [searchResult, setSearchResult] = useState(0);

  const answers = graph?.nodes.filter((node) => node.type === 'answer').sort((a, b) => {
    const date = (node: GraphInternalNode) =>
      String((node.record as { createdAt?: string }).createdAt ?? '');
    return date(b).localeCompare(date(a));
  }) ?? [];
  const documents = graph?.nodes.filter((node) => node.type === 'document') ?? [];
  const needsFocusedView = (graph?.nodes.length ?? 0) > 30;
  const claimIds = new Set(graph?.nodes.filter((node) => node.type === 'claim').map((node) => node.id) ?? []);
  const connectedAnswers = answers.filter((node) => graph?.edges.some((edge) =>
    edge.to === node.id && claimIds.has(edge.from)
  ));
  const startingAnswer = connectedAnswers.find((node) =>
    node.status === 'CURRENT' &&
    node.title.length >= 65 &&
    /^(what|how|which)\b/i.test(node.title.trim())
  ) ?? connectedAnswers.find((node) =>
    node.title.length >= 65 && /^(what|how|which)\b/i.test(node.title.trim())
  ) ?? connectedAnswers[0];
  const startingDocument = documents.find((node) => graph?.edges.some((edge) =>
    edge.from === node.id && claimIds.has(edge.to)
  )) ?? documents[0];
  const focusedId = state.focus && graph?.nodes.some((node) => node.id === state.focus)
    ? state.focus : null;
  const activePathId = focusedId ?? pathId ??
    (needsFocusedView ? startingAnswer?.id ?? startingDocument?.id ?? null : null);
  const query = state.search.trim().toLowerCase();
  const searchMatches = query ? graph?.nodes.filter((node) => {
    const record = node.record as unknown as Record<string, unknown>;
    return [node.title, node.id, record.label, record.doi, record.authors]
      .filter(Boolean).join(' ').toLowerCase().includes(query);
  }) ?? [] : [];
  const displayedPathId = query
    ? searchMatches[Math.min(searchResult, searchMatches.length - 1)]?.id ?? null
    : activePathId;
  const pathView = graph && displayedPathId ? scopedGraph(graph, displayedPathId, claimPage) : null;

  const canvasRef  = useRef<GraphCanvasHandle>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  // Revision counter — cancel stale async loads
  const revisionRef = useRef(0);

  // ── Load graph data ────────────────────────────────────────────────────────
  const load = useCallback(async (currentState: GraphViewState) => {
    const ticket = ++revisionRef.current;
    setLoading(true);
    try {
      const loaded = await graphService.load({
        sourceId:  currentState.sourceId,
        answerId:  currentState.answerId,
        claimId:   currentState.claimId,
        threadId:  currentState.replay?.threadId ?? null,
      });
      if (ticket !== revisionRef.current) return;
      setGraph(loaded);
    } catch {
      if (ticket !== revisionRef.current) return;
      setGraph({ nodes: [], edges: [], snapshot: 'current', missing: false });
      setState((prev) => ({ ...prev, demo: 'error' }));
    } finally {
      if (ticket === revisionRef.current) setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    load(state);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Recompute filtered + laid-out view whenever graph or filters change ────
  useEffect(() => {
    if (!graph) return;

    // Apply focus traversal
    const nextState = { ...state };
    if (nextState.focus && graph.nodes.some((n) => n.id === nextState.focus)) {
      nextState.focusIds = traverse(graph, nextState.focus, nextState.direction);
    } else {
      nextState.focusIds = null;
    }

    const working = displayedPathId
      ? scopedGraph(graph, displayedPathId, claimPage).graph
      : graph;
    let filtered = visibleGraph(working, nextState);

    // Partial demo: omit one CURRENT answer
    if (nextState.demo === 'partial') {
      const omit = filtered.nodes.find((n) => n.type === 'answer' && n.status === 'CURRENT')?.id;
      if (omit) {
        filtered = {
          ...filtered,
          nodes: filtered.nodes.filter((n) => n.id !== omit),
          edges: filtered.edges.filter((e) => e.to !== omit && e.from !== omit),
        };
      }
    }

    setView(layoutGraph(filtered));
    // Also update focusIds in state if they changed
    if (nextState.focusIds !== state.focusIds) {
      setState(nextState);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, state.search, state.type, state.status, state.focus, state.direction, state.demo, displayedPathId, claimPage]);

  // ── Open inspector when selected node is available on initial deep-link ──
  const didAutoOpen = useRef(false);
  useEffect(() => {
    if (didAutoOpen.current || !graph || !state.selected) return;
    const node = graph.nodes.find((n) => n.id === state.selected);
    if (node) {
      didAutoOpen.current = true;
      setInspectedNode(node);
    }
  }, [graph, state.selected]);

  // ── Actions ────────────────────────────────────────────────────────────────

  function handleSelect(id: string) {
    const node = graph?.nodes.find((n) => n.id === id);
    if (!node) return;
    // Remember the triggering button so we can return focus on close
    triggerRef.current = document.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`);
    setState((prev) => ({ ...prev, selected: id }));
    setInspectedNode(node);
  }

  function handleCloseInspector() {
    setInspectedNode(null);
    setState((prev) => ({ ...prev, selected: null }));
  }

  function handleFocus(id: string, direction: 'upstream' | 'downstream') {
    const node = graph?.nodes.find((n) => n.id === id);
    if (!node) return;
    setClaimPage(0);
    setState((prev) => ({
      ...prev,
      focus: id,
      selected: id,
      direction,
      focusIds: null,
    }));

    // Update URL without navigation
    const url = new URL(window.location.href);
    url.search = '';
    const paramKey = node.type === 'answer' ? 'answer' : node.type === 'document' ? 'source' : 'claim';
    url.searchParams.set(paramKey, id);
    url.searchParams.set('direction', direction);
    window.history.replaceState({}, '', url.toString());

    announce(`${direction} lineage focused.`);
  }

  function handleClearFocus() {
    setClaimPage(0);
    setState((prev) => ({
      ...prev,
      focus: null,
      focusIds: null,
      selected: null,
    }));
    window.history.replaceState({}, '', '/workspace/graph');
    setInspectedNode(null);
  }

  function handleResetFilters() {
    setSearchResult(0);
    setClaimPage(0);
    setState((prev) => ({
      ...prev,
      search: '',
      type: 'all',
      status: 'all',
    }));
  }

  async function handleDemoChange(demo: GraphDemoState) {
    setInspectedNode(null);
    setPathId(null);
    setClaimPage(0);
    const next: GraphViewState = { ...defaultViewState(), demo };

    if (demo === 'before') {
      // Start replay: before-retraction snapshot
      setState({ ...next, demo: 'loading' });
      setLoading(true);
      try {
        const replay = await graphService.startReplay();
        const replayState: GraphViewState = {
          ...defaultViewState(),
          demo: 'before',
          replay,
          sourceId:  replay.sourceId,
          answerId:  replay.answerId,
          focus:     replay.sourceId,
          selected:  replay.sourceId,
          direction: 'downstream',
        };
        setState(replayState);
        await load(replayState);
      } catch {
        setState({ ...defaultViewState(), demo: 'error' });
      }
    } else {
      setState(next);
      await load(next);
    }
  }

  async function handleRetract() {
    if (!state.replay) return;
    graphService.retract(state.replay.threadId);
    setState((prev) => ({ ...prev, replay: null, demo: 'normal' }));
    await load({ ...state, replay: null, demo: 'normal' });
    announce('Retraction applied. Only the downstream affected path is marked.');
  }

  async function handleRetry() {
    setState((prev) => ({ ...prev, demo: 'normal' }));
    await load(state);
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const isBusy      = loading || state.demo === 'loading';
  const showGraph   = !isBusy && !['empty', 'loading', 'error'].includes(state.demo) && (view?.nodes.length ?? 0) > 0;
  const showImpact  = (state.demo === 'normal' || state.demo === 'before' || state.demo === 'partial') && !!state.focus;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <section className="graph-page">
      {/* Controls: title + demo picker + toolbar */}
      <GraphControls
        state={state}
        onSearchChange={(v) => {
          setSearchResult(0);
          setClaimPage(0);
          setState((prev) => ({ ...prev, search: v }));
        }}
        onTypeChange={(v) => setState((prev) => ({ ...prev, type: v }))}
        onStatusChange={(v) => setState((prev) => ({ ...prev, status: v }))}
        onDemoChange={handleDemoChange}
      />

      {process.env.NEXT_PUBLIC_API_MODE !== 'real' && state.replay && (
        <div className="g-replay">
          <span><Icon name="clock" />15 Sep evidence snapshot · source library unchanged</span>
          <button className="button compact" onClick={handleRetract}>
            Apply retraction event
          </button>
        </div>
      )}

      {/* Impact summary */}
      {showImpact && graph && view && (
        <ImpactSummary
          graph={graph}
          state={state}
          onClearFocus={handleClearFocus}
        />
      )}

      {/* Workbench */}
      <div className="g-workbench panel">
        {/* Bar: record count + zoom controls */}
        <div className="g-workbench-bar">
          <span>
            {isBusy
              ? 'Preparing lineage'
              : state.demo === 'empty'
              ? '0 records · 0 relationships'
              : state.demo === 'error'
              ? 'Relationships unavailable'
              : `${view?.nodes.length ?? 0} record${view?.nodes.length === 1 ? '' : 's'} · ${view?.edges.length ?? 0} relationship${view?.edges.length === 1 ? '' : 's'}`}
            {state.demo === 'partial' ? ' · Partial view' : ''}
          </span>
          <div className="g-view-controls" hidden={!showGraph}>
            <button
              className="icon-button"
              aria-label="Zoom out"
              onClick={() => canvasRef.current?.zoomOut()}
            >
              −
            </button>
            <output id="g-zoom" aria-live="polite">100%</output>
            <button
              className="icon-button"
              aria-label="Zoom in"
              onClick={() => canvasRef.current?.zoomIn()}
            >
              +
            </button>
            <button
              className="button quiet compact"
              onClick={() => canvasRef.current?.fit()}
            >
              Fit view
            </button>
          </div>
        </div>

        {showGraph && needsFocusedView && graph && (
          <div className="g-pathbar">
            <div className="g-pathbar-picker">
              <label htmlFor="g-path">{query ? 'Search result' : 'Explore a lineage'}</label>
              <select
                id="g-path"
                value={query ? displayedPathId ?? '' : activePathId ?? ''}
                onChange={(event) => {
                  if (query) {
                    setSearchResult(Math.max(0, searchMatches.findIndex((node) => node.id === event.target.value)));
                    setClaimPage(0);
                    return;
                  }
                  setPathId(event.target.value);
                  setClaimPage(0);
                  setSearchResult(0);
                  setInspectedNode(null);
                  setState((prev) => ({ ...prev, focus: null, selected: null, focusIds: null, search: '' }));
                  window.history.replaceState({}, '', '/workspace/graph');
                }}
              >
                {query ? searchMatches.map((node) => (
                  <option key={node.id} value={node.id}>{node.type === 'document' ? 'Source' : node.type === 'claim' ? 'Claim' : 'Answer'} · {node.title}</option>
                )) : (
                  <>
                    <optgroup label="Answers">
                      {answers.map((node) => <option key={node.id} value={node.id}>{node.title} · {node.status === 'EVIDENCE_CHANGED' ? 'Evidence changed' : node.status === 'CURRENT' ? 'Current' : 'Needs review'} · {node.id.slice(-6)}</option>)}
                    </optgroup>
                    <optgroup label="Sources">
                      {documents.map((node) => <option key={node.id} value={node.id}>{node.title}</option>)}
                    </optgroup>
                  </>
                )}
              </select>
            </div>
            <span className="g-pathbar-context">
              {query
                ? `${searchMatches.length} matching records · ${graph.nodes.length} workspace records`
                : (pathView?.claimCount ?? 0) === 0
                  ? 'No claim links recorded for this path'
                  : `${pathView?.claimCount ?? 0} connected claims · ${graph.nodes.length} workspace records`}
            </span>
            {query && searchMatches.length > 1 && (
              <div className="g-pathbar-pages" aria-label="Search results">
                <button className="button quiet compact" disabled={searchResult === 0} onClick={() => { setSearchResult((index) => index - 1); setClaimPage(0); }}>Previous</button>
                <span>Result {searchResult + 1} of {searchMatches.length}</span>
                <button className="button quiet compact" disabled={searchResult >= searchMatches.length - 1} onClick={() => { setSearchResult((index) => index + 1); setClaimPage(0); }}>Next</button>
              </div>
            )}
            {(pathView?.pageCount ?? 1) > 1 && (
              <div className="g-pathbar-pages" aria-label="Claim pages">
                <button className="button quiet compact" disabled={pathView?.page === 0} onClick={() => setClaimPage((page) => page - 1)}>Previous</button>
                <span>Page {(pathView?.page ?? 0) + 1} of {pathView?.pageCount}</span>
                <button className="button quiet compact" disabled={(pathView?.page ?? 0) >= (pathView?.pageCount ?? 1) - 1} onClick={() => setClaimPage((page) => page + 1)}>Next</button>
              </div>
            )}
          </div>
        )}

        {/* Missing deep-link note */}
        {graph?.missing && (
          <div className="g-note" role="status">
            This linked record is not available in this demo session. Showing the current workspace lineage.
          </div>
        )}

        {/* Partial state note */}
        {state.demo === 'partial' && (
          <div className="g-note" role="alert">
            Some evidence relationships could not be loaded. This view omits one answer and its connections.
            <button className="text-link" onClick={handleRetry}>Retry</button>
          </div>
        )}

        {/* Loading state */}
        {isBusy && (
          <div className="g-loading">
            <p>Loading evidence relationships</p>
            <div>
              <LoadingSkeleton label="Loading evidence relationships" />
              <LoadingSkeleton label="Loading evidence relationships" />
              <LoadingSkeleton label="Loading evidence relationships" />
            </div>
            <button className="button compact" onClick={handleRetry}>
              Return to graph
            </button>
          </div>
        )}

        {/* Error state */}
        {!isBusy && state.demo === 'error' && (
          <>
            <ErrorState
              title="Evidence relationships unavailable"
              message="Some evidence relationships could not be loaded."
            />
            <div className="g-state-action">
              <button className="button" onClick={handleRetry}>
                <Icon name="refresh" />Retry
              </button>
            </div>
          </>
        )}

        {/* Empty state */}
        {!isBusy && state.demo === 'empty' && (
          <EmptyState
            icon="graph"
            title="Your evidence graph starts with a source"
            description="Your evidence graph will appear after Origyn extracts claims from your sources."
          />
        )}

        {/* No results (filters active but nothing matches) */}
        {!isBusy && !['empty', 'error'].includes(state.demo) && view && view.nodes.length === 0 && (
          <div className="empty-state">
            <h2>No matching evidence</h2>
            <p>Try a different title, claim ID or status.</p>
            <button className="button" onClick={handleResetFilters}>
              Clear filters
            </button>
          </div>
        )}

        {/* Canvas (desktop) + Lineage list (mobile) */}
        {showGraph && view && (
          <>
            <GraphCanvas
              ref={canvasRef}
              view={view}
              state={state}
              camera={camera}
              onCameraChange={setCamera}
              onSelect={handleSelect}
            />
            <MobileLineageList
              graph={view}
              state={state}
              onSelect={handleSelect}
              onResetFilters={handleResetFilters}
            />
          </>
        )}

        <GraphLegend />
      </div>

      {/* Footnote */}
      <p className="g-footnote">
        {state.search
          ? 'Search shows each matching record with its connected lineage.'
          : 'A focused view of recorded answer provenance, not the entire source library.'}
        {' '}
        <span className="g-desktop-note">Drag to pan · + / − to zoom · 0 to fit</span>
      </p>

      {/* Inspector dialog */}
      {inspectedNode && graph && (
        <GraphInspector
          graph={graph}
          node={inspectedNode}
          onClose={handleCloseInspector}
          onSelect={(id) => {
            const node = graph.nodes.find((n) => n.id === id);
            if (node) {
              setInspectedNode(node);
              setState((prev) => ({ ...prev, selected: id }));
            }
          }}
          onFocus={handleFocus}
          triggerRef={triggerRef as React.RefObject<HTMLElement | null>}
        />
      )}
    </section>
  );
}
