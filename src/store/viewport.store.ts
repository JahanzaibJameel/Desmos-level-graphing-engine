import { create } from 'zustand';
import { GraphViewport } from '../engine/graph/viewport';

interface ViewportStore {
  viewport: GraphViewport;
  setViewport: (viewport: GraphViewport) => void;
  pan: (dx: number, dy: number) => void;
  zoom: (factor: number, center?: { x: number; y: number }) => void;
  reset: () => void;
  undo: () => void;
}

export const useViewportStore = create<ViewportStore>((set) => ({
  viewport: new GraphViewport(),
  
  setViewport: (viewport) => set({ viewport }),
  
  pan: (dx, dy) => 
    set((state) => {
      const newViewport = new GraphViewport(state.viewport.current);
      newViewport.pan(dx, dy);
      return { viewport: newViewport };
    }),
  
  zoom: (factor, center) =>
    set((state) => {
      const newViewport = new GraphViewport(state.viewport.current);
      newViewport.zoom(factor, center);
      return { viewport: newViewport };
    }),
  
  reset: () =>
    set((state) => {
      const newViewport = new GraphViewport(state.viewport.current);
      newViewport.reset();
      return { viewport: newViewport };
    }),
  
  undo: () =>
    set((state) => {
      const newViewport = new GraphViewport(state.viewport.current);
      const success = newViewport.undo();
      return success ? { viewport: newViewport } : state;
    })
}));