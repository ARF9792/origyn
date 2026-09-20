'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '../ui/Icon';
import { MOCK_WORKSPACE } from '@/lib/mock-data';
import { isMock } from '@/lib/api';

interface Props {
  onToggleMobile: () => void;
}

export function TopBar({ onToggleMobile }: Props) {
  const pathname = usePathname();

  // Simple breadcrumb extraction
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
        <span className="workspace-crumb">{MOCK_WORKSPACE.name}</span>
        <span className="separator workspace-crumb">/</span>
        <span>{pageName}</span>
      </div>

      <div className="top-actions">
        <span className="snapshot">{isMock ? `Snapshot: ${MOCK_WORKSPACE.snapshot}` : 'Current workspace data'}</span>
        <Link href="/workspace/upload" className="button primary compact">
          <Icon name="plus" /> Add source
        </Link>
      </div>
    </header>
  );
}
