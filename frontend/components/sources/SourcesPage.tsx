'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getDocuments, queryDocuments } from '@/lib/api';
import { Icon } from '@/components/ui/Icon';
import { SourceTable } from './SourceTable';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import type { Document } from '@/lib/types';

export function SourcesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Search/filter state read from URL params
  const querySearch = searchParams.get('q') ?? '';
  const queryStatus = searchParams.get('status') ?? 'ALL';
  const querySort = searchParams.get('sort') ?? 'recent';

  const [allDocs, setAllDocs] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // For controlled inputs
  const [searchValue, setSearchValue] = useState(querySearch);

  useEffect(() => {
    // Sync input when URL changes
    setSearchValue(querySearch);
  }, [querySearch]);

  useEffect(() => {
    getDocuments()
      .then((res) => {
        // Safe cast for mock data usage; in a real app, GET /documents returns DocumentSummary
        // and we'd fetch full docs on demand or the backend would support querying.
        // For Day 1, the mock returns full documents.
        setAllDocs(res.items as unknown as Document[]);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load sources.');
        setIsLoading(false);
      });
  }, []);

  // Update URL params
  const updateQuery = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    router.replace(`/workspace/sources?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateQuery({ q: searchValue || null });
  };

  const filteredDocs = useMemo(() => {
    return queryDocuments(allDocs, {
      search: querySearch,
      status: queryStatus,
      sort: querySort,
    });
  }, [allDocs, querySearch, queryStatus, querySort]);

  if (isLoading) return <LoadingSkeleton lines={8} />;
  if (error) return <ErrorState message={error} />;

  const statusFilters = [
    { value: 'ALL', label: 'All sources' },
    { value: 'ACTIVE', label: 'No retraction found' },
    { value: 'RETRACTED', label: 'Retracted' },
    { value: 'UNKNOWN', label: 'Unable to verify' },
    { value: 'PROCESSING', label: 'Processing' },
  ];

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Workspace Library</span>
          <h1>Sources</h1>
          <p>
            {allDocs.length} sources available to your workspace.
          </p>
        </div>
        <div className="heading-aside">
          <Link href="/workspace/upload" className="button primary compact">
            <Icon name="plus" /> Add source
          </Link>
        </div>
      </div>

      <div className="library-tools">
        <form className="search-field" onSubmit={handleSearchSubmit}>
          <Icon name="search" />
          <input
            type="text"
            placeholder="Search titles, authors, or DOI..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
          <button type="submit" className="sr-only">Search</button>
          <span className="search-shortcut">/</span>
        </form>

        <div className="sort-select">
          <label htmlFor="sort" className="sr-only">Sort by</label>
          <select
            id="sort"
            value={querySort}
            onChange={(e) => updateQuery({ sort: e.target.value })}
          >
            <option value="recent">Recently added</option>
            <option value="title">Title (A-Z)</option>
            <option value="year">Newest publication</option>
          </select>
        </div>
      </div>

      <div className="filters">
        {statusFilters.map((filter) => (
          <button
            key={filter.value}
            className={`filter-button ${queryStatus === filter.value ? 'selected' : ''}`}
            onClick={() => updateQuery({ status: filter.value === 'ALL' ? null : filter.value })}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <p className="mobile-table-hint">Swipe table horizontally to view full details.</p>

      <SourceTable documents={filteredDocs} searchQuery={querySearch} />

      <div className="table-footer">
        <div>Showing {filteredDocs.length} of {allDocs.length} sources</div>
      </div>

      <div className="library-footnote">
        <Icon name="info" />
        <p>
          "No retraction found" means Origyn did not find a known retraction in scholarly metadata registries (e.g. Crossref) for the identified DOI. 
          This does not guarantee scientific validity or soundness. You are responsible for reviewing sources.
        </p>
      </div>
    </>
  );
}
