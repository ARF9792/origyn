import React from 'react';
import { Icon } from './Icon';
import { STATUS_LABELS } from '@/lib/types';
import type { DocumentStatus } from '@/lib/types';

interface Props {
  status: DocumentStatus;
}

const STATUS_ICON: Record<DocumentStatus, string> = {
  ACTIVE:     'circlecheck',
  RETRACTED:  'retracted',
  UNKNOWN:    'unknown',
  PROCESSING: 'clock',
  INVALID:    'retracted',
  DELETED:    'trash',
};

export function SourceStatusBadge({ status }: Props) {
  const icon = STATUS_ICON[status] ?? 'unknown';
  const label = STATUS_LABELS[status] ?? 'Unable to verify';
  return (
    <span className={`status-badge ${status.toLowerCase()}`}>
      <Icon name={icon} />
      {label}
    </span>
  );
}
