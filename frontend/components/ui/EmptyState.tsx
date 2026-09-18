import React from 'react';
import { Icon } from './Icon';

interface Props {
  icon?: string;
  title: string;
  description: string;
}

export function EmptyState({ icon = 'info', title, description }: Props) {
  return (
    <div className="empty-state">
      <Icon name={icon} />
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}
