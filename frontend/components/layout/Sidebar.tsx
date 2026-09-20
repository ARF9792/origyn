'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '../ui/Icon';

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
      <Link
        href="/"
        className="identity"
        onClick={onCloseMobile}
        aria-label="Go to Origyn home"
      >
        <span className="brand-symbol" />
        Origyn
      </Link>

      <p className="workspace-label">Current workspace</p>

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
    </nav>
  );
}