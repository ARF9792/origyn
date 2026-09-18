import React from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chat · Origyn Workspace',
};

export default function ChatPlaceholder() {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Analysis</span>
          <h1>Evidence-Locked Chat</h1>
          <p>Interact with your uploaded literature.</p>
        </div>
      </div>
      <div className="reserved-surface">
        <div className="panel">
          <EmptyState
            icon="chat"
            title="Chat interface reserved"
            description="This route is reserved for the Chat implementation in the next phase of development."
          />
          <div className="reserved-note">
            The Chat architecture requires a distinct system design phase to handle streaming responses, claim lineage tracing, and conversation state management.
          </div>
        </div>
      </div>
    </>
  );
}
