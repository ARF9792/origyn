/**
 * MobileLineageList — responsive lineage list fallback.
 * Shown via CSS at ≤1050px, hidden at desktop.
 * Faithful port of Astra Pass 3 LineageList() component.
 */

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { SourceStatusBadge } from '@/components/ui/SourceStatusBadge';
import { ClaimBadge } from '@/components/ui/ClaimBadge';
import { isAffected } from '@/lib/graph-service';
import { NODE_TYPES } from '@/lib/graph-types';
import type { InternalGraphData, GraphViewState, GraphInternalNode } from '@/lib/graph-types';
import type { DocumentStatus, ClaimStatus, AnswerStatus } from '@/lib/types';

// ─── Inline status per node type ──────────────────────────────────────────────
function NodeStatusInline({ node }: { node: GraphInternalNode }) {
  if (node.type === 'document') {
    return <SourceStatusBadge status={node.status as DocumentStatus} />;
  }
  if (node.type === 'claim') {
    return <ClaimBadge status={node.status as ClaimStatus} />;
  }
  const status = node.status as AnswerStatus;
  const label: Record<string, string> = {
    CURRENT:          'Current evidence',
    EVIDENCE_CHANGED: 'Evidence changed',
    INSUFFICIENT:     'Unsupported',
  };
  return (
    <span className={`g-status${isAffected(node) ? ' g-warning' : ''}`}>
      <Icon name={status === 'CURRENT' ? 'circlecheck' : 'warning'} />
      {label[status] ?? 'Needs review'}
    </span>
  );
}

interface MobileLineageListProps {
  graph: InternalGraphData;
  state: GraphViewState;
  onSelect: (id: string) => void;
  onResetFilters: () => void;
}

export function MobileLineageList({
  graph,
  state,
  onSelect,
  onResetFilters,
}: MobileLineageListProps) {
  // Empty state when focus has no matching nodes
  if (state.focusIds && !graph.nodes.some((n) => state.focusIds!.has(n.id))) {
    return (
      <div className="g-lineage-list">
        <div className="empty-state">
          <h2>No matching evidence in this focus</h2>
          <p>Clear the filters to see this lineage.</p>
          <button className="button" onClick={onResetFilters}>
            Clear filters
          </button>
        </div>
      </div>
    );
  }

  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

  // Visible nodes: all, or only those in focus set
  const visibleNodes = graph.nodes.filter(
    (n) => !state.focusIds || state.focusIds.has(n.id)
  );

  return (
    <div className="g-lineage-list" aria-label="Evidence lineage list">
      {visibleNodes.map((n) => {
        const typeConfig = NODE_TYPES[n.type];
        const record = n.record as unknown as Record<string, unknown>;
        const isSelected = n.id === state.selected;

        // Parent edges (to this node)
        const parents = graph.edges
          .filter((e) => e.to === n.id)
          .map((e) => nodeMap.get(e.from))
          .filter((p): p is GraphInternalNode => !!p);

        // Child edges (from this node)
        const children = graph.edges
          .filter((e) => e.from === n.id)
          .map((e) => nodeMap.get(e.to))
          .filter((c): c is GraphInternalNode => !!c);

        return (
          <article
            key={n.id}
            className={`g-list-item${state.focusIds && !state.focusIds.has(n.id) ? ' g-dim' : ''}`}
          >
            <button
              data-id={n.id}
              aria-pressed={isSelected}
              onClick={() => onSelect(n.id)}
            >
              <span className="g-node-kicker">
                <Icon name={typeConfig.icon} />
                {typeConfig.label}
                {n.type === 'answer' && ` · v${(record.version as number) ?? 1}`}
                {record.label ? ` · ${record.label as string}` : ''}
              </span>
              <strong>{n.title}</strong>
              <NodeStatusInline node={n} />
            </button>

            {parents.length > 0 && (
              <div className="g-list-relations">
                <span>↑ From</span>
                {parents.map((p) => (
                  <button key={p.id} onClick={() => onSelect(p.id)}>
                    {(p.record as unknown as Record<string, unknown>).label as string | undefined ?? p.title}
                  </button>
                ))}
              </div>
            )}

            {children.length > 0 && (
              <div className="g-list-relations">
                <span>↓ Used by</span>
                {children.map((c) => (
                  <button key={c.id} onClick={() => onSelect(c.id)}>
                    {(c.record as unknown as Record<string, unknown>).label as string | undefined ?? c.title}
                  </button>
                ))}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
