'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '../ui/Icon';
import { MOCK_WORKSPACE } from '@/lib/mock-data';

interface Props {
  onCloseMobile?: () => void;
}

export function Sidebar({ onCloseMobile }: Props) {
  const pathname = usePathname();

  const links = [
    { label: 'Overview', href: '/workspace', icon: 'overview', exact: true },
    { label: 'Sources', href: '/workspace/sources', icon: 'sources' },
    { label: 'Chat', href: '/workspace/chat', icon: 'chat' },
    { label: 'Claims', href: '/workspace/claims', icon: 'claims' },
    { label: 'Evidence graph', href: '/workspace/graph', icon: 'graph' },
    { label: 'Alerts', href: '/workspace/alerts', icon: 'alerts' },
  ];

  return (
    <nav className="sidebar">
      <div className="identity">
        <span className="brand-symbol" />
        Origyn
      </div>

      <p className="workspace-label">Current workspace</p>
      
      <div className="workspace-name">
        <span className="workspace-initial">{MOCK_WORKSPACE.initials}</span>
        {MOCK_WORKSPACE.name}
        <Icon name="chevron" className="nav-count" />
      </div>

      {links.map((link) => {
        const isActive = link.exact
          ? pathname === link.href
          : pathname.startsWith(link.href);
          
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onCloseMobile}
            className={`nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon name={link.icon} />
            {link.label}
          </Link>
        );
      })}

      <div className="sidebar-bottom">
        <div className="demo-label">Research Preview</div>
        <p>Explore sources, claims, answers, and their evidence lineage.</p>
        <Link href="/" onClick={onCloseMobile}>
          <Icon name="arrow" />
          Back to website
        </Link>
      </div>
    </nav>
  );
}
