import React from 'react';

interface Props {
  lines?: number;
}

export function LoadingSkeleton({ lines = 3 }: Props) {
  return (
    <div className="loading-skeleton">
      {Array.from({ length: lines }).map((_, i) => {
        // Vary the width of the skeleton lines for a more organic look
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
