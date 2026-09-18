import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

interface Props {
  stage: string;
  kind?: 'generate' | 'regenerate';
}

/** Loading state during generation — matches Astra AnswerLoading() */
export function AnswerLoading({ stage, kind = 'generate' }: Props) {
  return (
    <div className="chat-pending">
      <div className="generation-stage">
        <Icon name="clock" />
        {stage}...
        <small>{kind === 'regenerate' ? 'Regenerating' : 'Generating'}</small>
        <div className="stage-pulse" />
      </div>
      <LoadingSkeleton lines={3} label="Answer is generating" />
    </div>
  );
}
