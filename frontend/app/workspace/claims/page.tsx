import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { ClaimsController } from './ClaimsController';
import '@/styles/evidence.css';

export const metadata: Metadata = {
  title: 'Claims · Origyn Workspace',
};

function ClaimsFallback() {
  return (
    <div style={{ padding: '60px 0' }}>
      <p style={{ color: '#8a8c93', fontSize: '13px' }}>Loading claims…</p>
    </div>
  );
}

export default function ClaimsPage() {
  return (
    <Suspense fallback={<ClaimsFallback />}>
      <ClaimsController />
    </Suspense>
  );
}
