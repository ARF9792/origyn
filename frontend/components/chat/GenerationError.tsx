import React from 'react';
import { Icon } from '@/components/ui/Icon';

interface Props {
  error: string;
  onRetry: () => void;
}

/** Generation error state — matches Astra GenerationError() */
export function GenerationError({ error, onRetry }: Props) {
  return (
    <div className="chat-generation-error" role="alert">
      <Icon name="warning" />
      <div>
        <h3>Generation failed</h3>
        <p>{error}</p>
        <button
          type="button"
          className="button compact"
          onClick={onRetry}
        >
          <Icon name="refresh" /> Try again
        </button>
      </div>
    </div>
  );
}
