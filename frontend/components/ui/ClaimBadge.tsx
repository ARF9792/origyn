import React from 'react';
import { Icon } from './Icon';
import type { ClaimStatus } from '@/lib/types';

interface Props {
  status: ClaimStatus;
}

const CLAIM_LABELS: Record<ClaimStatus, string> = {
  SUPPORTED:           'Supported',
  PARTIALLY_SUPPORTED: 'Partially supported',
  AFFECTED:            'Affected',
  UNSUPPORTED:         'Unsupported',
  NEEDS_REVIEW:        'Needs review',
  INVALID:             'Invalid',
};

export function ClaimBadge({ status }: Props) {
  const label = CLAIM_LABELS[status] ?? 'Needs review';
  const icon = status === 'SUPPORTED' ? 'check' : 'warning';
  return (
    <span className={`claim-badge ${status.toLowerCase()}`}>
      <Icon name={icon} />
      {label}
    </span>
  );
}
