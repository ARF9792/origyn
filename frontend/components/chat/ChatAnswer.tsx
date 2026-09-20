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

type AnswerBlock =
  | { type: 'paragraph'; lines: string[] }
  | { type: 'heading'; text: string }
  | { type: 'bullet-list'; items: string[] }
  | { type: 'numbered-list'; items: string[] }
  | { type: 'blockquote'; lines: string[] }
  | { type: 'code'; code: string };

function parseAnswerBlocks(text: string): AnswerBlock[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: AnswerBlock[] = [];
  let currentParagraph: string[] = [];

  const flushParagraph = () => {
    const trimmed = currentParagraph.map((line) => line.trim()).filter(Boolean);
    if (trimmed.length > 0) {
      blocks.push({ type: 'paragraph', lines: trimmed });
    }
    currentParagraph = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      continue;
    }

    if (trimmed.startsWith('```')) {
      flushParagraph();
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      blocks.push({ type: 'code', code: codeLines.join('\n') });
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      blocks.push({ type: 'heading', text: headingMatch[2] });
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      flushParagraph();
      const items: string[] = [bulletMatch[1]];
      while (
        index + 1 < lines.length &&
        /^\s*[-*•]\s+/.test(lines[index + 1])
      ) {
        index += 1;
        items.push(lines[index].trim().replace(/^[-*•]\s+/, ''));
      }
      blocks.push({ type: 'bullet-list', items });
      continue;
    }

    const numberedMatch = trimmed.match(/^\d+[.)]\s+(.*)$/);
    if (numberedMatch) {
      flushParagraph();
      const items: string[] = [numberedMatch[1]];
      while (
        index + 1 < lines.length &&
        /^\s*\d+[.)]\s+/.test(lines[index + 1])
      ) {
        index += 1;
        items.push(lines[index].trim().replace(/^\d+[.)]\s+/, ''));
      }
      blocks.push({ type: 'numbered-list', items });
      continue;
    }

    if (trimmed.startsWith('>')) {
      flushParagraph();
      const quoteLines = [trimmed.replace(/^>\s?/, '')];
      while (index + 1 < lines.length && lines[index + 1].trim().startsWith('>')) {
        index += 1;
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ''));
      }
      blocks.push({ type: 'blockquote', lines: quoteLines });
      continue;
    }

    currentParagraph.push(line);
  }

  flushParagraph();
  return blocks;
}

function renderInlineText(text: string) {
  const parts: React.ReactNode[] = [];
  const pattern = /`([^`]+)`/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(<code key={`${match.index}-${match[1]}`}>{match[1]}</code>);
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
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
        {parseAnswerBlocks(answer.text).map((block, idx) => {
          if (block.type === 'heading') {
            return <h3 key={idx}>{renderInlineText(block.text)}</h3>;
          }

          if (block.type === 'bullet-list') {
            return (
              <ul key={idx}>
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx}>{renderInlineText(item)}</li>
                ))}
              </ul>
            );
          }

          if (block.type === 'numbered-list') {
            return (
              <ol key={idx}>
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx}>{renderInlineText(item)}</li>
                ))}
              </ol>
            );
          }

          if (block.type === 'blockquote') {
            return (
              <blockquote key={idx}>
                {block.lines.map((line, lineIdx) => (
                  <p key={lineIdx}>{renderInlineText(line)}</p>
                ))}
              </blockquote>
            );
          }

          if (block.type === 'code') {
            return <pre key={idx}><code>{block.code}</code></pre>;
          }

          return (
            <p key={idx}>
              {block.lines.map((line, lineIdx) => (
                <React.Fragment key={lineIdx}>
                  {lineIdx > 0 && <br />}
                  {renderInlineText(line)}
                </React.Fragment>
              ))}
            </p>
          );
        })}
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
