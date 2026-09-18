import React from 'react';
import { Icon } from '@/components/ui/Icon';

/** Evidence-Locked indicator badge — matches Astra EvidenceLockedIndicator() */
export function EvidenceLockedIndicator() {
  return (
    <div className="evidence-lock">
      <Icon name="circlecheck" />
      <span>Evidence-Locked</span>
      <b>ON</b>
    </div>
  );
}
