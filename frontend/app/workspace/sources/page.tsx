import React, { Suspense } from 'react';
import { SourcesPage } from '@/components/sources/SourcesPage';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sources · Origyn Workspace',
};

export default function SourcesRoute() {
  return (
    <Suspense fallback={<LoadingSkeleton lines={8} />}>
      <SourcesPage />
    </Suspense>
  );
}
