import React from 'react';
import { EvidenceLockedIndicator } from './EvidenceLockedIndicator';
import type { EvidenceContext } from '@/lib/types';

interface Props {
  context: EvidenceContext;
}

/** Current evidence context bar — matches Astra CurrentEvidenceContext() */
export function CurrentEvidenceContext({ context }: Props) {
  return (
    <div className="chat-context">
      <div>
        <EvidenceLockedIndicator />
        <span className="context-count">
          {context.usable.length} usable sources
          <i>·</i>
          {context.excluded.length} excluded
        </span>
      </div>
      <p>Research claims are grounded only in evidence currently available to this workspace.</p>
    </div>
  );
}
