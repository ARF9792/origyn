/**
 * AlertsController — full Alerts / Impact page implementation.
 * Uses useSearchParams() inside Suspense (see page.tsx).
 *
 * Faithful port of Astra Pass 4 Alerts components + controller.
 * Data from evidenceService (shared production data, no duplication).
 * URL params: ?search= ?status= ?alert= (shareable: ?alert=retraction-doc_002)
 *
 * Mark reviewed / Return to needs review are session-only operations.
 * They do NOT restore sources, change evidence status, or rewrite answers.
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { ClaimBadge } from '@/components/ui/ClaimBadge';
import { SourceStatusBadge } from '@/components/ui/SourceStatusBadge';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { AlertDetail } from '@/components/evidence/AlertDetail';
import {
  evidenceService,
  queryAlerts,
} from '@/lib/evidence-service';
import type {
  EvidenceData,
  EvidenceAlert,
  AlertsFilterStatus,
} from '@/lib/evidence-service';
import { alertPreviewStates } from '@/lib/evidence-mock-data';
import type { AlertPreviewMode } from '@/lib/evidence-mock-data';

const VALID_STATUSES: AlertsFilterStatus[] = [
  'review', 'retractions', 'unknown', 'resolved', 'all',
];

const alertFilters: [AlertsFilterStatus, string][] = [
  ['review',       'Needs review'],
  ['retractions',  'Retractions'],
  ['unknown',      'Unknown sources'],
  ['resolved',     'Resolved'],
  ['all',          'All changes'],
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function announce(text: string) {
  if (typeof document === 'undefined') return;
  const region = document.getElementById('announcer');
  if (region) region.textContent = text;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="search-field">
      <Icon name="search" />
      <input
        id="e-search"
        type="search"
        aria-label="Search evidence changes"
        placeholder="Search source, claim, or change…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function ReviewMenu({
  demo,
  onDemoChange,
}: {
  demo: AlertPreviewMode;
  onDemoChange: (m: AlertPreviewMode) => void;
}) {
  return (
    <details className="e-review">
      <summary>
        Review states <Icon name="down" />
      </summary>
      <div>
        <label htmlFor="e-demo">Interface state</label>
        <select
          id="e-demo"
          value={demo}
          onChange={(e) => onDemoChange(e.target.value as AlertPreviewMode)}
        >
          {alertPreviewStates.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <p className="caption">
          Illustrative evidence. Preview states do not change workspace records.
        </p>
      </div>
    </details>
  );
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

function AlertRow({
  alert,
  onOpen,
}: {
  alert: EvidenceAlert;
  onOpen: (id: string) => void;
}) {
  const isRetraction = alert.type === 'RETRACTION';
  const isUnknown    = alert.type === 'UNKNOWN';
  const isSupported  = alert.type === 'SUPPORTED';

  return (
    <article className="e-alert-row">
      <span
        className={`e-event-icon${isRetraction ? ' e-critical' : isUnknown ? ' e-warning' : ''}`}
      >
        <Icon
          name={isRetraction ? 'retracted' : isUnknown ? 'unknown' : 'circlecheck'}
        />
      </span>
      <div className="e-alert-content">
        <div className="e-alert-heading">
          <button
            onClick={() => onOpen(alert.id)}
            aria-label={`Open impact detail for: ${alert.title}`}
          >
            {alert.title}
          </button>
          <AlertReviewBadge alert={alert} />
        </div>
        <h2>
          {isSupported && alert.claim
            ? `${alert.claim.label} · ${alert.claim.text}`
            : alert.source.title ?? alert.source.filename}
        </h2>
        <p>
          {isRetraction
            ? 'This source has been retracted. Historical knowledge remains available for review.'
            : isUnknown
            ? 'Origyn could not confidently verify this source.'
            : `The training source changed status. This claim's independent support from ${
                alert.claim?.sources?.[0]?.title ?? 'remaining workspace evidence'
              } remains current.`}
        </p>
        <div className="e-alert-meta">
          {isRetraction ? (
            <>
              <SourceStatusBadge status={alert.source.status} />
              <span>
                {alert.claims.length} affected claim{alert.claims.length === 1 ? '' : 's'}{' '}
                · {alert.answers.length} historical answer{alert.answers.length === 1 ? '' : 's'}
              </span>
            </>
          ) : isUnknown ? (
            <SourceStatusBadge status={alert.source.status} />
          ) : alert.claim ? (
            <ClaimBadge status={alert.claim.status} />
          ) : null}
          <time dateTime={alert.detectedAt}>Detected 18 Sep 2026</time>
        </div>
        <div className="e-alert-actions">
          <button
            className="button compact"
            onClick={() => onOpen(alert.id)}
          >
            {isRetraction
              ? 'Inspect impact'
              : isUnknown
              ? 'Review change'
              : 'Inspect claim'}{' '}
            <Icon name="arrow" />
          </button>
          {isUnknown && (
            <Link
              href={`/workspace/sources/${encodeURIComponent(alert.source.id)}`}
              className="text-link"
            >
              Review source
            </Link>
          )}
          {isRetraction && (
            <Link
              href={`/workspace/graph?source=${encodeURIComponent(alert.source.id)}`}
              className="text-link"
            >
              View evidence graph
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

function LoadingState() {
  return (
    <section className="panel e-state">
      <p>Loading evidence changes</p>
      <LoadingSkeleton label="Loading evidence changes" />
    </section>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="error-state e-state" role="alert">
      <Icon name="warning" />
      <div>
        <h3>Some evidence changes could not be loaded.</h3>
        <p>Your existing evidence records are preserved.</p>
        <button className="button" onClick={onRetry}>
          <Icon name="refresh" /> Retry
        </button>
      </div>
    </section>
  );
}

function EmptyAlertsState({ status, search }: { status: AlertsFilterStatus; search: string }) {
  return (
    <div className="empty-state">
      <h2>
        {search
          ? 'No matching evidence changes'
          : status === 'review'
          ? 'Nothing awaiting review'
          : 'No changes in this view'}
      </h2>
      <p>
        {status === 'review' && !search
          ? 'Reviewed items remain available under Resolved. Source evidence statuses are preserved.'
          : 'Try another source or change the filters.'}
      </p>
    </div>
  );
}

// ─── Main controller ──────────────────────────────────────────────────────────
export function AlertsController() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const initialSearch = searchParams.get('search') ?? '';
  const rawStatus     = searchParams.get('status') ?? 'review';
  const initialStatus: AlertsFilterStatus = VALID_STATUSES.includes(rawStatus as AlertsFilterStatus)
    ? (rawStatus as AlertsFilterStatus)
    : 'review';
  const initialAlert  = searchParams.get('alert') ?? null;

  const [loadState,   setLoadState]   = useState<'loading' | 'error' | 'ok'>('loading');
  const [data,        setData]        = useState<EvidenceData | null>(null);
  // Local copy of review states so mark-reviewed can update UI without full reload
  const [reviewedSet, setReviewedSet] = useState<Set<string>>(new Set());
  const [search,      setSearch]      = useState(initialSearch);
  const [status,      setStatus]      = useState<AlertsFilterStatus>(initialStatus);
  const [demo,        setDemo]        = useState<AlertPreviewMode>('normal');
  const [selectedId,  setSelectedId]  = useState<string | null>(initialAlert);

  const triggerRef = useRef<HTMLElement | null>(null);

  // ── Load data ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoadState('loading');
    try {
      const next = await evidenceService.load();
      setData(next);
      setLoadState('ok');
    } catch {
      setLoadState('error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Open initial alert from URL param ──────────────────────────────────────
  const didOpenInitial = useRef(false);
  useEffect(() => {
    if (!didOpenInitial.current && loadState === 'ok' && initialAlert) {
      didOpenInitial.current = true;
      setSelectedId(initialAlert);
    }
  }, [loadState, initialAlert]);

  // ── URL sync ───────────────────────────────────────────────────────────────
  const syncURL = useCallback(() => {
    const params = new URLSearchParams();
    if (search)              params.set('search', search);
    if (status !== 'review') params.set('status', status);
    if (selectedId)          params.set('alert', selectedId);
    const q = params.toString();
    const newURL = q ? `/workspace/alerts?${q}` : '/workspace/alerts';
    router.replace(newURL, { scroll: false });
  }, [search, status, selectedId, router]);

  useEffect(() => { syncURL(); }, [syncURL]);

  // ── Mark reviewed / reopen (session-only) ─────────────────────────────────
  function handleMarkReviewed(id: string) {
    evidenceService.markReviewed(id);
    setReviewedSet((prev) => new Set(prev).add(id));
    announce('Change marked reviewed. Evidence statuses are unchanged.');
  }

  function handleReopen(id: string) {
    evidenceService.reopen(id);
    setReviewedSet((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    announce('Returned to needs review.');
  }

  // ── Open / close ───────────────────────────────────────────────────────────
  function openDetail(id: string) {
    triggerRef.current = document.activeElement as HTMLElement | null;
    setSelectedId(id);
  }

  function closeDetail() {
    setSelectedId(null);
  }

  // ── Demo preview ───────────────────────────────────────────────────────────
  function handleDemoChange(mode: AlertPreviewMode) {
    setDemo(mode);
    setSearch('');
    setSelectedId(null);

    if (mode === 'loading' || mode === 'error' || mode === 'empty') {
      setStatus('review');
      return;
    }

    const typeMap: Partial<Record<AlertPreviewMode, AlertsFilterStatus>> = {
      retraction: 'retractions',
      unknown:    'unknown',
      supported:  'resolved',
    };
    if (typeMap[mode]) setStatus(typeMap[mode]!);
    else setStatus('review');

    // Auto-open the matching alert
    setTimeout(() => {
      if (!data) return;
      const typeMatch: Partial<Record<AlertPreviewMode, string>> = {
        retraction: 'RETRACTION',
        unknown:    'UNKNOWN',
        supported:  'SUPPORTED',
      };
      const t = typeMatch[mode];
      if (t) {
        const a = data.alerts.find((x) => x.type === t);
        if (a) setSelectedId(a.id);
      }
    }, 50);
  }

  // ── Derived data ───────────────────────────────────────────────────────────
  const rawAlerts = data?.alerts ?? [];

  // Apply session-only review state from local Set
  const alertsWithReview: EvidenceAlert[] = rawAlerts.map((a) => ({
    ...a,
    reviewStatus: reviewedSet.has(a.id) ? 'RESOLVED' : a.reviewStatus,
  }));

  // For the selected alert, also apply local review state
  const selectedAlert = selectedId
    ? alertsWithReview.find((a) => a.id === selectedId) ?? null
    : null;

  const attentionCount = alertsWithReview.filter(
    (a) => a.reviewStatus === 'NEEDS_REVIEW'
  ).length;

  const filteredAlerts = queryAlerts(alertsWithReview, { search, status });

  // Filter counts per tab
  const filterCounts = Object.fromEntries(
    alertFilters.map(([id]) => [
      id,
      queryAlerts(alertsWithReview, { status: id }).length,
    ])
  );

  // ── Loading/error/empty demo overrides ────────────────────────────────────
  if (loadState === 'loading' && !data) {
    return <LoadingState />;
  }
  if (loadState === 'error') {
    return <ErrorState onRetry={load} />;
  }

  const header = (
    <header className="page-heading">
      <div>
        <div className="eyebrow">Evidence changes</div>
        <h1>Alerts / Impact</h1>
        <p>What changed, what depends on it, and what needs review.</p>
      </div>
      <ReviewMenu demo={demo} onDemoChange={handleDemoChange} />
    </header>
  );

  if (demo === 'empty') {
    return (
      <section className="e-page">
        {header}
        <section className="panel">
          <div className="empty-state">
            <Icon name="alerts" />
            <h2>No evidence changes to review</h2>
            <p>
              Source changes requiring attention will appear here. Your existing
              evidence remains available.
            </p>
          </div>
          <div className="e-state-action">
            <Link href="/workspace/sources" className="button">
              Review sources
            </Link>
          </div>
        </section>
      </section>
    );
  }

  if (demo === 'loading') {
    return (
      <section className="e-page">
        {header}
        <LoadingState />
      </section>
    );
  }

  if (demo === 'error') {
    return (
      <section className="e-page">
        {header}
        <ErrorState onRetry={() => { setDemo('normal'); load(); }} />
      </section>
    );
  }

  return (
    <section className="e-page">
      {header}

      {/* Tools row */}
      <div className="library-tools">
        <SearchField
          value={search}
          onChange={(v) => {
            setSearch(v);
            announce('Evidence changes updated.');
          }}
        />
        <span className="e-attention-count">
          <Icon name={attentionCount ? 'warning' : 'check'} />
          <b>{attentionCount}</b>{' '}
          need{attentionCount === 1 ? 's' : ''} attention
        </span>
      </div>

      {/* Filters */}
      <div className="filters" role="group" aria-label="Filter evidence changes">
        {alertFilters.map(([id, label]) => (
          <button
            key={id}
            className={`filter-button${status === id ? ' selected' : ''}`}
            onClick={() => {
              setStatus(id);
              announce('Evidence filter updated.');
            }}
            aria-pressed={status === id}
          >
            {label}
            <span>{filterCounts[id] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Results */}
      <div id="e-results">
        {filteredAlerts.length > 0 ? (
          <>
            <div className="e-alert-list">
              {filteredAlerts.map((a) => (
                <AlertRow key={a.id} alert={a} onOpen={openDetail} />
              ))}
            </div>
            <div className="table-footer">
              <span role="status">
                {filteredAlerts.length} evidence change
                {filteredAlerts.length === 1 ? '' : 's'}
              </span>
              <span>Workspace snapshot · 18 Sep 2026</span>
            </div>
          </>
        ) : (
          <EmptyAlertsState status={status} search={search} />
        )}
      </div>

      {/* Footnote */}
      <p className="library-footnote">
        <Icon name="info" /> Review status tracks your attention. It does not
        change source status or rewrite historical answers.
      </p>

      {/* Alert Detail panel */}
      {selectedId !== null && (
        <AlertDetail
          key={`${selectedId}-${reviewedSet.size}`}
          alert={selectedAlert}
          onClose={closeDetail}
          onMarkReviewed={handleMarkReviewed}
          onReopen={handleReopen}
          triggerRef={triggerRef as React.RefObject<HTMLElement | null>}
        />
      )}
    </section>
  );
}
