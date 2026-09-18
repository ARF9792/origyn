import React from 'react';
import { EvidenceChip } from '@/components/ui/EvidenceChip';
import { AnswerStatus } from './AnswerStatus';
import { Icon } from '@/components/ui/Icon';
import { chatClaims } from '@/lib/chat-mock-data';
import type { Answer, Document } from '@/lib/types';

interface Props {
  answer: Answer;
  sources: Document[];
  onInspectEvidence?: (answerId: string, claimId?: string) => void;
}

/** Answer evidence metadata line — matches Astra AnswerEvidenceMetadata() */
export function AnswerEvidenceMetadata({ answer, sources, onInspectEvidence }: Props) {
  return (
    <div className="answer-evidence">
      <div className="evidence-line">
        <span>Sources used</span>
        <div>
          {sources.length > 0 ? (
            sources.map((source) => (
              <EvidenceChip
                key={source.id}
                source={source}
                onInspect={onInspectEvidence ? () => onInspectEvidence(answer.id) : undefined}
              />
            ))
          ) : (
            <span className="caption">No supporting sources</span>
          )}
        </div>
      </div>
      <div className="evidence-line">
        <span>Claims used</span>
        <div>
          {answer.claimIds.length > 0 ? (
            answer.claimIds.map((id) => {
              const claim = chatClaims.find(c => c.id === id);
              return (
                <button
                  key={id}
                  className="claim-link"
                  onClick={onInspectEvidence ? () => onInspectEvidence(answer.id, id) : undefined}
                >
                  <Icon name="claims" />
                  {claim?.label || id}
                </button>
              );
            })
          ) : (
            <span className="caption">No supported claims cited</span>
          )}
        </div>
      </div>
      <div className="evidence-line">
        <span>Evidence</span>
        <div>
          <AnswerStatus status={answer.status} />
          {sources.length > 0 && onInspectEvidence && (
            <button
              type="button"
              className="text-button"
              onClick={() => onInspectEvidence(answer.id)}
            >
              View evidence <Icon name="arrow" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
