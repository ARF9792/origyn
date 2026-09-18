import React from 'react';
import { Icon } from '@/components/ui/Icon';
import type { Answer } from '@/lib/types';

interface Props {
  answer: Answer;
  keptVersions: string[];
  onKeepBoth: () => void;
  onRegenerate: () => void;
}

/** Change summary for EVIDENCE_CHANGED state — matches Astra EvidenceChangeSummary() */
export function EvidenceChangeSummary({
  answer,
  keptVersions,
  onKeepBoth,
  onRegenerate,
}: Props) {
  if (answer.status !== 'EVIDENCE_CHANGED') return null;

  const event = answer.evidenceChange;
  if (!event) return null;

  const hasUpdated = !!answer.updatedVersionId;
  const isKept = hasUpdated && keptVersions.includes(answer.id);

  return (
    <div className="evidence-change-summary">
      <h3>Evidence changed</h3>
      <p>
        On {new Date(event.detectedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}, 
        a source used in this answer was marked as retracted.
      </p>
      
      <div className="change-columns">
        <div>
          <span className="change-label">Previous status</span>
          <div>
            <Icon name="check" /> {event.previousStatus}
          </div>
          <small>Status at generation time</small>
        </div>
        <div>
          <span className="change-label">Current status</span>
          <div>
            <Icon name="warning" /> {event.currentStatus}
          </div>
          <small>Detected via Crossref metadata</small>
        </div>
      </div>
      
      <div className="updated-actions">
        {hasUpdated ? (
          !isKept ? (
            <button type="button" className="button compact" onClick={onKeepBoth}>
              Keep both versions
            </button>
          ) : null
        ) : (
          <button type="button" className="button primary compact" onClick={onRegenerate}>
            Generate updated answer
          </button>
        )}
        <button
          type="button"
          className="text-button"
          disabled
        >
          View source impact
        </button>
        <span className="caption">
          The original answer text is locked for historical record.
        </span>
      </div>
    </div>
  );
}
