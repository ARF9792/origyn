'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDocuments, isMock } from '@/lib/api';
import { RECENT_ACTIVITY } from '@/lib/mock-data';
import { Icon } from '@/components/ui/Icon';
import { SourceStatusBadge } from '@/components/ui/SourceStatusBadge';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import type { DocumentSummary } from '@/lib/types';

export function Overview() {
  const [docs, setDocs] = useState<DocumentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDocuments()
      .then((res) => {
        setDocs(res.items);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load workspace overview.');
        setIsLoading(false);
      });
  }, []);

  if (isLoading) return <LoadingSkeleton lines={5} />;
  if (error) return <ErrorState message={error} />;

  const counts = {
    total: docs.length,
    active: docs.filter(d => d.status === 'ACTIVE').length,
    retracted: docs.filter(d => d.status === 'RETRACTED' || d.status === 'INVALID').length,
    unknown: docs.filter(d => d.status === 'UNKNOWN').length,
    processing: docs.filter(d => d.status === 'PROCESSING').length,
  };

  const needsAttention = docs.filter(
    d => d.status === 'RETRACTED' || d.status === 'UNKNOWN' || d.status === 'INVALID'
  );

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Workspace Overview</span>
          <h1>Literature status</h1>
          <p>Current status for {counts.total} sources in your workspace.</p>
        </div>
      </div>

      <div className="panel health">
        <div className="health-head">
          <div className="total">
            <b>{counts.total}</b> sources in workspace
          </div>
          <Link href="/workspace/sources" className="button compact quiet">
            View all
          </Link>
        </div>
        
        <div className="health-bar">
          <i style={{ '--count': counts.active } as React.CSSProperties} />
          {counts.retracted > 0 && <i className="retracted" style={{ '--count': counts.retracted } as React.CSSProperties} />}
          {counts.unknown > 0 && <i className="unknown" style={{ '--count': counts.unknown } as React.CSSProperties} />}
          {counts.processing > 0 && <i className="processing" style={{ '--count': counts.processing } as React.CSSProperties} />}
        </div>
        
        <div className="health-legend">
          <Link href="/workspace/sources?status=ACTIVE">
            <SourceStatusBadge status="ACTIVE" />
            <b>{counts.active}</b>
          </Link>
          {counts.retracted > 0 && (
            <Link href="/workspace/sources?status=RETRACTED">
              <SourceStatusBadge status="RETRACTED" />
              <b>{counts.retracted}</b>
            </Link>
          )}
          {counts.unknown > 0 && (
            <Link href="/workspace/sources?status=UNKNOWN">
              <SourceStatusBadge status="UNKNOWN" />
              <b>{counts.unknown}</b>
            </Link>
          )}
          {counts.processing > 0 && (
            <Link href="/workspace/sources?status=PROCESSING">
              <SourceStatusBadge status="PROCESSING" />
              <b>{counts.processing}</b>
            </Link>
          )}
        </div>
        
        <p className="health-note">
          Note: "No retraction found" indicates a check against known metadata registries (e.g. Crossref). It is not an assessment of scientific validity.
        </p>
      </div>

      <div className="overview-grid">
        <div className="attention-list">
          <div className="section-heading">
            <h2>Needs attention</h2>
            <span>{needsAttention.length} sources</span>
          </div>
          {needsAttention.length === 0 ? (
            <div className="inline-empty">
              <h3>All clear</h3>
              <p>
                No retracted, invalidated, or unverified sources require your
                attention.
              </p>
            </div>
          ) : (
            needsAttention.map((doc) => (
              <div
                key={doc.id}
                className={`attention-item ${
                  doc.status === 'RETRACTED' || doc.status === 'INVALID'
                    ? 'critical'
                    : ''
                }`}
              >
                <Icon
                  name={
                    doc.status === 'RETRACTED' || doc.status === 'INVALID'
                      ? 'warning'
                      : 'unknown'
                  }
                />
                <div>
                  <h3>{doc.title || doc.filename}</h3>
                  <p>
                    {doc.status === 'RETRACTED'
                      ? 'This paper has been marked as retracted. Review downstream claims that may be affected.'
                      : doc.status === 'INVALID'
                        ? 'This source has been invalidated and should no longer be used as active evidence.'
                        : 'The authoritative status of this source could not be verified automatically.'}
                  </p>
                  <Link href={`/workspace/sources/${encodeURIComponent(doc.id)}`} className="text-link">
                    Review source <span>→</span>
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>

        <div>
          <div className="section-heading">
            <h2>Recent activity</h2>
          </div>
          <div className="activity-list">
            {isMock ? RECENT_ACTIVITY.map((activity) => (
              <div key={activity.id} className="activity-item">
                <div className="event-icon">
                  <Icon name={
                    activity.type === 'retracted' ? 'warning' :
                    activity.type === 'unknown' ? 'unknown' :
                    activity.type === 'claims' ? 'claims' : 'sources'
                  } />
                </div>
                <div>
                  <h3>{activity.title}</h3>
                  <p>{activity.description}</p>
                  <time>{activity.time}</time>
                </div>
              </div>
            )) : (
              <div className="inline-empty">
                <h3>Activity history unavailable</h3>
                <p>Review the current source statuses in your library.</p>
              </div>
            )}
          </div>

          <div className="quick-actions">
            <span className="subtle">Quick actions</span>
            <Link href="/workspace/chat" className="button compact quiet">
              <Icon name="chat" /> Start chat
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
