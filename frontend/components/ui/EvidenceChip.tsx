/**
 * EvidenceChip — source evidence chip.
 *
 * Two modes (Astra Pass 2 EvidenceChip extended):
 *   - Default: renders a <Link> to the source detail page (Pass 1 behaviour).
 *   - Inspector mode: renders a <button> that calls onInspect().
 *     Used in Chat to open the evidence inspector without leaving the conversation.
 *
 * Existing Pass 1 usage (no onInspect prop) is unchanged.
 */

import React from 'react';
import Link from 'next/link';
import { Icon } from './Icon';
import type { Document } from '@/lib/types';

interface Props {
  source: Pick<Document, 'id' | 'title' | 'filename'>;
  page?: number;
  /** When provided, renders as a button calling this handler instead of a link */
  onInspect?: () => void;
}

export function EvidenceChip({ source, page, onInspect }: Props) {
  const label = source.title ?? source.filename;

  if (onInspect) {
    return (
      <button type="button" className="evidence-chip" onClick={onInspect}>
        <Icon name="sources" />
        {label}
        {page != null && <span>p. {page}</span>}
      </button>
    );
  }

  return (
    <Link href={`/workspace/sources/${encodeURIComponent(source.id)}`} className="evidence-chip">
      <Icon name="sources" />
      {label}
      {page != null && <span>p. {page}</span>}
    </Link>
  );
}
