/**
 * GraphCanvas — SVG edges + absolute-positioned node buttons with pan/zoom.
 * Faithful port of Astra Pass 3 GraphCanvas() + wireCanvas() + camera logic.
 *
 * Uses plain SVG + CSS absolute positioning — no React Flow.
 * Pan: pointer-drag on canvas background.
 * Zoom: +/- buttons, Ctrl/Cmd+wheel, keyboard +/−/0.
 * Keyboard: Arrow keys pan; 0 or Fit fits the view.
 */

'use client';

import React, {
  useRef,
  useEffect,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { GraphNodeCard } from './GraphNode';
import { GRAPH_LAYOUT, NODE_TYPES } from '@/lib/graph-types';
import type { InternalGraphData, GraphViewState, CameraState } from '@/lib/graph-types';

// ─── Camera handle exposed to parent ──────────────────────────────────────────
export interface GraphCanvasHandle {
  fit: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

interface GraphCanvasProps {
  view: InternalGraphData;
  state: GraphViewState;
  camera: CameraState;
  onCameraChange: (cam: CameraState) => void;
  onSelect: (id: string) => void;
}

export const GraphCanvas = forwardRef<GraphCanvasHandle, GraphCanvasProps>(
  function GraphCanvas({ view, state, camera, onCameraChange, onSelect }, ref) {
    const canvasRef   = useRef<HTMLDivElement>(null);
    const worldRef    = useRef<HTMLDivElement>(null);
    const zoomOutputRef = useRef<HTMLOutputElement>(null);
    const dragRef     = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
    const camRef      = useRef<CameraState>(camera);

    // Keep camRef in sync with prop
    camRef.current = camera;

    // ── Apply camera transform ──────────────────────────────────────────────
    const applyCamera = useCallback((cam: CameraState) => {
      if (worldRef.current) {
        worldRef.current.style.transform = `translate(${cam.x}px,${cam.y}px) scale(${cam.z})`;
      }
      if (zoomOutputRef.current) {
        zoomOutputRef.current.textContent = `${Math.round(cam.z * 100)}%`;
      }
    }, []);

    // ── Fit view ───────────────────────────────────────────────────────────
    const fit = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas || !canvas.clientWidth) return;
      const w = view.width ?? 1020;
      const h = view.height ?? 420;
      const z = Math.min(1, Math.max(0.55, Math.min(
        (canvas.clientWidth - 28) / w,
        (canvas.clientHeight - 20) / h,
      )));
      const x = (canvas.clientWidth - w * z) / 2;
      const y = Math.max(5, (canvas.clientHeight - h * z) / 2);
      const cam = { x, y, z };
      camRef.current = cam;
      onCameraChange(cam);
      applyCamera(cam);
    }, [view.width, view.height, onCameraChange, applyCamera]);

    // ── Zoom around point ──────────────────────────────────────────────────
    const zoom = useCallback((factor: number, point?: { x: number; y: number }) => {
      const canvas = canvasRef.current;
      const p = point ?? { x: (canvas?.clientWidth ?? 0) / 2, y: (canvas?.clientHeight ?? 0) / 2 };
      const old = camRef.current.z;
      const newZ = Math.max(0.55, Math.min(1.6, old * factor));
      const cam: CameraState = {
        x: p.x - (p.x - camRef.current.x) * newZ / old,
        y: p.y - (p.y - camRef.current.y) * newZ / old,
        z: newZ,
      };
      camRef.current = cam;
      onCameraChange(cam);
      applyCamera(cam);
    }, [onCameraChange, applyCamera]);

    // ── Expose handle to parent ────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      fit,
      zoomIn:  () => zoom(1.15),
      zoomOut: () => zoom(1 / 1.15),
    }), [fit, zoom]);

    // ── Initial fit + re-fit on view change ────────────────────────────────
    useEffect(() => {
      fit();
    }, [fit]);

    // ── Pointer drag (pan) ─────────────────────────────────────────────────
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      function onPointerDown(e: PointerEvent) {
        if ((e.target as Element).closest('button') || e.button !== 0) return;
        dragRef.current = { x: e.clientX, y: e.clientY, cx: camRef.current.x, cy: camRef.current.y };
        canvas!.setPointerCapture(e.pointerId);
        canvas!.classList.add('g-dragging');
      }
      function onPointerMove(e: PointerEvent) {
        if (!dragRef.current) return;
        const cam: CameraState = {
          ...camRef.current,
          x: dragRef.current.cx + e.clientX - dragRef.current.x,
          y: dragRef.current.cy + e.clientY - dragRef.current.y,
        };
        camRef.current = cam;
        onCameraChange(cam);
        applyCamera(cam);
      }
      function onPointerEnd() {
        dragRef.current = null;
        canvas!.classList.remove('g-dragging');
      }

      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerup', onPointerEnd);
      canvas.addEventListener('pointercancel', onPointerEnd);
      return () => {
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerup', onPointerEnd);
        canvas.removeEventListener('pointercancel', onPointerEnd);
      };
    }, [onCameraChange, applyCamera]);

    // ── Ctrl/Cmd+wheel zoom ────────────────────────────────────────────────
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      function onWheel(e: WheelEvent) {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        const r = canvas!.getBoundingClientRect();
        zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1, { x: e.clientX - r.left, y: e.clientY - r.top });
      }
      canvas.addEventListener('wheel', onWheel, { passive: false });
      return () => canvas.removeEventListener('wheel', onWheel);
    }, [zoom]);

    // ── Keyboard pan/zoom on focused canvas ───────────────────────────────
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      function onKeyDown(e: KeyboardEvent) {
        if (e.target !== canvas) return;
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
          e.preventDefault();
          const cam: CameraState = {
            ...camRef.current,
            x: camRef.current.x + (e.key === 'ArrowLeft' ? 40 : e.key === 'ArrowRight' ? -40 : 0),
            y: camRef.current.y + (e.key === 'ArrowUp'   ? 40 : e.key === 'ArrowDown'  ? -40 : 0),
          };
          camRef.current = cam;
          onCameraChange(cam);
          applyCamera(cam);
        }
        if (['+', '=', '-', '0'].includes(e.key)) {
          e.preventDefault();
          if (e.key === '0') fit();
          else zoom(e.key === '-' ? 1 / 1.15 : 1.15);
        }
      }
      canvas.addEventListener('keydown', onKeyDown);
      return () => canvas.removeEventListener('keydown', onKeyDown);
    }, [fit, zoom, onCameraChange, applyCamera]);

    // ── Keyboard focus scroll-into-view ───────────────────────────────────
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      function onFocusIn(e: FocusEvent) {
        const btn = (e.target as Element).closest<HTMLElement>('.g-node');
        if (!btn) return;
        const nodeId = btn.dataset.id;
        const n = view.nodes.find((nd) => nd.id === nodeId);
        if (!n) return;
        const rect = canvas!.getBoundingClientRect();
        const btnRect = btn.getBoundingClientRect();
        if (
          btnRect.left < rect.left ||
          btnRect.right > rect.right ||
          btnRect.top < rect.top ||
          btnRect.bottom > rect.bottom
        ) {
          const cam: CameraState = {
            ...camRef.current,
            x: canvas!.clientWidth / 2 - (n.x! + GRAPH_LAYOUT.nodeWidth / 2) * camRef.current.z,
            y: canvas!.clientHeight / 2 - (n.y! + GRAPH_LAYOUT.nodeHeight / 2) * camRef.current.z,
          };
          camRef.current = cam;
          onCameraChange(cam);
          applyCamera(cam);
        }
      }
      canvas.addEventListener('focusin', onFocusIn);
      return () => canvas.removeEventListener('focusin', onFocusIn);
    }, [view.nodes, onCameraChange, applyCamera]);

    // ── Apply camera from prop whenever it changes (from parent fit/zoom) ──
    useEffect(() => {
      applyCamera(camera);
    }, [camera, applyCamera]);

    const w = view.width ?? 1020;
    const h = view.height ?? 420;

    return (
      <div
        ref={canvasRef}
        className="g-canvas"
        tabIndex={0}
        aria-label="Evidence graph canvas. Drag background to pan, use arrow keys to pan, plus or minus to zoom, zero to fit."
      >
        <div
          ref={worldRef}
          className="g-world"
          style={{ width: `${w}px`, height: `${h}px` }}
        >
          {/* SVG edges */}
          <svg
            className="g-edges"
            width={w}
            height={h}
            aria-hidden="true"
          >
            <defs>
              <marker
                id="g-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
              </marker>
            </defs>
            {view.edges.map((edge, idx) => {
              const a = view.nodes.find((n) => n.id === edge.from);
              const b = view.nodes.find((n) => n.id === edge.to);
              if (!a || !b) return null;
              const x1 = (a.x ?? 0) + GRAPH_LAYOUT.nodeWidth;
              const y1 = (a.y ?? 0) + GRAPH_LAYOUT.nodeHeight / 2;
              const x2 = b.x ?? 0;
              const y2 = (b.y ?? 0) + GRAPH_LAYOUT.nodeHeight / 2;
              const dimEdge =
                state.focusIds !== null &&
                (!state.focusIds.has(edge.from) || !state.focusIds.has(edge.to));
              return (
                <path
                  key={idx}
                  d={`M${x1},${y1} C${x1 + 45},${y1} ${x2 - 45},${y2} ${x2},${y2}`}
                  className={[
                    edge.affected ? 'g-edge-affected' : '',
                    dimEdge ? 'g-edge-dim' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  markerEnd="url(#g-arrow)"
                />
              );
            })}
          </svg>

          {/* Column labels */}
          <div className="g-column-labels">
            {(Object.entries(NODE_TYPES) as [string, typeof NODE_TYPES[keyof typeof NODE_TYPES]][]).map(
              ([type, cfg], i) => (
                <span key={type} style={{ left: `${24 + i * 354}px` }}>
                  {/* icon rendered via Icon in Astra; use text here to avoid complexity */}
                  {cfg.label}s{' '}
                  <small>
                    {view.nodes.filter((n) => n.type === type).length}
                  </small>
                </span>
              )
            )}
          </div>

          {/* Nodes */}
          {view.nodes.map((node) => (
            <GraphNodeCard
              key={node.id}
              node={node}
              selected={state.selected}
              focusIds={state.focusIds}
              onSelect={onSelect}
            />
          ))}
        </div>

        {/* Zoom output for screen readers — placed outside world so it's always visible */}
        <output id="g-zoom" aria-live="polite" ref={zoomOutputRef} style={{ display: 'none' }}>
          {Math.round(camera.z * 100)}%
        </output>
      </div>
    );
  }
);
