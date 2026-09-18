import React from 'react';
import { SourceDetailPanel } from '@/components/sources/SourceDetailPanel';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Source Detail · Origyn Workspace',
};

export default function SourceDetailRoute({ params }: { params: { id: string } }) {
  return <SourceDetailPanel id={params.id} />;
}
