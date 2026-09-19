/**
 * AlertDetail — right-panel inspector dialog for evidence alerts.
 * Faithful port of Astra Pass 4 AlertDetail() from alerts/components.js.
 *
 * Three variants:
 *   RETRACTION — retraction impact detail (doc_002)
 *   UNKNOWN    — source needs review (doc_003, doc_010)
 *   SUPPORTED  — claim remains supported (CL-011)
 *
 * Mark reviewed / Return to needs review are session-only toggles.
 * They do NOT restore sources, change evidence status, or rewrite answers.
 */

'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { ClaimBadge } from '@/components/ui/ClaimBadge';
import { SourceStatusBadge } from '@/components/ui/SourceStatusBadge';
import { answerURL } from '@/lib/evidence-service';
import type { EvidenceAlert } from '@/lib/evidence-service';

interface Props {
  alert: EvidenceAlert | null;
  onClose: () => void;
  onMarkReviewed: (id: string) => void;
  onReopen: (id: string) => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

function AlertReviewBadge({ alert }: { alert: EvidenceAlert }) {
  const isNeeded = alert.reviewStatus === 'NEEDS_REVIEW';
  return (
    <span className={`e-review-badge${isNeeded ? ' e-warning' : ''}`}>
      <Icon name={isNeeded ? 'warning' : 'check'} />
      {isNeeded
        ? 'Needs review'
        : alert.type === 'SUPPORTED'
        ? 'No action needed'
        : 'Reviewed'}
    </span>
  );
}

export function AlertDetail({ alert, onClose, onMarkReviewed, onReopen, triggerRef }: Props) {
  const dialogRef      = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

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

  const retracted = alert?.type === 'RETRACTION';
  const supported = alert?.type === 'SUPPORTED';

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
          <span className="eyebrow">
            {retracted ? 'Impact detail' : 'Evidence change'}
          </span>
          <h2 id="e-detail-title">
            {alert ? alert.title : 'Record not available'}
          </h2>
        </div>
        <button
          ref={closeButtonRef}
          className="icon-button"
          aria-label="Close impact detail"
          onClick={handleClose}
        >
          <Icon name="close" />
        </button>
      </header>

      <div className="e-inspector-body">
        {!alert ? (
          <p>
            This record may belong to an earlier session. Return to the list to
            inspect current evidence.
          </p>
        ) : (
          <>
            <span className="mono e-id">{alert.id}</span>

            {/* Title: claim label for SUPPORTED, source title otherwise */}
            <h3 className="e-impact-title">
              {supported && alert.claim
                ? `${alert.claim.label} · ${alert.claim.text}`
                : alert.source.title ?? alert.source.filename}
            </h3>

            {/* Status badge */}
            {supported && alert.claim ? (
              <ClaimBadge status={alert.claim.status} />
            ) : (
              <SourceStatusBadge status={alert.source.status} />
            )}

            {/* Impact summary box */}
            <div className="e-impact-summary">
              <Icon name={retracted ? 'warning' : supported ? 'circlecheck' : 'unknown'} />
              <div>
                <h3>
                  {retracted
                    ? `${alert.claims.length + alert.answers.length} downstream items in recorded Chat lineage`
                    : supported
                    ? 'Current support remains'
                    : 'Identification needs review'}
                </h3>
                <p>
                  {retracted
                    ? `${alert.claims.length} affected claim${alert.claims.length === 1 ? '' : 's'} · ${alert.answers.length} historical answer${alert.answers.length === 1 ? '' : 's'}. Its supporting source is now retracted.`
                    : supported
                    ? `The retraction of ${alert.source.title ?? alert.source.filename} does not remove this claim's independent supporting evidence. ${alert.claim?.sources?.[0]?.title ?? 'Current workspace evidence'} remains available.`
                    : 'Origyn could not confidently verify this source. Review its identity and scholarly metadata before using it as current evidence.'}
                </p>
              </div>
            </div>

            {/* Metadata */}
            <dl className="e-detail-metadata">
              <div>
                <dt>Detected</dt>
                <dd>
                  18 Sep 2026{supported ? ', 08:41 UTC' : ', 08:40 UTC'}
                </dd>
              </div>
              {retracted && (
                <div>
                  <dt>Notice date</dt>
                  <dd>
                    {alert.source.retractionNotice?.date ?? 'Not recorded'}
                  </dd>
                </div>
              )}
              <div>
                <dt>Review state</dt>
                <dd>
                  <AlertReviewBadge alert={alert} />
                </dd>
              </div>
            </dl>

            {/* Top-level actions */}
            <div className="e-detail-actions">
              <Link
                href={`/workspace/sources/${encodeURIComponent(alert.source.id)}`}
                className="button compact"
              >
                Open {supported ? 'changed source' : 'source'}{' '}
                <Icon name="external" />
              </Link>
              {retracted && (
                <Link
                  href={`/workspace/graph?source=${encodeURIComponent(alert.source.id)}`}
                  className="button compact"
                >
                  <Icon name="graph" />
                  View evidence graph
                </Link>
              )}
              {supported && alert.claim && (
                <Link
                  href={`/workspace/claims?claim=${encodeURIComponent(alert.claim.id)}`}
                  className="button compact"
                >
                  Open claim <Icon name="arrow" />
                </Link>
              )}
            </div>

            {/* RETRACTION: affected claims + historical answers */}
            {retracted && (
              <>
                <section className="e-detail-section">
                  <h3>
                    Claims <span>{alert.claims.length}</span>
                  </h3>
                  {alert.claims.map((c) => (
                    <article key={c.id} className="e-impact-claim">
                      <div>
                        <span className="mono">{c.label}</span>
                        <ClaimBadge status={c.status} />
                      </div>
                      <p>{c.text}</p>
                      <p className="caption">
                        Its supporting source is now retracted. Retained for provenance.
                      </p>
                      <div className="e-detail-actions">
                        <Link
                          href={`/workspace/claims?claim=${encodeURIComponent(c.id)}`}
                          className="text-link"
                        >
                          Open claim <Icon name="arrow" />
                        </Link>
                        <Link
                          href={`/workspace/graph?claim=${encodeURIComponent(c.id)}&direction=downstream`}
                          className="text-link"
                        >
                          Open graph
                        </Link>
                      </div>
                    </article>
                  ))}
                </section>

                <section className="e-detail-section">
                  <h3>
                    Historical answers <span>{alert.answers.length}</span>
                  </h3>
                  {alert.answers.length > 0 ? (
                    <>
                      {alert.answers.map((a) => (
                        <article key={a.id} className="e-answer">
                          <span className="mono">{a.id} · v{a.version}</span>
                          <p>{a.question}</p>
                          <div className="e-answer-meta">
                            <span
                              className={`e-answer-status${a.status === 'EVIDENCE_CHANGED' ? ' e-warning' : ''}`}
                            >
                              <Icon
                                name={a.status === 'CURRENT' ? 'circlecheck' : 'warning'}
                              />
                              {a.status === 'EVIDENCE_CHANGED'
                                ? 'Evidence changed · Historical answer'
                                : 'Current evidence'}
                            </span>
                            <Link href={answerURL(a)} className="text-link">
                              {a.status === 'EVIDENCE_CHANGED'
                                ? 'Open historical answer'
                                : 'Open answer'}{' '}
                              <Icon name="arrow" />
                            </Link>
                          </div>
                          {a.updatedVersionId && (
                            <small>
                              Updated version available in Chat. The original is
                              preserved.
                            </small>
                          )}
                        </article>
                      ))}
                      <p className="caption">
                        Open an affected answer in Chat to review its evidence and
                        generate an updated version from remaining evidence. The
                        original stays intact.
                      </p>
                    </>
                  ) : (
                    <p className="e-inline-empty">
                      No recorded Chat answers cite this source.
                    </p>
                  )}
                </section>
              </>
            )}

            {/* SUPPORTED: remaining support */}
            {supported && alert.claim && (
              <section className="e-detail-section">
                <h3>Remaining support</h3>
                {alert.claim.sources.map((s) => (
                  <article key={s.id} className="e-support">
                    <h4>{s.title ?? s.filename}</h4>
                    <SourceStatusBadge status={s.status} />
                    <Link
                      href={`/workspace/sources/${encodeURIComponent(s.id)}`}
                      className="text-link"
                    >
                      Open source <Icon name="external" />
                    </Link>
                  </article>
                ))}
              </section>
            )}

            {/* Mark reviewed / Return to needs review */}
            {!supported ? (
              <div className="e-review-action">
                {alert.reviewStatus === 'RESOLVED' ? (
                  <button
                    className="button compact"
                    onClick={() => onReopen(alert.id)}
                  >
                    <Icon name="refresh" />
                    Return to needs review
                  </button>
                ) : (
                  <button
                    className="button compact"
                    onClick={() => onMarkReviewed(alert.id)}
                  >
                    <Icon name="check" />
                    Mark reviewed
                  </button>
                )}
                <p className="caption">
                  {alert.reviewStatus === 'RESOLVED'
                    ? 'Reviewed in this session. '
                    : 'Records that you inspected this change. '}
                  This does not restore the source or guarantee the conclusions.
                  Review selections reset on reload.
                </p>
              </div>
            ) : (
              <p className="caption">
                No action is needed for this claim. Other downstream knowledge
                from the retracted source still requires review.
              </p>
            )}
          </>
        )}
      </div>
    </dialog>
  );
}
