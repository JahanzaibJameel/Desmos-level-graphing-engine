import React, { useRef, useEffect, useState, useCallback } from 'react';
// canvasBufferManager intentionally not used here; BufferManager used instead
import { GraphViewport } from '../engine/graph/viewport';
import { RenderScheduler } from './RenderScheduler';
import { BufferManager } from './BufferManager';
import { useExpressions } from '../hooks/useExpressions';
import { useSlidersStore } from '../store/sliders.store';
import {
  handleMouseWheel,
  handleMouseDrag,
  handleDoubleClick,
  handleKeyboardNavigation,
  TouchHandler,
} from '../engine/interactions';

interface GraphCanvasProps {
  viewport: GraphViewport;
  width?: number;
  height?: number;
  onViewportChange?: (viewport: GraphViewport) => void;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  debugMode?: boolean;
}

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  viewport,
  width = 800,
  height = 600,
  onViewportChange,
  onCanvasReady,
  debugMode = import.meta.env.DEV
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const onCanvasReadyRef = useRef<typeof onCanvasReady | undefined>(onCanvasReady);
  const viewportRef = useRef<GraphViewport>(viewport);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [renderer, setRenderer] = useState<RenderScheduler | null>(null);
  const bufferManagerRef = useRef<BufferManager>(new BufferManager());
  const touchHandlerRef = useRef<TouchHandler | null>(null);
  const renderDebounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });
    
    if (!ctx) {
      console.error('Failed to get canvas context');
      return;
    }

    // Initialize render scheduler using stable refs to avoid recreating on prop changes
    const dpr = window.devicePixelRatio || 1;
    // ensure canvas backing store matches DPR
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    // Reset transform and scale to CSS pixels
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const scheduler = new RenderScheduler(canvas, viewportRef.current, bufferManagerRef.current, dpr);
    setRenderer(scheduler);
    
    if (onCanvasReadyRef.current) {
      onCanvasReadyRef.current(canvas);
    }

    // Initial render
    scheduler.scheduleRender();

    // create touch handler instance
    touchHandlerRef.current = new TouchHandler();

    return () => {
      scheduler.dispose();
      if (touchHandlerRef.current) touchHandlerRef.current.clear();
    };
  }, []);

  // Keep refs up to date without causing the mount effect to re-run
  useEffect(() => {
    onCanvasReadyRef.current = onCanvasReady;
  }, [onCanvasReady]);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    if (renderer) {
      renderer.updateViewport(viewport);
      renderer.scheduleRender();
    }
  }, [viewport, renderer]);

  // Subscribe to slider changes and schedule renders when sliders update
  useEffect(() => {
    const unsub = useSlidersStore.subscribe(() => {
      if (renderer) renderer.scheduleRender();
    });

    return () => unsub();
  }, [renderer]);

  // Wire expressions from hook into renderer
  const expressions = useExpressions().expressions.map((e) => e.text);

  useEffect(() => {
    if (renderer) {
      renderer.setExpressions(expressions);
      renderer.scheduleRender();
    }
  }, [expressions, renderer]);

  // Debounced schedule helper to avoid thrashing renders
  const scheduleRenderDebounced = useCallback(() => {
    if (!renderer) return;
    if (renderDebounceRef.current) {
      clearTimeout(renderDebounceRef.current);
    }
    renderDebounceRef.current = window.setTimeout(() => {
      renderer.scheduleRender();
      renderDebounceRef.current = null;
    }, 24);
  }, [renderer]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !canvasRef.current || !onViewportChange) return;

    const endPos = { x: e.clientX, y: e.clientY };
    handleMouseDrag(dragStart, endPos, viewportRef.current, width, height);

    // Notify parent with a fresh viewport snapshot
    onViewportChange(new GraphViewport(viewportRef.current.current));
    setDragStart(endPos);
    scheduleRenderDebounced();
  }, [isDragging, dragStart, width, height, onViewportChange, scheduleRenderDebounced]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add non-passive wheel listener to allow preventDefault
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const wheelListener = (e: WheelEvent) => {
      if (!canvasRef.current || !onViewportChange) return;
      e.preventDefault();
      const rect = canvasRef.current.getBoundingClientRect();
      handleMouseWheel(e, viewportRef.current, rect);
      onViewportChange(new GraphViewport(viewportRef.current.current));
      scheduleRenderDebounced();
    };

    // Add non-passive listener to allow preventDefault
    canvas.addEventListener('wheel', wheelListener, { passive: false });
    return () => canvas.removeEventListener('wheel', wheelListener);
  }, [onViewportChange, scheduleRenderDebounced]);

  const handleDoubleClickLocal = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current || !onViewportChange) return;
    const rect = canvasRef.current.getBoundingClientRect();
    handleDoubleClick(e.nativeEvent as MouseEvent, viewportRef.current, rect);
    onViewportChange(new GraphViewport(viewportRef.current.current));
    scheduleRenderDebounced();
  }, [onViewportChange, scheduleRenderDebounced]);

  return (
    <div 
      ref={containerRef}
      tabIndex={0}
      className="relative bg-white border border-gray-300 rounded-lg overflow-hidden"
      style={{ width, height }}
      onKeyDown={(e) => {
        // Keyboard navigation
        const handled = handleKeyboardNavigation(e.key, viewportRef.current);
        if (handled && onViewportChange) {
          onViewportChange(new GraphViewport(viewportRef.current.current));
          scheduleRenderDebounced();
        }
      }}
    >
      <canvas
        ref={canvasRef}
        width={width * window.devicePixelRatio}
        height={height * window.devicePixelRatio}
        style={{
          width: '100%',
          height: '100%',
          cursor: isDragging ? 'grabbing' : 'grab',
          display: 'block'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClickLocal}
        onTouchStart={(e) => {
          if (!canvasRef.current) return;
          const rect = canvasRef.current.getBoundingClientRect();
          touchHandlerRef.current?.onTouchStart(e.nativeEvent, rect);
        }}
        onTouchMove={(e) => {
          if (!canvasRef.current || !onViewportChange) return;
          const rect = canvasRef.current.getBoundingClientRect();
          touchHandlerRef.current?.onTouchMove(e.nativeEvent, viewportRef.current, rect);
          onViewportChange(new GraphViewport(viewportRef.current.current));
          scheduleRenderDebounced();
        }}
        onTouchEnd={(e) => {
          touchHandlerRef.current?.onTouchEnd(e.nativeEvent);
        }}
        aria-label="Interactive scatter plot canvas showing mathematical functions (left: x-axis range, bottom: y-axis range, use mouse to pan and scroll to zoom)"
        role="img"
      />
      
      {debugMode && renderer && (
        <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white text-xs p-2 rounded">
          <div>Viewport: [{viewport.current.xMin.toFixed(2)}, {viewport.current.xMax.toFixed(2)}]</div>
          <div>Zoom: {viewport.zoomLevel.toFixed(2)}x</div>
          <div>Buffers: {bufferManagerRef.current.getStats().activeBuffers}</div>
        </div>
      )}
    </div>
  );
};