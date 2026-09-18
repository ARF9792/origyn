import React from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { SourceStatusBadge } from '@/components/ui/SourceStatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Document } from '@/lib/types';

interface Props {
  documents: Document[];
  searchQuery?: string;
}

export function SourceTable({ documents, searchQuery = '' }: Props) {
  if (documents.length === 0) {
    return (
      <EmptyState
        icon="search"
        title="No sources found"
        description={
          searchQuery
            ? `No sources match "${searchQuery}" with the current filters.`
            : 'Your workspace has no sources matching this criteria.'
        }
      />
    );
  }

  return (
    <div className="table-scroll">
      <table className="source-table">
        <thead>
          <tr>
            <th scope="col">Title</th>
            <th scope="col">Status</th>
            <th scope="col">DOI</th>
            <th scope="col" className="numeric">Claims</th>
            <th scope="col">Last check</th>
            <th scope="col"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.id}>
              <td>
                <Link href={`/workspace/sources/${encodeURIComponent(doc.id)}`} className="source-title">
                  <Icon name="sources" />
                  <span>{doc.title || doc.filename}</span>
                </Link>
                {doc.authors && (
                  <div className="source-authors">
                    {doc.authors} <span>{doc.year && `(${doc.year})`} {doc.journal && `· ${doc.journal}`}</span>
                  </div>
                )}
              </td>
              <td>
                <SourceStatusBadge status={doc.status} />
              </td>
              <td>
                <span className="doi-cell" title={doc.doi || 'None'}>
                  {doc.doi || '—'}
                </span>
              </td>
              <td className="numeric">
                {doc.usage?.claims ?? 0}
              </td>
              <td>
                <span className="checked-time">
                  {doc.lastChecked ? new Date(doc.lastChecked).toLocaleDateString(undefined, {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  }) : '—'}
                </span>
              </td>
              <td>
                <Link
                  href={`/workspace/sources/${encodeURIComponent(doc.id)}`}
                  className="icon-button"
                  aria-label={`View details for ${doc.title || doc.filename}`}
                >
                  <Icon name="chevron" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
