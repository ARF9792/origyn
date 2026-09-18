import React from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Claims · Origyn Workspace',
};

export default function ClaimsPlaceholder() {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Analysis</span>
          <h1>Extracted Claims</h1>
          <p>Global view of all claims extracted across your library.</p>
        </div>
      </div>
      <div className="reserved-surface">
        <div className="panel">
          <EmptyState
            icon="claims"
            title="Claims library reserved"
            description="This route is reserved for the Claims implementation in a future phase."
          />
          <div className="reserved-note">
            The Claims view will provide a centralized interface for searching, filtering, and reviewing all atomic assertions extracted from your documents.
          </div>
        </div>
      </div>
    </>
  );
}
