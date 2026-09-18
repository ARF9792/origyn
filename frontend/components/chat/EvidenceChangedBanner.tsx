import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { SourceStatusBadge } from '@/components/ui/SourceStatusBadge';
import type { Answer, Document } from '@/lib/types';

interface Props {
  answer: Answer;
  source: Document;
}

/** Evidence changed banner for retracted sources — matches Astra EvidenceChangedBanner() */
export function EvidenceChangedBanner({ answer, source }: Props) {
  if (answer.status !== 'CURRENT') return null;
  // This banner only shows if a source used by this CURRENT answer has been retracted
  if (source.status !== 'RETRACTED') return null;

  return (
    <div className="evidence-changed" role="alert">
      <div className="change-heading">
        <Icon name="warning" />
        <strong>Evidence changed</strong>
        <span>
          Detected {new Date(source.updatedAt || '').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
        </span>
      </div>
      <p>A source used in this answer has been retracted since the answer was generated.</p>
      
      <div className="changed-source">
        <div>
          <b>{source.title || source.filename}</b>
          <br />
          <span>{source.authors || 'Unknown author'}</span>
        </div>
        <SourceStatusBadge status={source.status} />
      </div>
      
    </div>
  );
}
