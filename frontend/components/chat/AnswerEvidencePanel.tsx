import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { SourceStatusBadge } from '@/components/ui/SourceStatusBadge';
import type { ChatClaim, Document } from '@/lib/types';
import Link from 'next/link';

interface Props {
  claim: ChatClaim & { sources: Document[] };
  isFocused?: boolean;
}

/** AnswerEvidencePanel — claim + sources within the evidence inspector */
export function AnswerEvidencePanel({ claim, isFocused = false }: Props) {
  return (
    <div
      id={claim.id}
      className={`inspector-claim ${isFocused ? 'focused-claim' : ''}`}
    >
      <div className="claim-meta">
        <h3>{claim.label}</h3>
      </div>
      <p className="inspected-claim-text">{claim.text}</p>
      
      <span className="inspector-label">Found in</span>
      
      {claim.sources.map((source) => (
        <div key={source.id} className="inspector-source">
          <Icon name="sources" />
          <div>
            <b>{source.title || source.filename}</b>
            <p>{source.authors || 'Unknown author'}</p>
            <SourceStatusBadge status={source.status} />
            <span className="inspector-doi">{source.doi || 'No DOI'}</span>
            
            {source.status === 'RETRACTED' && (
              <div className="inspector-warning">
                This source was retracted after generation.
              </div>
            )}
            
            <Link
              href={`/workspace/sources/${encodeURIComponent(source.id)}`}
              className="text-link"
            >
              Open source <Icon name="external" />
            </Link>
          </div>
        </div>
      ))}
      
      <span className="inspector-label">Excerpt</span>
      <blockquote>{claim.quote || 'No excerpt available.'}</blockquote>
      <div className="caption">Page {claim.page || 1}</div>
    </div>
  );
}
