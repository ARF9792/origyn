import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { AlertsController } from './AlertsController';
import '@/styles/evidence.css';

export const metadata: Metadata = {
  title: 'Alerts · Origyn Workspace',
};

function AlertsFallback() {
  return (
    <div style={{ padding: '60px 0' }}>
      <p style={{ color: '#8a8c93', fontSize: '13px' }}>Loading alerts…</p>
    </div>
  );
}

export default function AlertsPage() {
  return (
    <Suspense fallback={<AlertsFallback />}>
      <AlertsController />
    </Suspense>
  );
}
