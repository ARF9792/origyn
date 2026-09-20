'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getDocument, extractClaims, recheckDocument, invalidateDocument, deleteDocument, getDocumentUrl } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import { SourceStatusBadge } from '@/components/ui/SourceStatusBadge';
import { ClaimBadge } from '@/components/ui/ClaimBadge';
import { EvidenceChip } from '@/components/ui/EvidenceChip';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import type { Document } from '@/lib/types';

interface Props {
  id: string;
}

export function SourceDetailPanel({ id }: Props) {
  const [doc, setDoc] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isRechecking, setIsRechecking] = useState(false);
  const [isInvalidating, setIsInvalidating] = useState(false);
  const [isInvalidationFormOpen, setIsInvalidationFormOpen] = useState(false);
  const [invalidationReason, setInvalidationReason] = useState('');
  const [invalidationError, setInvalidationError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const fetchDoc = () => {
    getDocument(id)
      .then((res) => {
        setDoc(res);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load document details.');
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchDoc();
  }, [id]);

  const handleExtract = async () => {
    setIsExtracting(true);
    try {
      await extractClaims(id);
      fetchDoc();
    } catch (err: any) {
      setError(err.message || 'Failed to extract claims.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleRecheck = async () => {
    setIsRechecking(true);
    try {
      await recheckDocument(id);
      fetchDoc();
    } catch (err: any) {
      setError(err.message || 'Failed to recheck document.');
    } finally {
      setIsRechecking(false);
    }
  };

  const handleInvalidate = async () => {
    const reason = invalidationReason.trim();
    if (!reason) {
      setInvalidationError('A reason is required.');
      return;
    }
    setIsInvalidating(true);
    setInvalidationError(null);
    try {
      await invalidateDocument(id, reason);
      setIsInvalidationFormOpen(false);
      setInvalidationReason('');
      fetchDoc();
    } catch (err: any) {
      setInvalidationError(err.message || 'Failed to invalidate document.');
    } finally {
      setIsInvalidating(false);
    }
  };

  const cancelInvalidation = () => {
    setIsInvalidationFormOpen(false);
    setInvalidationReason('');
    setInvalidationError(null);
  };

  const handleDelete = async () => {
    const confirm = window.confirm('Are you sure you want to delete this source? This will mark downstream claims as unsupported.');
    if (!confirm) return;
    setIsDeleting(true);
    try {
      await deleteDocument(id);
      router.push('/workspace/sources');
    } catch (err: any) {
      setError(err.message || 'Failed to delete source.');
      setIsDeleting(false);
    }
  };

  const handleView = async () => {
    try {
      const { url } = await getDocumentUrl(id);
      window.open(url, '_blank');
    } catch (err: any) {
      setError(err.message || 'Failed to generate view URL.');
    }
  };

  if (isLoading) return <LoadingSkeleton lines={10} />;
  if (error || !doc) return <ErrorState message={error || 'Document not found.'} />;

  const isRetracted = doc.status === 'RETRACTED' || doc.status === 'INVALID';
  const isUnknown = doc.status === 'UNKNOWN';

  return (
    <>
      <Link href="/workspace/sources" className="back-link">
        <Icon name="back" />
        Library
      </Link>

      <div className="source-detail-heading">
        <div className="detail-kicker">
          <Icon name="sources" />
          <span>Source detail</span>
        </div>
        <h1>{doc.title || doc.filename}</h1>
        {doc.authors && <p>{doc.authors}</p>}
        {(doc.journal || doc.year) && (
          <div className="publication">
            Published in <span>{doc.journal || 'Unknown journal'}</span> ({doc.year || 'Unknown year'})
          </div>
        )}
      </div>

      <div className="detail-actions">
        <SourceStatusBadge status={doc.status} />
        {doc.doi && (
          <>
            <div className="action-divider" />
            <a
              href={`https://doi.org/${doc.doi}`}
              target="_blank"
              rel="noreferrer"
              className="button compact quiet"
            >
              DOI: {doc.doi} <Icon name="external" />
            </a>
          </>
        )}
        <div className="action-divider" />
        <Link href={`/workspace/graph?source=${encodeURIComponent(id)}`} className="button compact quiet">
          <Icon name="graph" /> View in evidence graph
        </Link>
        {process.env.NEXT_PUBLIC_API_MODE === 'real' && (
          <>
            <div className="action-divider" />
            <button className="button compact quiet" onClick={handleRecheck} disabled={isRechecking}>
              <Icon name="refresh" /> {isRechecking ? 'Rechecking...' : 'Recheck status'}
            </button>
            {doc.status !== 'INVALID' && doc.status !== 'DELETED' && (
              <button className="button compact quiet" onClick={() => { setIsInvalidationFormOpen(true); setInvalidationError(null); }} disabled={isInvalidating} style={{ color: '#d92d20' }}>
                <Icon name="warning" /> {isInvalidating ? 'Invalidating...' : 'Invalidate source'}
              </button>
            )}
            {doc.status !== 'DELETED' && (
              <button className="button compact quiet" onClick={handleDelete} disabled={isDeleting} style={{ color: '#d92d20' }}>
                <Icon name="trash" /> {isDeleting ? 'Deleting...' : 'Delete source'}
              </button>
            )}
          </>
        )}
        <div className="action-divider" />
        <button className="button compact quiet" onClick={handleView}>
          <Icon name="external" /> View source
        </button>

      </div>

      {isInvalidationFormOpen && (
        <form className="invalidation-form" onSubmit={(event) => { event.preventDefault(); void handleInvalidate(); }}>
          <label htmlFor="invalidation-reason">Reason for invalidation</label>
          <textarea
            id="invalidation-reason"
            value={invalidationReason}
            onChange={(event) => setInvalidationReason(event.target.value)}
            placeholder="Enter why this source should no longer be trusted"
            rows={2}
            disabled={isInvalidating}
          />
          {invalidationError && <p className="invalidation-error">{invalidationError}</p>}
          <div className="invalidation-actions">
            <button type="button" className="button compact quiet" onClick={cancelInvalidation} disabled={isInvalidating}>Cancel</button>
            <button type="submit" className="button compact" disabled={isInvalidating || !invalidationReason.trim()}>
              {isInvalidating ? 'Invalidating...' : 'Invalidate source'}
            </button>
          </div>
        </form>
      )}

      {isRetracted && doc.retractionNotice && (
        <div className="notice critical-notice">
          <Icon name="warning" />
          <div>
            <h2>Retraction or validity notice issued</h2>
            <p>{doc.retractionNotice.reason}</p>
            <div className="notice-meta">
              <span className="notice-title">{doc.retractionNotice.title}</span><br />
              Issued {new Date(doc.retractionNotice.date).toLocaleDateString()} · Registered via {doc.retractionNotice.source}
            </div>

          </div>
        </div>
      )}

      {isUnknown && (
        <div className="notice uncertain-notice">
          <Icon name="unknown" />
          <div>
            <h2>Scholarly status could not be verified</h2>
            <p>
              Origyn could not definitively match this uploaded document to a known DOI or authoritative metadata record. It has not been checked for retractions.
            </p>

          </div>
        </div>
      )}

      {doc.status === 'PROCESSING' && (
        <div className="notice">
          <Icon name="clock" />
          <div>
            <h2>Source is currently being processed</h2>
            <p>
              Metadata extraction and scholarly verification are ongoing. Claims and downstream evidence tracking will be available shortly.
            </p>
          </div>
        </div>
      )}

      <div className="detail-grid">
        <div className="detail-section">
          <dl className="metadata">
            <div>
              <dt>Library status</dt>
              <dd>
                <SourceStatusBadge status={doc.status} />
              </dd>
            </div>
            <div>
              <dt>Last checked</dt>
              <dd>
                {doc.lastChecked ? new Date(doc.lastChecked).toLocaleString() : 'Pending'}
                <div className="health-disclaimer">
                  <Icon name="info" />
                  <span>
                    "No retraction found" means no notice was found in queried registries (e.g. Crossref) at the time of check. It does not certify the work is error-free or scientifically valid.
                  </span>
                </div>
              </dd>
            </div>
            <div>
              <dt>Identification</dt>
              <dd className="mono">{doc.identificationMethod || 'Pending'}</dd>
            </div>
            <div>
              <dt>Object identifier</dt>
              <dd className="mono">{doc.doi || 'None'}</dd>
            </div>
            <div>
              <dt>Source file</dt>
              <dd className="mono">{doc.filename}</dd>
            </div>
          </dl>

          <div className="claim-list">
            <h2 style={{ marginTop: '45px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              Extracted claims <span className="count-pill">{doc.claims.length}</span>
              {process.env.NEXT_PUBLIC_API_MODE === 'real' && doc.status === 'ACTIVE' && (
                <button className="button compact quiet" onClick={handleExtract} disabled={isExtracting} style={{ marginLeft: 'auto' }}>
                  {isExtracting ? 'Extracting...' : 'Extract claims'}
                </button>
              )}
            </h2>

            {doc.claims.length === 0 ? (
              <div className="inline-empty">
                <h3>No claims extracted</h3>
                <p>No discrete claims have been extracted from this source yet.</p>
              </div>
            ) : (
              doc.claims.map((claim) => (
                <div key={claim.id} className="claim-item">
                  <div className="claim-meta">
                    <span className="mono">{claim.label || claim.id}</span>
                    <ClaimBadge status={claim.status} />
                  </div>
                  <p className="claim-text">{claim.text}</p>
                  
                  {claim.status === 'AFFECTED' && (
                    <div className="claim-warning">
                      <Icon name="warning" /> This claim originates from a retracted source and should not be relied upon.
                    </div>
                  )}

                  <div className="claim-origin">
                    <EvidenceChip source={{ id: doc.id, title: doc.title, filename: doc.filename }} page={claim.page} />
                  </div>

                  <details className="evidence-disclosure">
                    <summary>
                      <Icon name="chevron" /> Source excerpt
                    </summary>
                    <blockquote>{claim.quote || 'No excerpt available.'}</blockquote>
                  </details>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="usage-panel">
          <h3>Downstream usage</h3>
          <p>This source has been referenced in the following workspace artifacts.</p>
          
          <div className="usage-row">
            <Icon name="chat" /> Answers generated
            <b>{doc.usage?.answers || 0}</b>
          </div>
          <div className="usage-row">
            <Icon name="claims" /> Assertions supported
            <b>{doc.usage?.claims || 0}</b>
          </div>
          <Link href={`/workspace/graph?source=${encodeURIComponent(id)}`} className="button full-width">
            View evidence lineage
          </Link>

          {isRetracted && (doc.usage?.answers || 0) > 0 && (
            <div className="usage-warning">
              <Icon name="warning" />
              <div>
                This source was cited in {doc.usage?.answers} generated answer(s) prior to being marked as retracted. Review affected outputs.
              </div>
            </div>
          )}

          <div className="provenance-note">
            <div>
              <Icon name="info" /> Traceable provenance
            </div>
            <p>The workspace records source, claim, and answer references where available. Inspect linked evidence before relying on an answer.</p>
          </div>
        </div>
      </div>
    </>
  );
}
