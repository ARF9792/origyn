/**
 * GraphNode — individual node card rendered inside the canvas.
 * Faithful port of Astra Pass 3 GraphNode() component.
 *
 * Node types: document, claim, answer.
 * Status uses icon + text label — never color alone.
 */

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { SourceStatusBadge } from '@/components/ui/SourceStatusBadge';
import { ClaimBadge } from '@/components/ui/ClaimBadge';
import { isAffected } from '@/lib/graph-service';
import { NODE_TYPES } from '@/lib/graph-types';
import type { GraphInternalNode } from '@/lib/graph-types';
import type { DocumentStatus, ClaimStatus, AnswerStatus } from '@/lib/types';

// ─── Answer status inline display ─────────────────────────────────────────────
function AnswerStatus({ node }: { node: GraphInternalNode }) {
  const status = node.status as AnswerStatus;
  const label: Record<string, string> = {
    CURRENT:          'Current evidence',
    EVIDENCE_CHANGED: 'Evidence changed',
    INSUFFICIENT:     'Unsupported',
    GENERATING:       'Generating',
  };
  const text = label[status] ?? 'Needs review';
  const affected = isAffected(node);
  return (
    <span className={`g-status${affected ? ' g-warning' : ''}`}>
      <Icon name={status === 'CURRENT' ? 'circlecheck' : 'warning'} />
      {text}
    </span>
  );
}

// ─── Node status per type ──────────────────────────────────────────────────────
function NodeStatus({ node }: { node: GraphInternalNode }) {
  if (node.type === 'document') {
    return <SourceStatusBadge status={node.status as DocumentStatus} />;
  }
  if (node.type === 'claim') {
    return <ClaimBadge status={node.status as ClaimStatus} />;
  }
  return <AnswerStatus node={node} />;
}

// ─── Main node component ───────────────────────────────────────────────────────
interface GraphNodeProps {
  node: GraphInternalNode;
  selected: string | null;
  focusIds: Set<string> | null;
  onSelect: (id: string) => void;
}

export function GraphNodeCard({ node, selected, focusIds, onSelect }: GraphNodeProps) {
  const typeConfig = NODE_TYPES[node.type];
  const affected = isAffected(node);
  const dim = focusIds !== null && !focusIds.has(node.id);
  const isSelected = node.id === selected;

  // Version number kicker for answers
  const record = node.record as unknown as Record<string, unknown>;
  const versionLabel = node.type === 'answer' ? `v${(record.version as number) ?? 1}` : null;
  // Claim label kicker
  const claimLabel = node.type === 'claim' ? (record.label as string | undefined) : null;

  return (
    <button
      className={[
        'g-node',
        `g-${node.type}`,
        affected ? 'g-affected' : '',
        dim ? 'g-dim' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-id={node.id}
      aria-pressed={isSelected}
      aria-label={`${typeConfig.label}: ${node.title}`}
      style={{ left: `${node.x ?? 0}px`, top: `${node.y ?? 0}px` }}
      onClick={() => onSelect(node.id)}
    >
      <span className="g-node-kicker">
        <Icon name={typeConfig.icon} />
        {claimLabel ?? typeConfig.label}
        {versionLabel !== null && <span>{versionLabel}</span>}
      </span>
      <span className="g-node-title">{node.title}</span>
      <span className="g-node-bottom">
        <NodeStatus node={node} />
        {node.type === 'document' && (
          <small>{record.doi ? 'DOI available' : 'DOI not identified'}</small>
        )}
        {node.type === 'answer' && node.status === 'EVIDENCE_CHANGED' && (
          <small>Historical answer</small>
        )}
      </span>
    </button>
  );
}
