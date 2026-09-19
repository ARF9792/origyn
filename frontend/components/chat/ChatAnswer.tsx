import React from 'react';
import { AnswerStatus } from './AnswerStatus';
import { AnswerEvidenceMetadata } from './AnswerEvidenceMetadata';
import { EvidenceChangeSummary } from './EvidenceChangeSummary';
import { AnswerVersionSwitcher } from './AnswerVersionSwitcher';
import type { Answer, Document } from '@/lib/types';

interface Props {
  answer: Answer;
  baseAnswer: Answer;
  sources: Document[];
  keptVersions: string[];
  versionChain?: Answer[];
  isLatestVersion?: boolean;
  noUsableEvidence?: boolean;
  onInspectEvidence?: (answerId: string, claimId?: string) => void;
  onChangeVersion?: (answerId: string) => void;
  onKeepBoth?: (answerId: string) => void;
  onRegenerate?: (answerId: string) => void;
}

/** Chat answer block — matches Astra ChatAnswer() */
export function ChatAnswer({
  answer,
  baseAnswer,
  sources,
  keptVersions,
  versionChain,
  isLatestVersion,
  noUsableEvidence,
  onInspectEvidence,
  onChangeVersion,
  onKeepBoth,
  onRegenerate,
}: Props) {
  const hasUpdatedVersion = versionChain && versionChain.length > 1;
  const isHistorical = !isLatestVersion;
  const isReplaced = isHistorical && answer.id !== versionChain?.[versionChain.length - 1]?.id;

  return (
    <div className="answer-block" id={answer.id}>
      {hasUpdatedVersion && onChangeVersion && versionChain && (
        <AnswerVersionSwitcher
          currentAnswerId={answer.id}
          versions={versionChain}
          keptVersions={keptVersions}
          onChangeVersion={onChangeVersion}
        />
      )}
      
      <div className="answer-heading">
        <div className="answer-byline">
          <span className="brand-symbol" aria-hidden="true" />
          Origyn
          <AnswerStatus status={answer.status} />
        </div>
        <span>
          {new Date(answer.createdAt).toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </span>
      </div>
      
      <div className="answer-text">
        {answer.text.split('\n\n').map((paragraph, idx) => (
          <p key={idx}>{paragraph}</p>
        ))}
      </div>
      
      {answer.status === 'EVIDENCE_CHANGED' && isLatestVersion && onKeepBoth && onRegenerate && (
        <EvidenceChangeSummary
          answer={answer}
          keptVersions={keptVersions}
          noUsableEvidence={noUsableEvidence}
          onKeepBoth={() => onKeepBoth(baseAnswer.id)}
          onRegenerate={() => onRegenerate(answer.id)}
        />
      )}
      
      {answer.status === 'INSUFFICIENT' && isHistorical && (
        <div className="unsupported-note">
          <p>
            This conclusion cannot be drawn from the remaining evidence. The original inference has been removed from this version.
          </p>
        </div>
      )}
      
      {!isReplaced && answer.status !== 'INSUFFICIENT' && (
        <AnswerEvidenceMetadata
          answer={answer}
          sources={sources}
          onInspectEvidence={onInspectEvidence}
        />
      )}
    </div>
  );
}
