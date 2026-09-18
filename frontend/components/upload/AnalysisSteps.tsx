import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { ANALYSIS_STAGES } from '@/lib/mock-data';

interface Props {
  currentStageId: string | null;
}

export function AnalysisSteps({ currentStageId }: Props) {
  if (!currentStageId) return null;

  const currentIndex = ANALYSIS_STAGES.findIndex(s => s.id === currentStageId);

  return (
    <ul className="analysis-steps">
      {ANALYSIS_STAGES.map((stage, i) => {
        const isComplete = currentIndex > i;
        const isCurrent = currentIndex === i;
        
        let stateClass = '';
        if (isComplete) stateClass = 'complete';
        if (isCurrent) stateClass = 'current';

        return (
          <li key={stage.id} className={stateClass}>
            <div className="step-icon">
              {isComplete ? <Icon name="check" /> : <span>{i + 1}</span>}
            </div>
            <div>
              {isComplete ? stage.done : stage.label}
              <small>System step {i + 1}</small>
            </div>
            {isCurrent && <div className="stage-pulse" />}
          </li>
        );
      })}
    </ul>
  );
}
