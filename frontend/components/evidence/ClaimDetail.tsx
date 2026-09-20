/**
 * ClaimDetail — right-panel inspector dialog.
 * Faithful port of Astra Pass 4 ClaimDetail() from evidence/ui.js.
 *
 * Opens as a <dialog> (.e-inspector). Escape and backdrop click dismiss it.
 * Focus returns to the triggering element on close.
 */

'use client';

import { formatEvidenceDate } from '@/lib/format-evidence-date';
import React, { useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { ClaimBadge } from '@/components/ui/ClaimBadge';
import { SourceStatusBadge } from '@/components/ui/SourceStatusBadge';
import { claimReason, answerURL } from '@/lib/evidence-service';
import type { EvidenceClaim } from '@/lib/evidence-service';

interface Props {
  claim: EvidenceClaim | null;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
  /** If true, scroll to answer-usage section on open */
  scrollToAnswers?: boolean;
}

export function ClaimDetail({ claim, onClose, triggerRef, scrollToAnswers }: Props) {
  const dialogRef     = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const answerSectionRef = useRef<HTMLElement>(null);

  const handleClose = useCallback(() => {
    dialogRef.current?.close();
    onClose();
    if (triggerRef?.current) {
      triggerRef.current.focus({ preventScroll: true });
    }
  }, [onClose, triggerRef]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    closeButtonRef.current?.focus();

    // Scroll to answers if requested
    if (scrollToAnswers) {
      setTimeout(() => {
        answerSectionRef.current?.scrollIntoView({ block: 'start' });
      }, 80);
    }

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

  function handleCancel(e: React.SyntheticEvent) {
    e.preventDefault();
    handleClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="e-inspector"
      aria-labelledby="e-detail-title"
      onCancel={handleCancel}
    >
      {/* Sticky header */}
      <header className="e-inspector-head">
        <div>
          <span className="eyebrow">Evidence · Claim detail</span>
          <h2 id="e-detail-title">
            {claim ? claim.label : 'Record not available'}
          </h2>
        </div>
        <button
          ref={closeButtonRef}
          className="icon-button"
          aria-label="Close claim detail"
          onClick={handleClose}
        >
          <Icon name="close" />
        </button>
      </header>

      <div className="e-inspector-body">
        {!claim ? (
          <p>
            This record may belong to an earlier session. Return to the list to
            inspect current evidence.
          </p>
        ) : (
          <>
            {claim.preview && (
              <div className="e-preview-note">
                Status preview only · existing source and answer records are unchanged.
              </div>
            )}

            <span className="mono e-id">{claim.id}</span>
            <p className="e-claim-text">{claim.text}</p>
            <ClaimBadge status={claim.status} />

            {/* Reason */}
            <div className="e-reason">
              <Icon name={claim.status === 'SUPPORTED' ? 'info' : 'warning'} />
              <p>{claimReason(claim)}</p>
            </div>

            {/* Actions */}
            <div className="e-detail-actions">
              <Link
                href={`/workspace/graph?claim=${encodeURIComponent(claim.id)}&direction=upstream`}
                className="button compact"
              >
                <Icon name="graph" />
                Open in graph
              </Link>
              <Link
                href={`/workspace/graph?claim=${encodeURIComponent(claim.id)}&direction=downstream`}
                className="button compact"
              >
                Focus lineage <Icon name="arrow" />
              </Link>
            </div>

            {/* Supporting sources */}
            <section className="e-detail-section">
              <h3>
                Supporting sources <span>{claim.sources.length}</span>
              </h3>
              {claim.sources.length > 0 ? (
                claim.sources.map((s) => (
                  <article key={s.id} className="e-support">
                    <h4>{s.title ?? s.filename}</h4>
                    <p>{s.authors ?? 'Authors not identified'} · {s.year ?? 'Year unknown'}</p>
                    <SourceStatusBadge status={s.status} />
                    <div className="mono">{s.doi ?? 'DOI not identified'}</div>
                    <Link
                      href={`/workspace/sources/${encodeURIComponent(s.id)}`}
                      className="text-link"
                    >
                      Open source <Icon name="external" />
                    </Link>
                  </article>
                ))
              ) : (
                <p className="e-inline-empty">No supporting sources recorded.</p>
              )}

              {/* Excerpt */}
              <span className="e-field-label">
                Source excerpt{claim.page ? ` · Page ${claim.page}` : ''}
              </span>
              <blockquote>
                {claim.quote ?? 'No excerpt is available for this claim.'}
              </blockquote>
              <p className="caption">Illustrative excerpt · retained for provenance</p>
            </section>

            {/* Answer usage */}
            <section
              className="e-detail-section"
              id="e-answer-usage"
              ref={answerSectionRef}
            >
              <h3>
                Answers using this claim <span>{claim.answers.length}</span>
              </h3>
              {claim.answers.length > 0 ? (
                claim.answers.map((a) => (
                  <article key={a.id} className="e-answer">
                    <span className="mono">{a.id} · v{a.version}</span>
                    <p>{a.question}</p>
                    <div className="e-answer-meta">
                      <span
                        className={`e-answer-status${a.status === 'EVIDENCE_CHANGED' ? ' e-warning' : ''}`}
                      >
                        <Icon name={a.status === 'CURRENT' ? 'circlecheck' : 'warning'} />
                        {a.status === 'EVIDENCE_CHANGED'
                          ? 'Evidence changed · Historical answer'
                          : a.status === 'CURRENT'
                          ? 'Current evidence'
                          : 'Historical answer'}
                      </span>
                      <Link href={answerURL(a)} className="text-link">
                        {a.status === 'EVIDENCE_CHANGED' ? 'Open historical answer' : 'Open answer'}{' '}
                        <Icon name="arrow" />
                      </Link>
                    </div>
                    {a.updatedVersionId && (
                      <small>Updated version available in Chat. The original is preserved.</small>
                    )}
                  </article>
                ))
              ) : (
                <p className="e-inline-empty">
                  No recorded Chat answers use this claim yet.
                </p>
              )}
            </section>

            <p className="caption">
              Last evaluated ·{' '}
              {claim.lastEvaluated
                ? formatEvidenceDate(claim.lastEvaluated)
                : 'Not evaluated yet'}
              . Usage counts reflect recorded Chat answers, including preserved historical versions.
            </p>
          </>
        )}
      </div>
    </dialog>
  );
}
