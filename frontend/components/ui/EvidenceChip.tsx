import React from 'react';
import Link from 'next/link';
import { Icon } from './Icon';
import type { Document } from '@/lib/types';

interface Props {
  source: Pick<Document, 'id' | 'title' | 'filename'>;
  page?: number;
}

export function EvidenceChip({ source, page }: Props) {
  const label = source.title ?? source.filename;
  return (
    <Link href={`/workspace/sources/${encodeURIComponent(source.id)}`} className="evidence-chip">
      <Icon name="sources" />
      {label}
      {page != null && <span>p. {page}</span>}
    </Link>
  );
}
