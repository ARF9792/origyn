'use client';

import React, { useEffect, useRef } from 'react';
import { Icon } from '@/components/ui/Icon';
import { AnswerEvidencePanel } from './AnswerEvidencePanel';
import type { EvidenceResult } from '@/lib/types';
import Link from 'next/link';

interface Props {
  evidence: EvidenceResult | null;
  focusedClaimId?: string | null;
  onClose: () => void;
}

/** Evidence inspector drawer — uses native <dialog> matching Astra behaviour */
export function EvidenceDrawer({ evidence, focusedClaimId, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Sync dialog open state
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (evidence && !dialog.open) {
      dialog.showModal();
      document.body.style.overflow = 'hidden';
      
      if (focusedClaimId) {
        // Wait for modal to render before scrolling
        setTimeout(() => {
          document.getElementById(focusedClaimId)?.scrollIntoView({ behavior: 'smooth' });
        }, 50);
      }
    } else if (!evidence && dialog.open) {
      dialog.close();
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [evidence, focusedClaimId]);

  // Handle native close (e.g. Escape key)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      onClose();
    };

    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  // Handle backdrop click
  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) {
      onClose();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="evidence-drawer"
      onClick={handleBackdropClick}
      aria-label="Evidence inspector"
    >
      {evidence && (
        <>
          <div className="inspector-header">
            <div>
              <span className="eyebrow">Evidence inspector</span>
              <h2>{evidence.answer.question}</h2>
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={onClose}
              aria-label="Close inspector"
            >
              <Icon name="close" />
            </button>
          </div>
          
          <div className="inspector-body">
            <div className="inspector-answer">
              <span className="mono">
                Generated {new Date(evidence.answer.createdAt).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
              <p>{evidence.answer.text.split('\n\n')[0]}...</p>
            </div>
            
            <div className="inspector-impact">
              This answer is grounded in {evidence.claims.length} claims extracted from{' '}
              {evidence.sources.length} sources.
            </div>
            
            <h3 className="inspector-section-label">Traceable claims</h3>
            
            {evidence.claims.map((claim) => (
              <AnswerEvidencePanel
                key={claim.id}
                claim={claim}
                isFocused={claim.id === focusedClaimId}
              />
            ))}
            
            <Link href={`/workspace/graph?answer=${evidence.answer.id}`} className="button full-width">
              <Icon name="graph" /> View in evidence graph
            </Link>
          </div>
        </>
      )}
    </dialog>
  );
}
