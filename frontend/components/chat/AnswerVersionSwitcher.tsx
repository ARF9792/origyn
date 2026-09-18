import React from 'react';
import type { Answer } from '@/lib/types';

interface Props {
  currentAnswerId: string;
  originalAnswerId: string;
  updatedAnswerId: string;
  keptVersions: string[];
  onChangeVersion: (answerId: string) => void;
}

/** Version switcher for historical answers — matches Astra AnswerVersionSwitcher() */
export function AnswerVersionSwitcher({
  currentAnswerId,
  originalAnswerId,
  updatedAnswerId,
  keptVersions,
  onChangeVersion,
}: Props) {
  const isKept = keptVersions.includes(originalAnswerId);

  return (
    <div className="version-switcher" role="group" aria-label="Answer versions">
      <button
        type="button"
        aria-pressed={currentAnswerId === originalAnswerId}
        onClick={() => onChangeVersion(originalAnswerId)}
      >
        <span>V1</span> Original
      </button>
      <button
        type="button"
        aria-pressed={currentAnswerId === updatedAnswerId}
        onClick={() => onChangeVersion(updatedAnswerId)}
      >
        <span>V2</span> Updated
      </button>
      {isKept && <span className="versions-kept">Both versions kept in history</span>}
    </div>
  );
}
