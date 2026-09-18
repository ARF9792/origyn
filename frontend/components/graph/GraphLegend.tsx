/**
 * GraphLegend — compact footer legend.
 * Faithful port of Astra Pass 3 GraphLegend() component.
 */

import React from 'react';
import { Icon } from '@/components/ui/Icon';

export function GraphLegend() {
  return (
    <footer className="g-legend">
      <span><Icon name="sources" />Document</span>
      <span>→</span>
      <span><Icon name="claims" />Claim</span>
      <span>→</span>
      <span><Icon name="chat" />Answer</span>
      <div>
        <span><Icon name="circlecheck" />Current</span>
        <span className="g-critical"><Icon name="retracted" />Retracted</span>
        <span className="g-warning"><Icon name="warning" />Affected / Evidence changed</span>
      </div>
    </footer>
  );
}
