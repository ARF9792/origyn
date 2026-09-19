/**
 * GraphInspector — right-side dialog inspector.
 * Faithful port of Astra Pass 3 GraphInspector() component.
 *
 * Opens as a <dialog> element (modal). Escape and backdrop click dismiss it.
 * Focus is returned to the trigger node button on close.
 * Visually related to the existing Chat EvidenceDrawer.
 *
 * Three variants: document, claim, answer.
 */

'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { SourceStatusBadge } from '@/components/ui/SourceStatusBadge';
import { ClaimBadge } from '@/components/ui/ClaimBadge';
import { traverse, isAffected, chatLink } from '@/lib/graph-service';
import { NODE_TYPES } from '@/lib/graph-types';
import type { InternalGraphData, GraphInternalNode } from '@/lib/graph-types';
import type { DocumentStatus, ClaimStatus, AnswerStatus, Document, ChatClaim, Answer, RetractionNotice } from '@/lib/types';

// ─── Inline node status ────────────────────────────────────────────────────────
function InlineStatus({ node }: { node: GraphInternalNode }) {
  if (node.type === 'document') return <SourceStatusBadge status={node.status as DocumentStatus} />;
  if (node.type === 'claim')    return <ClaimBadge status={node.status as ClaimStatus} />;
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

// ─── Related node button ───────────────────────────────────────────────────────
function RelatedButton({
  node,
  onSelect,
}: {
  node: GraphInternalNode;
  onSelect: (id: string) => void;
}) {
  const record = node.record as unknown as Record<string, unknown>;
  return (
    <button className="g-related" onClick={() => onSelect(node.id)}>
      <span>{(record.label as string | undefined) ?? node.title}</span>
      <InlineStatus node={node} />
      <Icon name="arrow" />
    </button>
  );
}

// ─── Related section ──────────────────────────────────────────────────────────
function RelatedSection({
  label,
  nodes,
  onSelect,
}: {
  label: string;
  nodes: GraphInternalNode[];
  onSelect: (id: string) => void;
}) {
  return (
    <section className="g-inspector-section">
      <h3>
        {label} <span>{nodes.length}</span>
      </h3>
      {nodes.length > 0 ? (
        nodes.map((n) => (
          <RelatedButton key={n.id} node={n} onSelect={onSelect} />
        ))
      ) : (
        <p className="caption">No recorded relationships in this view.</p>
      )}
    </section>
  );
}

// ─── Reason text per node ─────────────────────────────────────────────────────
function ReasonText({
  node,
  affectedSources,
}: {
  node: GraphInternalNode;
  affectedSources: GraphInternalNode[];
}) {
  if (node.type === 'document') {
    if (node.status === 'RETRACTED')
      return <>This source is excluded from current evidence. Its recorded downstream lineage remains available for review.</>;
    if (node.status === 'ACTIVE')
      return <>No retraction was found in this evidence snapshot. This does not evaluate the study&apos;s findings.</>;
    return <>This source is not currently usable as evidence.</>;
  }
  if (node.type === 'claim') {
    if (isAffected(node))
      return <>Supporting evidence is no longer fully usable. The claim is retained for provenance.</>;
    return <>The claim has current supporting evidence in this workspace.</>;
  }
  // answer
  if (node.status === 'EVIDENCE_CHANGED') {
    const sourceNames = affectedSources.map((s) => s.title).join(', ') || 'supporting evidence';
    return <>Evidence changed: {sourceNames} was retracted. The historical answer and its original citations are preserved.</>;
  }
  if (node.status === 'INSUFFICIENT') return <>Unsupported by current workspace evidence.</>;
  return <>This answer records the evidence supplied at generation. Inspect its upstream lineage to see why it was produced.</>;
}

// ─── Main inspector ───────────────────────────────────────────────────────────
interface GraphInspectorProps {
  graph: InternalGraphData;
  node: GraphInternalNode;
  onClose: () => void;
  onSelect: (id: string) => void;
  onFocus: (id: string, direction: 'upstream' | 'downstream') => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

export function GraphInspector({
  graph,
  node,
  onClose,
  onSelect,
  onFocus,
  triggerRef,
}: GraphInspectorProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Traversal
  const upstream   = traverse(graph, node.id, 'upstream');
  const downstream = traverse(graph, node.id);

  // Edge-based relatives
  const parents  = graph.edges.filter((e) => e.to   === node.id).map((e) => graph.nodes.find((n) => n.id === e.from)).filter((n): n is GraphInternalNode => !!n);
  const children = graph.edges.filter((e) => e.from === node.id).map((e) => graph.nodes.find((n) => n.id === e.to  )).filter((n): n is GraphInternalNode => !!n);

  // Upstream sources and downstream answers
  const sources  = graph.nodes.filter((n) => upstream.has(n.id)   && n.type === 'document');
  const answers  = graph.nodes.filter((n) => downstream.has(n.id) && n.type === 'answer');
  const affectedSources = sources.filter((s) => s.status === 'RETRACTED');

  const record = node.record as unknown as Record<string, unknown>;
  const typeConfig = NODE_TYPES[node.type];

  // Open dialog on mount
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    closeButtonRef.current?.focus();

    // Backdrop click closes
    function onDialogClick(e: MouseEvent) {
      const r = dialog!.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right) {
        handleClose();
      }
    }
    dialog.addEventListener('click', onDialogClick);
    return () => dialog.removeEventListener('click', onDialogClick);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = useCallback(() => {
    dialogRef.current?.close();
    onClose();
    // Return focus to trigger
    if (triggerRef?.current) {
      triggerRef.current.focus({ preventScroll: true });
    }
  }, [onClose, triggerRef]);

  function handleCancel(e: React.SyntheticEvent) {
    e.preventDefault();
    handleClose();
  }

  // Document-specific record fields
  const docRecord = node.type === 'document' ? (node.record as Document) : null;
  const claimRecord = node.type === 'claim' ? (node.record as ChatClaim) : null;
  const ansRecord = node.type === 'answer' ? (node.record as Answer) : null;

  return (
    <dialog
      ref={dialogRef}
      className="g-inspector"
      aria-label={`${typeConfig.label} inspector`}
      onCancel={handleCancel}
    >
      {/* Sticky header */}
      <header className="g-inspector-header">
        <div>
          <span className="eyebrow">Graph inspector · {typeConfig.label}</span>
          <h2>{(record.label as string | undefined) ?? `${typeConfig.label} lineage`}</h2>
        </div>
        <button
          ref={closeButtonRef}
          className="icon-button"
          aria-label="Close graph inspector"
          onClick={handleClose}
        >
          <Icon name="close" />
        </button>
      </header>

      {/* Body */}
      <div className="g-inspector-body">
        <span className="mono g-record-id">{node.id}</span>
        <h3 className="g-inspector-title">{node.title}</h3>

        <InlineStatus node={node} />

        {/* Document metadata */}
        {node.type === 'document' && docRecord && (
          <>
            <p className="g-source-meta">
              {docRecord.authors ?? 'Authors not identified'} · {docRecord.year ?? 'Year unknown'}
            </p>
            <dl className="g-metadata">
              <div>
                <dt>DOI</dt>
                <dd>{docRecord.doi ?? 'Not identified'}</dd>
              </div>
              <div>
                <dt>Last checked</dt>
                <dd>{docRecord.lastChecked ?? 'Not checked'}</dd>
              </div>
              {docRecord.retractionNotice && (
                <>
                  <div>
                    <dt>Retraction detected</dt>
                    <dd>18 Sep 2026</dd>
                  </div>
                  <div>
                    <dt>Notice date</dt>
                    <dd>{(docRecord.retractionNotice as RetractionNotice).date}</dd>
                  </div>
                </>
              )}
            </dl>
          </>
        )}

        {/* Answer metadata */}
        {node.type === 'answer' && ansRecord && (
          <>
            <dl className="g-metadata">
              <div>
                <dt>Generated</dt>
                <dd>{ansRecord.createdAt}</dd>
              </div>
              <div>
                <dt>Evidence snapshot</dt>
                <dd>{ansRecord.evidenceAtGeneration}</dd>
              </div>
              <div>
                <dt>Version</dt>
                <dd>
                  {ansRecord.version}
                  {ansRecord.updatedVersionId ? ' · Updated version available' : ''}
                </dd>
              </div>
            </dl>
            <p className="g-answer-preview">{ansRecord.text}</p>
          </>
        )}

        {/* Claim metadata */}
        {node.type === 'claim' && claimRecord && (
          <>
            <p className="g-source-meta">
              Source excerpt · Page {claimRecord.page ?? '—'}
            </p>
            <blockquote>{claimRecord.quote ?? 'No excerpt recorded.'}</blockquote>
          </>
        )}

        {/* Reason block */}
        <div className="g-reason">
          <Icon name={isAffected(node) ? 'warning' : 'info'} />
          <p>
            <ReasonText node={node} affectedSources={affectedSources} />
          </p>
        </div>

        {/* Actions */}
        <div className="g-inspector-actions">
          {node.type === 'document' && (
            <Link
              href={`/workspace/sources/${encodeURIComponent(node.id)}`}
              className="button compact"
            >
              Open source <Icon name="external" />
            </Link>
          )}
          {node.type === 'claim' && sources.map((s) => (
            <Link
              key={s.id}
              href={`/workspace/sources/${encodeURIComponent(s.id)}`}
              className="button compact"
            >
              Open source <Icon name="external" />
            </Link>
          ))}
          {node.type === 'claim' && (
            <Link
              href={`/workspace/claims?claim=${encodeURIComponent(node.id)}`}
              className="button compact"
            >
              Open claim <Icon name="arrow" />
            </Link>
          )}
          {node.type === 'answer' && (
            <>
              <Link href={chatLink(node)} className="button compact">
                Open in Chat <Icon name="external" />
              </Link>
              <Link href={chatLink(node, { evidence: true })} className="button compact">
                View evidence
              </Link>
            </>
          )}

          {node.type !== 'document' && (
            <button
              className="button compact"
              onClick={() => { onFocus(node.id, 'upstream'); handleClose(); }}
            >
              Focus upstream
            </button>
          )}
          {node.type !== 'answer' && (
            <button
              className="button compact"
              onClick={() => { onFocus(node.id, 'downstream'); handleClose(); }}
            >
              Focus downstream
            </button>
          )}
        </div>

        {/* Related sections */}
        {node.type === 'document' && (
          <>
            <RelatedSection label="Claims derived" nodes={children} onSelect={onSelect} />
            <RelatedSection label="Answers downstream" nodes={answers} onSelect={onSelect} />
          </>
        )}
        {node.type === 'claim' && (
          <>
            <RelatedSection label="Supporting sources" nodes={parents} onSelect={onSelect} />
            <RelatedSection label="Answers using this claim" nodes={children} onSelect={onSelect} />
          </>
        )}
        {node.type === 'answer' && (
          <>
            <RelatedSection label="Claims used" nodes={parents} onSelect={onSelect} />
            <RelatedSection label="Sources used" nodes={sources} onSelect={onSelect} />
          </>
        )}

        <p className="caption">
          Recorded relationships in the focused Chat dataset. Library aggregate counts may include other historical artifacts.
        </p>
      </div>
    </dialog>
  );
}
