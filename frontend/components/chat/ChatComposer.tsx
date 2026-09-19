'use client';

import React, { useRef, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';

interface Props {
  draft: string;
  busy: boolean;
  onSubmit: (value: string) => void;
  onStop: () => void;
  onChange: (value: string) => void;
}

/** Chat composer — matches Astra ChatComposer() */
export function ChatComposer({ draft, busy, onSubmit, onStop, onChange }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Submit on Enter (not Shift+Enter)
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      const value = e.currentTarget.value;
      if (value.trim()) onSubmit(value);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = textareaRef.current?.value ?? '';
    if (value.trim()) onSubmit(value);
  }

  return (
    <div className="composer-dock">
      <form id="chat-form" className="chat-composer" onSubmit={handleSubmit}>
        <label htmlFor="chat-question" className="sr-only">
          Ask a research question
        </label>
        <textarea
          id="chat-question"
          ref={textareaRef}
          rows={2}
          maxLength={2000}
          placeholder="Ask a question about your research…"
          disabled={busy}
          value={draft}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="composer-bottom">
          <span>
            <Icon name="sources" />
            Workspace evidence only
          </span>
          {busy ? (
            <button
              type="button"
              className="button compact"
              onClick={onStop}
            >
              Stop generation
            </button>
          ) : (
            <button type="submit" className="button primary compact">
              Ask question <Icon name="arrow" />
            </button>
          )}
        </div>
      </form>
      <div className="composer-note">
        <span>{process.env.NEXT_PUBLIC_API_MODE === 'real' ? 'Responses grounded in workspace evidence' : 'Demo responses · not a live model'}</span>
        <span>Enter to send · Shift + Enter for a new line</span>
      </div>
    </div>
  );
}
