import { useCallback } from 'react';
import { useViewportStore } from '../store/viewport.store';
import { GraphViewport } from '../engine/graph/viewport';

export function useViewport() {
  const viewport = useViewportStore((s) => s.viewport);

  const setViewport = useCallback((v: GraphViewport) => {
    useViewportStore.setState({ viewport: v });
  }, []);

  const pan = useCallback((dx: number, dy: number) => {
    useViewportStore.getState().pan(dx, dy);
  }, []);

  const zoom = useCallback((factor: number, center?: { x: number; y: number }) => {
    useViewportStore.getState().zoom(factor, center);
  }, []);

  const reset = useCallback(() => {
    useViewportStore.getState().reset();
  }, []);

  const undo = useCallback(() => {
    useViewportStore.getState().undo();
  }, []);

  return {
    viewport,
    setViewport,
    pan,
    zoom,
    reset,
    undo
  } as const;
}
