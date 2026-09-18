import React from 'react';
import { Icon } from '@/components/ui/Icon';
import type { AnswerStatus as StatusType } from '@/lib/types';

interface Props {
  status: StatusType;
}

const STATUS_LABELS: Record<StatusType, string> = {
  CURRENT: 'Current evidence',
  EVIDENCE_CHANGED: 'Evidence changed',
  INSUFFICIENT: 'Insufficient evidence',
  GENERATING: 'Generating...',
};

const STATUS_ICONS: Record<StatusType, string> = {
  CURRENT: 'check',
  EVIDENCE_CHANGED: 'warning',
  INSUFFICIENT: 'warning',
  GENERATING: 'clock',
};

/** Answer status label — matches Astra AnswerStatus() */
export function AnswerStatus({ status }: Props) {
  const label = STATUS_LABELS[status] || 'Unknown status';
  const icon = STATUS_ICONS[status] || 'info';

  return (
    <span className={`answer-status ${status.toLowerCase()}`}>
      <Icon name={icon} />
      {label}
    </span>
  );
}
