/**
 * GraphControls — search + type filter + status filter toolbar.
 * Faithful port of Astra Pass 3 toolbar section.
 */

'use client';

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { GRAPH_DEMO_STATES } from '@/lib/graph-types';
import type { GraphViewState, GraphDemoState } from '@/lib/graph-types';

interface GraphControlsProps {
  state: GraphViewState;
  onSearchChange: (value: string) => void;
  onTypeChange: (value: GraphViewState['type']) => void;
  onStatusChange: (value: GraphViewState['status']) => void;
  onDemoChange: (value: GraphDemoState) => void;
}

export function GraphControls({
  state,
  onSearchChange,
  onTypeChange,
  onStatusChange,
  onDemoChange,
}: GraphControlsProps) {
  return (
    <>
      {/* Header row: title + demo picker */}
      <header className="page-heading">
        <div>
          <h1>Evidence graph</h1>
          <p>Trace what your research depends on.</p>
        </div>
        <details className="g-demo">
          <summary>
            Review states <Icon name="down" />
          </summary>
          <div>
            <label htmlFor="g-demo">Graph state</label>
            <select
              id="g-demo"
              value={state.demo}
              onChange={(e) => onDemoChange(e.target.value as GraphDemoState)}
            >
              {GRAPH_DEMO_STATES.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
            <p className="caption">
              Illustrative records. The replay uses the same evidence-change workflow as Chat.
            </p>
          </div>
        </details>
      </header>

      {/* Toolbar: search + filters */}
      <div className="g-toolbar">
        <label className="g-search">
          <Icon name="search" />
          <input
            id="g-search"
            type="search"
            placeholder="Find a source, claim or answer…"
            aria-label="Search evidence graph"
            value={state.search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </label>

        <label className="g-filter">
          <span className="sr-only">Node type</span>
          <select
            id="g-type"
            aria-label="Node type"
            value={state.type}
            onChange={(e) => onTypeChange(e.target.value as GraphViewState['type'])}
          >
            <option value="all">All types</option>
            <option value="document">Documents</option>
            <option value="claim">Claims</option>
            <option value="answer">Answers</option>
          </select>
        </label>

        <label className="g-filter">
          <span className="sr-only">Evidence status</span>
          <select
            id="g-status"
            aria-label="Evidence status"
            value={state.status}
            onChange={(e) => onStatusChange(e.target.value as GraphViewState['status'])}
          >
            <option value="all">All statuses</option>
            <option value="current">Current</option>
            <option value="retracted">Retracted</option>
            <option value="affected">Affected</option>
            <option value="unsupported">Unsupported</option>
          </select>
        </label>
      </div>
    </>
  );
}
