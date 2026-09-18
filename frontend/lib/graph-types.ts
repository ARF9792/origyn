/**
 * Origyn — Graph view-specific types.
 *
 * Domain types (Document, Claim, ChatClaim, Answer, GraphNode, GraphEdge)
 * are defined in lib/types.ts and reused here.
 *
 * This file contains ONLY types that are specific to the graph view layer:
 * - internal enriched node/edge shapes used by the graph renderer
 * - view state, filters, camera, layout
 * - graph demo/state machine types
 */

import type { Document, ChatClaim, Answer, DocumentStatus, ClaimStatus, AnswerStatus } from './types';

// ─── Graph node status union ───────────────────────────────────────────────────
export type GraphNodeStatusValue = DocumentStatus | ClaimStatus | AnswerStatus;

// ─── Internal enriched graph node ─────────────────────────────────────────────
// Extends the base GraphNode with rich record data needed for rendering.
export interface GraphInternalNode {
  id: string;
  type: 'document' | 'claim' | 'answer';
  title: string;
  status: string;
  /** Raw source record for document nodes */
  record: Document | ChatClaim | (Answer & { threadId?: string });
  /** Thread ID for answer nodes — required for chatLink generation */
  threadId?: string;
  /** Layout position (pixels), set by layoutGraph */
  x?: number;
  y?: number;
}

// ─── Internal enriched graph edge ─────────────────────────────────────────────
export interface GraphInternalEdge {
  from: string;
  to: string;
  /** True when both endpoints are in an affected path */
  affected: boolean;
}

// ─── Computed graph ───────────────────────────────────────────────────────────
export interface InternalGraphData {
  nodes: GraphInternalNode[];
  edges: GraphInternalEdge[];
  /** Snapshot name from the conversation ('current' | 'before-retraction') */
  snapshot: string;
  /** True when a requested node ID was not found in the graph */
  missing: boolean;
  /** Computed canvas width (set by layoutGraph) */
  width?: number;
  /** Computed canvas height (set by layoutGraph) */
  height?: number;
}

// ─── Impact result ────────────────────────────────────────────────────────────
export interface ImpactResult {
  ids: Set<string>;
  sources: GraphInternalNode[];
  claims: GraphInternalNode[];
  answers: GraphInternalNode[];
}

// ─── Graph demo state ─────────────────────────────────────────────────────────
export type GraphDemoState =
  | 'normal'    // Normal workspace lineage
  | 'before'    // Before-retraction replay
  | 'empty'     // No sources in workspace
  | 'loading'   // Loading relationships
  | 'error'     // Loading error
  | 'partial';  // Partial relationships (one answer omitted)

export const GRAPH_DEMO_STATES: [GraphDemoState, string][] = [
  ['normal',  'Workspace lineage'],
  ['before',  'Before retraction'],
  ['empty',   'Empty graph'],
  ['loading', 'Loading relationships'],
  ['error',   'Loading error'],
  ['partial', 'Partial relationships'],
];

// ─── Node type configuration ──────────────────────────────────────────────────
export interface NodeTypeConfig {
  label: string;
  icon: string;
  column: number;
}

export const NODE_TYPES: Record<'document' | 'claim' | 'answer', NodeTypeConfig> = {
  document: { label: 'Document', icon: 'sources', column: 0 },
  claim:    { label: 'Claim',    icon: 'claims',  column: 1 },
  answer:   { label: 'Answer',   icon: 'chat',    column: 2 },
};

// ─── Layout constants ─────────────────────────────────────────────────────────
export const GRAPH_LAYOUT = {
  width:     1020,
  nodeWidth:  264,
  nodeHeight: 152,
  columnGap:   90,
  rowGap:      38,
  padding:     24,
} as const;

// ─── Camera state ─────────────────────────────────────────────────────────────
export interface CameraState {
  x: number;
  y: number;
  z: number;
}

// ─── Replay state ─────────────────────────────────────────────────────────────
export interface ReplayState {
  threadId: string;
  answerId: string;
  sourceId: string;
}

// ─── Graph view filter state ──────────────────────────────────────────────────
export type GraphTypeFilter   = 'all' | 'document' | 'claim' | 'answer';
export type GraphStatusFilter = 'all' | 'current' | 'retracted' | 'affected' | 'unsupported';
export type FocusDirection    = 'upstream' | 'downstream';

// ─── Graph view state ─────────────────────────────────────────────────────────
export interface GraphViewState {
  search:    string;
  type:      GraphTypeFilter;
  status:    GraphStatusFilter;
  demo:      GraphDemoState;
  selected:  string | null;
  focus:     string | null;
  focusIds:  Set<string> | null;
  direction: FocusDirection;
  replay:    ReplayState | null;
  /** Source ID from URL ?source= param */
  sourceId:  string | null;
  /** Answer ID from URL ?answer= param */
  answerId:  string | null;
  /** Claim ID from URL ?claim= param */
  claimId:   string | null;
}

export function defaultViewState(): GraphViewState {
  return {
    search:    '',
    type:      'all',
    status:    'all',
    demo:      'normal',
    selected:  null,
    focus:     null,
    focusIds:  null,
    direction: 'downstream',
    replay:    null,
    sourceId:  null,
    answerId:  null,
    claimId:   null,
  };
}
