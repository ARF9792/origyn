/**
 * ImpactSummary — Impact / blast-radius section.
 * Faithful port of Astra Pass 3 ImpactSummary() component.
 *
 * Only shown when state.focus is set.
 * For doc_002: 1 retracted source · 1 affected claim · 1 affected answer.
 * Impact counts are computed from actual traversed relationships — not hard-coded.
 */

import React from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { impactFor, isAffected, chatLink } from '@/lib/graph-service';
import type { InternalGraphData, GraphViewState, GraphInternalNode } from '@/lib/graph-types';

// ─── Inline answer status ──────────────────────────────────────────────────────
function AnswerStatusInline({ node }: { node: GraphInternalNode }) {
  const affected = isAffected(node);
  const label: Record<string, string> = {
    CURRENT:          'Current evidence',
    EVIDENCE_CHANGED: 'Evidence changed',
    INSUFFICIENT:     'Unsupported',
  };
  return (
    <span className={`g-status${affected ? ' g-warning' : ''}`}>
      <Icon name={node.status === 'CURRENT' ? 'circlecheck' : 'warning'} />
      {label[node.status] ?? 'Needs review'}
    </span>
  );
}

interface ImpactSummaryProps {
  graph: InternalGraphData;
  state: GraphViewState;
  onClearFocus: () => void;
}

export function ImpactSummary({ graph, state, onClearFocus }: ImpactSummaryProps) {
  if (!state.focus) return null;

  const node = graph.nodes.find((n) => n.id === state.focus);
  if (!node) return null;

  // Compute impact
  let impact: { sources: GraphInternalNode[]; claims: GraphInternalNode[]; answers: GraphInternalNode[] };

  if (node.type === 'document') {
    const full = impactFor(graph, node.id);
    impact = {
      sources: full.sources,
      claims:  full.claims,
      answers: full.answers,
    };
  } else {
    // For claim/answer focus: derive from focusIds
    const fids = state.focusIds;
    impact = {
      sources: graph.nodes.filter((n) => fids?.has(n.id) && n.type === 'document' && n.status === 'RETRACTED'),
      claims:  graph.nodes.filter((n) => fids?.has(n.id) && n.type === 'claim'    && isAffected(n)),
      answers: graph.nodes.filter((n) => fids?.has(n.id) && n.type === 'answer'   && n.status === 'EVIDENCE_CHANGED'),
    };
  }

  const hasImpact = impact.sources.length > 0;
  const record = node.record as unknown as Record<string, unknown>;
  const nodeLabel = (record.label as string | undefined) ?? node.title;

  return (
    <section
      className={`g-impact${hasImpact ? ' g-impact-warning' : ''}`}
      aria-label="Impact summary"
    >
      <div>
        <span className="eyebrow">
          {hasImpact ? 'Impact · affected lineage' : 'Focused lineage'}
        </span>
        <h2>{nodeLabel}</h2>
        <p>
          {hasImpact
            ? `${impact.sources.length} retracted source · ${impact.claims.length} affected claim${impact.claims.length === 1 ? '' : 's'} · ${impact.answers.length} affected answer${impact.answers.length === 1 ? '' : 's'}`
            : `${state.focusIds?.size ?? 0} connected records · ${state.direction} evidence`}
        </p>
      </div>

      <button className="button compact" onClick={onClearFocus}>
        <Icon name="close" />
        Clear focus
      </button>

      {impact.answers.length > 0 && (
        <div className="g-impact-answers">
          <span>
            {hasImpact
              ? 'Affected answers'
              : 'Downstream answers needing review · another supporting source changed'}
          </span>
          {impact.answers.map((answerNode) => (
            <Link
              key={answerNode.id}
              href={chatLink(answerNode)}
              className="g-impact-answers-link"
            >
              <span>{answerNode.title}</span>
              <span>
                {answerNode.id} · <AnswerStatusInline node={answerNode} /> · Open in Chat{' '}
                <Icon name="arrow" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
