import React from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Alerts · Origyn Workspace',
};

export default function AlertsPlaceholder() {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Monitoring</span>
          <h1>Alerts</h1>
          <p>Notifications for status changes in your library.</p>
        </div>
      </div>
      <div className="reserved-surface">
        <div className="panel">
          <EmptyState
            icon="alerts"
            title="Alerting system reserved"
            description="This route is reserved for the Alerts implementation in a future phase."
          />
          <div className="reserved-note">
            The Alerts view will surface automated notifications when Crossref periodic monitoring detects a retraction or validity change in a previously Active source.
          </div>
        </div>
      </div>
    </>
  );
}
