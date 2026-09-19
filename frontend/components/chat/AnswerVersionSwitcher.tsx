import React from 'react';
import type { Answer } from '@/lib/types';

interface Props {
  currentAnswerId: string;
  versions: Answer[];
  keptVersions: string[];
  onChangeVersion: (answerId: string) => void;
}

/** Version switcher for historical answers — matches Astra AnswerVersionSwitcher() */
export function AnswerVersionSwitcher({
  currentAnswerId,
  versions,
  keptVersions,
  onChangeVersion,
}: Props) {
  const originalAnswerId = versions[0]?.id;
  const isKept = originalAnswerId && keptVersions.includes(originalAnswerId);

  return (
    <div className="version-switcher" role="group" aria-label="Answer versions">
      {versions.map((v, i) => (
        <button
          key={v.id}
          type="button"
          aria-pressed={currentAnswerId === v.id}
          onClick={() => onChangeVersion(v.id)}
        >
          <span>V{i + 1}</span> {i === 0 ? 'Original' : 'Updated'}{i === versions.length - 1 && i > 0 ? ' · Latest' : ''}
        </button>
      ))}
      {isKept && <span className="versions-kept">Both versions kept in history</span>}
    </div>
  );
}
