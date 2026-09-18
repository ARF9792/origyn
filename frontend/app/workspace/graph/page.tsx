import React from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Evidence Graph · Origyn Workspace',
};

export default function GraphPlaceholder() {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Analysis</span>
          <h1>Evidence Graph</h1>
          <p>Visual lineage of sources, claims, and answers.</p>
        </div>
      </div>
      <div className="reserved-surface">
        <div className="panel">
          <EmptyState
            icon="graph"
            title="Graph visualization reserved"
            description="This route is reserved for the Evidence Graph implementation in a future phase."
          />
          <div className="reserved-note">
            The Evidence Graph requires integrating React Flow with our persistent graph structure to visualize the relationships between literature, assertions, and generated answers.
          </div>
        </div>
      </div>
    </>
  );
}
