/**
 * LoadingSkeleton — animated line skeleton loader.
 *
 * Pass 2 addition: optional `label` prop for aria-label on the
 * role="status" container (matches Astra LoadingSkeleton signature).
 * Default behaviour (lines=3, no label) is unchanged.
 */

import React from 'react';

interface Props {
  lines?: number;
  /** Optional accessible label for the status region */
  label?: string;
}

export function LoadingSkeleton({ lines = 3, label }: Props) {
  return (
    <div
      className="loading-skeleton"
      role="status"
      aria-label={label ?? 'Loading'}
    >
      {Array.from({ length: lines }).map((_, i) => {
        const width = i % 3 === 0 ? '60%' : i % 3 === 1 ? '90%' : '75%';
        return (
          <div
            key={i}
            className="skeleton-line"
            style={{ '--w': width } as React.CSSProperties}
          />
        );
      })}
    </div>
  );
}
