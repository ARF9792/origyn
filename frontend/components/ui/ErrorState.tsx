import React from 'react';
import { Icon } from './Icon';

interface Props {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title = 'Error', message, onRetry }: Props) {
  return (
    <div className="error-state">
      <Icon name="warning" />
      <div>
        <h3>{title}</h3>
        <p>{message}</p>
        {onRetry && (
          <button className="button compact" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
