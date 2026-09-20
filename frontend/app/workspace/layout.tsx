'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import '@/styles/workspace.css';

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isNavOpen, setIsNavOpen] = useState(false);

  // Auth guard and escape key
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { getCurrentUser } = await import('aws-amplify/auth');
        await getCurrentUser();
      } catch (err) {
        // Not authenticated, redirect to login
        window.location.href = '/login';
      }
    };
    checkAuth();

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsNavOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const pathname = usePathname();
  const isChatRoute = pathname === '/workspace/chat';
  const isGraphRoute = pathname === '/workspace/graph';

  return (
    <div className={`shell ${isNavOpen ? 'nav-open' : ''}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      {/* Mobile scrim overlay */}
      <button
        className="menu-scrim"
        onClick={() => setIsNavOpen(false)}
        aria-label="Close navigation"
        tabIndex={isNavOpen ? 0 : -1}
      />

      <Sidebar onCloseMobile={() => setIsNavOpen(false)} />

      <main id="main" className="app-main" inert={isNavOpen ? true : undefined}>
        <TopBar onToggleMobile={() => setIsNavOpen(!isNavOpen)} />
        <div className={`content ${isChatRoute ? 'chat-content' : ''} ${isGraphRoute ? 'graph-content' : ''}`}>
          {children}
        </div>
      </main>

      {/* Modals mount here */}
      <div id="modal-root" />
      
      {/* ARIA live region for assertive status updates */}
      <div id="announcer" className="sr-only" role="status" aria-live="polite" />
    </div>
  );
}
