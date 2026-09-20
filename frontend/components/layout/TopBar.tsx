'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Icon } from '../ui/Icon';

interface Props {
  onToggleMobile: () => void;
}

export function TopBar({ onToggleMobile }: Props) {
  const pathname = usePathname();

  let pageName = 'Overview';
  if (pathname.includes('/sources')) pageName = 'Sources';
  if (pathname.includes('/chat')) pageName = 'Chat';
  if (pathname.includes('/claims')) pageName = 'Claims';
  if (pathname.includes('/graph')) pageName = 'Evidence graph';
  if (pathname.includes('/alerts')) pageName = 'Alerts';
  if (pathname.includes('/upload')) pageName = 'Upload';

  return (
    <header className="topbar">
      <div className="breadcrumbs">
        <button
          className="icon-button mobile-menu"
          onClick={onToggleMobile}
          aria-label="Toggle menu"
        >
          <Icon name="menu" />
        </button>
        <span>{pageName}</span>
      </div>
    </header>
  );
}
