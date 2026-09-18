import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { CHAT_QUESTION, INSUFFICIENT_QUESTION } from '@/lib/chat-mock-data';

interface Props {
  onSuggest: (question: string) => void;
}

/** Chat empty state — matches Astra ChatEmptyState() */
export function ChatEmptyState({ onSuggest }: Props) {
  return (
    <section className="chat-empty">
      <span className="eyebrow">Neuroplasticity review</span>
      <h2>
        Ask your evidence.
        <br />
        Keep the reasoning traceable.
      </h2>
      <p>
        Start with a question. Inspect the sources and claims behind every answer,
        and see what changes when evidence changes.
      </p>
      <div className="suggested-questions">
        <button onClick={() => onSuggest(CHAT_QUESTION)}>
          {CHAT_QUESTION}
          <Icon name="arrow" />
        </button>
        <button onClick={() => onSuggest(INSUFFICIENT_QUESTION)}>
          {INSUFFICIENT_QUESTION}
          <Icon name="arrow" />
        </button>
      </div>
      <p className="caption">
        This preview uses fictional research records from your workspace.
      </p>
    </section>
  );
}
