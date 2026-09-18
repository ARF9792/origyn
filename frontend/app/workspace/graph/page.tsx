import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { EvidenceGraph } from '@/components/graph/EvidenceGraph';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import '@/styles/graph.css';

export const metadata: Metadata = {
  title: 'Evidence Graph · Origyn Workspace',
};

// Next.js recommended approach for client components using useSearchParams
function GraphFallback() {
  return (
    <div className="g-loading" style={{ padding: '60px' }}>
      <p>Loading graph...</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '28px', margin: '25px 0' }}>
        <LoadingSkeleton label="Loading" />
        <LoadingSkeleton label="Loading" />
        <LoadingSkeleton label="Loading" />
      </div>
    </div>
  );
}

export default function GraphPage() {
  return (
    <Suspense fallback={<GraphFallback />}>
      <EvidenceGraph />
    </Suspense>
  );
}
