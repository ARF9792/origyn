import React from 'react';
import { Overview } from '@/components/overview/Overview';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Workspace Overview · Origyn',
};

export default function WorkspacePage() {
  return <Overview />;
}
