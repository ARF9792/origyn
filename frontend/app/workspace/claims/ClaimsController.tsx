/**
 * ClaimsController — full Claims page implementation.
 * Uses useSearchParams() inside Suspense (see page.tsx).
 *
 * Faithful port of Astra Pass 4 Claims components + controller.
 * Data from evidenceService (shared production data, no duplication).
 * URL params: ?search= ?status= ?sort= ?claim=
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { ClaimBadge } from '@/components/ui/ClaimBadge';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { ClaimDetail } from '@/components/evidence/ClaimDetail';
import {
  evidenceService,
  queryClaims,
  previewClaims,
} from '@/lib/evidence-service';
import type {
  EvidenceData,
  EvidenceClaim,
  ClaimsFilterStatus,
  ClaimsSortKey,
} from '@/lib/evidence-service';
import {
  claimStatusLabels,
  claimPreviewStates,
  claimScenarios,
} from '@/lib/evidence-mock-data';
import type { ClaimPreviewMode } from '@/lib/evidence-mock-data';

const PAGE_SIZE = 10;

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
        aria-label="Search claims by text, source or status"
        placeholder="Search claim, source, or status…"
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
  demo: ClaimPreviewMode;
  onDemoChange: (m: ClaimPreviewMode) => void;
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
          onChange={(e) => onDemoChange(e.target.value as ClaimPreviewMode)}
        >
          {claimPreviewStates.map(([id, label]) => (
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

function ClaimTableRow({
  claim,
  onOpen,
}: {
  claim: EvidenceClaim;
  onOpen: (id: string, section?: string) => void;
}) {
  return (
    <tr>
      <td>
        <button
          className="e-claim-link"
          onClick={() => onOpen(claim.id)}
          aria-label={`Open detail for ${claim.label}: ${claim.text}`}
        >
          <span className="mono">{claim.label}</span>
          <span>{claim.text}</span>
        </button>
      </td>
      <td data-label="Supporting sources">
        <div className="e-source-cell">
          <span>
            {claim.sources.length} source{claim.sources.length === 1 ? '' : 's'}
          </span>
          {claim.sources.map((s) => (
            <Link
              key={s.id}
              href={`/workspace/sources/${encodeURIComponent(s.id)}`}
              title={s.title ?? s.filename}
            >
              {s.title ?? s.filename}
            </Link>
          ))}
        </div>
      </td>
      <td data-label="Status">
        <ClaimBadge status={claim.status} />
      </td>
      <td data-label="Used in answers">
        <button
          className="e-usage-button"
          onClick={() => onOpen(claim.id, 'answers')}
          aria-label={`${claim.answers.length} answer${claim.answers.length === 1 ? '' : 's'} — open detail`}
        >
          {claim.answers.length} answer{claim.answers.length === 1 ? '' : 's'}
          <Icon name="chevron" />
        </button>
      </td>
      <td data-label="Last evaluated">
        <span className="checked-time">
          {claim.lastEvaluated ? '18 Sep, 08:40' : 'Not evaluated'}
        </span>
      </td>
    </tr>
  );
}

function LoadingState() {
  return (
    <section className="panel e-state">
      <p>Loading evidence claims</p>
      <LoadingSkeleton label="Loading evidence claims" />
      <button className="button compact" disabled>
        Loading…
      </button>
    </section>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="error-state e-state" role="alert">
      <Icon name="warning" />
      <div>
        <h3>Some claims could not be loaded.</h3>
        <p>Your existing evidence records are preserved.</p>
        <button className="button" onClick={onRetry}>
          <Icon name="refresh" /> Retry
        </button>
      </div>
    </section>
  );
}

function EmptyLibraryState() {
  return (
    <section className="panel">
      <div className="empty-state">
        <Icon name="claims" />
        <h2>No extracted claims yet</h2>
        <p>
          Claims will appear after Origyn processes evidence from your research
          sources.
        </p>
        <Link href="/workspace/upload" className="button">
          Add sources
        </Link>
      </div>
    </section>
  );
}

// ─── Main controller ──────────────────────────────────────────────────────────
export function ClaimsController() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  // ── State ──────────────────────────────────────────────────────────────────
  const initialSearch = searchParams.get('search') ?? '';
  const initialStatus = (searchParams.get('status') ?? 'ALL') as ClaimsFilterStatus;
  const initialClaim  = searchParams.get('claim') ?? null;

  const [loadState, setLoadState]     = useState<'loading' | 'error' | 'ok'>('loading');
  const [data,      setData]          = useState<EvidenceData | null>(null);
  const [search,    setSearch]        = useState(initialSearch);
  const [status,    setStatus]        = useState<ClaimsFilterStatus>(
    ['ALL', 'SUPPORTED', 'PARTIALLY_SUPPORTED', 'AFFECTED', 'UNSUPPORTED', 'NEEDS_REVIEW', 'INVALID'].includes(initialStatus)
      ? initialStatus
      : 'ALL'
  );
  const [sort,      setSort]          = useState<ClaimsSortKey>('label');
  const [page,      setPage]          = useState(1);
  const [demo,      setDemo]          = useState<ClaimPreviewMode>('normal');
  const [selectedId, setSelectedId]   = useState<string | null>(initialClaim);
  const [scrollToAns, setScrollToAns] = useState(false);

  const triggerRef = useRef<HTMLElement | null>(null);
  const searchRef  = useRef<HTMLInputElement>(null);

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

  // ── Open initial claim from URL param ──────────────────────────────────────
  const didOpenInitial = useRef(false);
  useEffect(() => {
    if (!didOpenInitial.current && loadState === 'ok' && initialClaim) {
      didOpenInitial.current = true;
      setSelectedId(initialClaim);
    }
  }, [loadState, initialClaim]);

  // ── URL sync ───────────────────────────────────────────────────────────────
  const syncURL = useCallback(() => {
    const params = new URLSearchParams();
    if (search)          params.set('search', search);
    if (status !== 'ALL') params.set('status', status);
    if (selectedId)      params.set('claim', selectedId);
    const q = params.toString();
    const newURL = q ? `/workspace/claims?${q}` : '/workspace/claims';
    router.replace(newURL, { scroll: false });
  }, [search, status, selectedId, router]);

  useEffect(() => { syncURL(); }, [syncURL]);

  // ── Derived data ───────────────────────────────────────────────────────────
  const rawClaims = data?.claims ?? [];
  const previewedClaims =
    demo === 'empty' ? [] :
    demo === 'loading' || demo === 'error' ? rawClaims :
    previewClaims(rawClaims, demo);

  const filteredClaims = queryClaims(previewedClaims, { search, status, sort });
  const totalPages     = Math.max(1, Math.ceil(filteredClaims.length / PAGE_SIZE));
  const safePage       = Math.min(page, totalPages);
  const pageItems      = filteredClaims.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const hasPreview = previewedClaims.some((c) => c.preview);

  // Selected claim
  const allClaims  = data?.claims ?? [];
  // Use previewed version for the inspector if it has an override
  const selectedClaim = selectedId
    ? previewedClaims.find((c) => c.id === selectedId) ??
      allClaims.find((c) => c.id === selectedId) ??
      null
    : null;

  // ── Open / close ───────────────────────────────────────────────────────────
  function openDetail(id: string, section?: string) {
    triggerRef.current = document.activeElement as HTMLElement | null;
    setSelectedId(id);
    setScrollToAns(section === 'answers');
  }

  function closeDetail() {
    setSelectedId(null);
    setScrollToAns(false);
  }

  // ── Preview change ─────────────────────────────────────────────────────────
  function handleDemoChange(mode: ClaimPreviewMode) {
    setDemo(mode);
    setSearch('');
    setStatus('ALL');
    setPage(1);
    setSelectedId(null);

    if (mode === 'loading' || mode === 'error') {
      setSelectedId(null);
      return;
    }
    // Auto-open relevant claim
    if (mode === 'supported')   setTimeout(() => setSelectedId('doc_001_claim_1'), 50);
    if (mode === 'affected')    setTimeout(() => setSelectedId('doc_002_claim_1'), 50);
    const scenario = claimScenarios[mode];
    if (scenario) setTimeout(() => setSelectedId(scenario.claimId), 50);
  }

  // ── Filter counts ──────────────────────────────────────────────────────────
  const filterCounts: Record<string, number> = {
    ALL: previewedClaims.length,
    ...Object.fromEntries(
      Object.keys(claimStatusLabels).map((s) => [
        s,
        previewedClaims.filter((c) => c.status === s).length,
      ])
    ),
  };

  // ── Render loading/error/empty overrides ───────────────────────────────────
  if (loadState === 'loading' && !data) {
    return <LoadingState />;
  }
  if (loadState === 'error') {
    return <ErrorState onRetry={load} />;
  }

  // Demo overrides for empty/loading/error
  if (demo === 'empty') {
    return (
      <section className="e-page">
        <header className="page-heading">
          <div>
            <div className="eyebrow">Research evidence</div>
            <h1>Claims</h1>
            <p>Inspect what each claim rests on, and where it is used.</p>
          </div>
          <ReviewMenu demo={demo} onDemoChange={handleDemoChange} />
        </header>
        <EmptyLibraryState />
      </section>
    );
  }
  if (demo === 'loading') {
    return (
      <section className="e-page">
        <header className="page-heading">
          <div>
            <div className="eyebrow">Research evidence</div>
            <h1>Claims</h1>
            <p>Inspect what each claim rests on, and where it is used.</p>
          </div>
          <ReviewMenu demo={demo} onDemoChange={handleDemoChange} />
        </header>
        <LoadingState />
      </section>
    );
  }
  if (demo === 'error') {
    return (
      <section className="e-page">
        <header className="page-heading">
          <div>
            <div className="eyebrow">Research evidence</div>
            <h1>Claims</h1>
            <p>Inspect what each claim rests on, and where it is used.</p>
          </div>
          <ReviewMenu demo={demo} onDemoChange={handleDemoChange} />
        </header>
        <ErrorState onRetry={() => { setDemo('normal'); load(); }} />
      </section>
    );
  }

  return (
    <section className="e-page">
      {/* Page header */}
      <header className="page-heading">
        <div>
          <div className="eyebrow">Research evidence</div>
          <h1>Claims</h1>
          <p>Inspect what each claim rests on, and where it is used.</p>
        </div>
        <ReviewMenu demo={demo} onDemoChange={handleDemoChange} />
      </header>

      {/* Tools row */}
      <div className="library-tools">
        <SearchField
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
            announce('Claims list updated.');
          }}
        />
        <label className="sort-select">
          <span className="sr-only">Sort claims</span>
          <select
            id="e-sort"
            aria-label="Sort claims"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as ClaimsSortKey);
              setPage(1);
            }}
          >
            <option value="label">Claim ID</option>
            <option value="review">Needs attention first</option>
            <option value="usage">Most used in answers</option>
          </select>
        </label>
      </div>

      {/* Filters */}
      <div className="filters" role="group" aria-label="Filter claims by status">
        {([['ALL', 'All'], ...Object.entries(claimStatusLabels)] as [string, string][]).map(
          ([id, label]) => (
            <button
              key={id}
              className={`filter-button${status === id ? ' selected' : ''}`}
              onClick={() => {
                setStatus(id as ClaimsFilterStatus);
                setPage(1);
                announce('Evidence filter updated.');
              }}
              aria-pressed={status === id}
            >
              {label}
              <span>{filterCounts[id] ?? 0}</span>
            </button>
          )
        )}
      </div>

      {/* Preview note */}
      {hasPreview && (
        <div className="e-preview-note">
          Status preview · CL-061 is shown in an alternate review state. Workspace
          records and Graph remain unchanged.
        </div>
      )}

      {/* Results */}
      <div id="e-results">
        {pageItems.length > 0 ? (
          <>
            <div className="table-scroll">
              <table className="e-claims-table">
                <thead>
                  <tr>
                    <th scope="col">Claim</th>
                    <th scope="col">Supporting sources</th>
                    <th scope="col">Status</th>
                    <th scope="col">Used in answers</th>
                    <th scope="col">Last evaluated</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((claim) => (
                    <ClaimTableRow
                      key={claim.id}
                      claim={claim}
                      onOpen={openDetail}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="table-footer">
              <span role="status">
                {filteredClaims.length > 0
                  ? `${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(
                      safePage * PAGE_SIZE,
                      filteredClaims.length
                    )} of ${filteredClaims.length} claims`
                  : '0 claims'}
              </span>
              <div>
                <button
                  className="icon-button"
                  aria-label="Previous claims page"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <Icon name="back" />
                </button>
                <span>
                  Page {safePage} of {totalPages}
                </span>
                <button
                  className="icon-button"
                  aria-label="Next claims page"
                  disabled={safePage * PAGE_SIZE >= filteredClaims.length}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <Icon name="arrow" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <h2>No matching claims</h2>
            <p>Try another claim, supporting source or status.</p>
            <button
              className="button"
              onClick={() => {
                setSearch('');
                setStatus('ALL');
                setPage(1);
              }}
            >
              Clear search and filters
            </button>
          </div>
        )}
      </div>

      {/* Footnote */}
      <p className="library-footnote">
        <Icon name="info" /> Claims remain available for provenance when their
        supporting evidence changes. Answer counts use recorded Chat history.
      </p>

      {/* Claim Detail panel */}
      {selectedId !== null && (
        <ClaimDetail
          key={selectedId}
          claim={selectedClaim}
          onClose={closeDetail}
          triggerRef={triggerRef as React.RefObject<HTMLElement | null>}
          scrollToAnswers={scrollToAns}
        />
      )}
    </section>
  );
}
