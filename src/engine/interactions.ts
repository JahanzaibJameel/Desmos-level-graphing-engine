/**
 * Interaction Handlers
 * Zoom, pan, keyboard navigation, touch support
 */

import { GraphViewport } from '../engine/graph/viewport';

export interface InteractionState {
  isDragging: boolean;
  isPinching: boolean;
  dragStart: { x: number; y: number } | null;
  lastTouchDistance: number | null;
}

/**
 * Handle scroll wheel zoom
 */
export function handleMouseWheel(
  event: WheelEvent,
  viewport: GraphViewport,
  canvasRect: DOMRect
): void {
  event.preventDefault();

  // Get cursor position relative to canvas
  const canvasX = event.clientX - canvasRect.left;
  const canvasY = event.clientY - canvasRect.top;

  // Convert to world coordinates (pixel space to world space)
  const cur = viewport.current;
  const worldX = cur.xMin + (canvasX / canvasRect.width) * (cur.xMax - cur.xMin);
  const worldY = cur.yMax - (canvasY / canvasRect.height) * (cur.yMax - cur.yMin);

  // Determine zoom direction
  const zoomIn = event.deltaY < 0;
  const zoomFactor = zoomIn ? 1.15 : 0.87; // 15% per scroll

  // Apply zoom centered on cursor
  const factor = zoomFactor;
  const dx = worldX - cur.xMin;
  const dy = worldY - cur.yMin;
  const newWidth = (cur.xMax - cur.xMin) / factor;
  const newHeight = (cur.yMax - cur.yMin) / factor;

  viewport.setViewport({
    xMin: worldX - (dx / (cur.xMax - cur.xMin)) * newWidth,
    xMax: worldX + ((cur.xMax - worldX) / (cur.xMax - cur.xMin)) * newWidth,
    yMin: worldY - (dy / (cur.yMax - cur.yMin)) * newHeight,
    yMax: worldY + ((cur.yMax - worldY) / (cur.yMax - cur.yMin)) * newHeight,
  });
}

/**
 * Handle mouse drag (pan)
 */
export function handleMouseDrag(
  startPos: { x: number; y: number },
  endPos: { x: number; y: number },
  viewport: GraphViewport,
  canvasWidth: number,
  canvasHeight: number
): void {
  const deltaPixelX = endPos.x - startPos.x;
  const deltaPixelY = endPos.y - startPos.y;

  // Convert pixel delta to world coordinates
  const worldDeltaX = -(deltaPixelX / canvasWidth) * (viewport.current.xMax - viewport.current.xMin);
  const worldDeltaY = (deltaPixelY / canvasHeight) * (viewport.current.yMax - viewport.current.yMin);

  viewport.pan(worldDeltaX, worldDeltaY);
}

/**
 * Handle double-click zoom
 */
export function handleDoubleClick(
  event: MouseEvent,
  viewport: GraphViewport,
  canvasRect: DOMRect,
  zoomFactor: number = 2
): void {
  event.preventDefault();

  const canvasX = event.clientX - canvasRect.left;
  const canvasY = event.clientY - canvasRect.top;

  const vp = viewport.current;
  const worldX = vp.xMin + (canvasX / canvasRect.width) * (vp.xMax - vp.xMin);
  const worldY = vp.yMax - (canvasY / canvasRect.height) * (vp.yMax - vp.yMin);

  // Zoom around point
  const factor = zoomFactor;
  const dx = worldX - vp.xMin;
  const dy = worldY - vp.yMin;
  const newWidth = (vp.xMax - vp.xMin) / factor;
  const newHeight = (vp.yMax - vp.yMin) / factor;
  
  viewport.setViewport({
    xMin: worldX - (dx / (vp.xMax - vp.xMin)) * newWidth,
    xMax: worldX + ((vp.xMax - worldX) / (vp.xMax - vp.xMin)) * newWidth,
    yMin: worldY - (dy / (vp.yMax - vp.yMin)) * newHeight,
    yMax: worldY + ((vp.yMax - worldY) / (vp.yMax - vp.yMin)) * newHeight,
  });
}

/**
 * Handle pinch zoom (touch)
 */
export function handlePinchZoom(
  touches: TouchList,
  lastDistance: number,
  viewport: GraphViewport,
  canvasRect: DOMRect
): { newDistance: number; handled: boolean } {
  if (touches.length < 2) return { newDistance: lastDistance, handled: false };

  const touch1 = touches[0];
  const touch2 = touches[1];

  if (!touch1 || !touch2) return { newDistance: lastDistance, handled: false };

  // Calculate distance between touch points
  const currentDistance = Math.hypot(
    touch2.clientX - touch1.clientX,
    touch2.clientY - touch1.clientY
  );

  if (lastDistance > 0) {
    const ratio = currentDistance / lastDistance;

    // Get center point
    const centerX = (touch1.clientX + touch2.clientX) / 2 - canvasRect.left;
    const centerY = (touch1.clientY + touch2.clientY) / 2 - canvasRect.top;

    const vp = viewport.current;
    const worldX = vp.xMin + (centerX / canvasRect.width) * (vp.xMax - vp.xMin);
    const worldY = vp.yMax - (centerY / canvasRect.height) * (vp.yMax - vp.yMin);

    // Zoom around point
    const factor = ratio;
    const dx = worldX - vp.xMin;
    const dy = worldY - vp.yMin;
    const newWidth = (vp.xMax - vp.xMin) / factor;
    const newHeight = (vp.yMax - vp.yMin) / factor;
    
    viewport.setViewport({
      xMin: worldX - (dx / (vp.xMax - vp.xMin)) * newWidth,
      xMax: worldX + ((vp.xMax - worldX) / (vp.xMax - vp.xMin)) * newWidth,
      yMin: worldY - (dy / (vp.yMax - vp.yMin)) * newHeight,
      yMax: worldY + ((vp.yMax - worldY) / (vp.yMax - vp.yMin)) * newHeight,
    });
  }

  return { newDistance: currentDistance, handled: true };
}

/**
 * Handle keyboard navigation
 */
export function handleKeyboardNavigation(
  key: string,
  viewport: GraphViewport
): boolean {
  const panAmount = 0.1; // 10% of view
  const zoomAmount = 1.1; // 10% zoom

  const panDistanceX = panAmount * (viewport.current.xMax - viewport.current.xMin);
  const panDistanceY = panAmount * (viewport.current.yMax - viewport.current.yMin);

  switch (key) {
    // Pan
    case 'ArrowLeft':
    case 'a':
      viewport.pan(-panDistanceX, 0);
      return true;

    case 'ArrowRight':
    case 'd':
      viewport.pan(panDistanceX, 0);
      return true;

    case 'ArrowUp':
    case 'w':
      viewport.pan(0, panDistanceY);
      return true;

    case 'ArrowDown':
    case 's':
      viewport.pan(0, -panDistanceY);
      return true;

    // Zoom
    case '+':
    case '=': {
      const centerX = (viewport.current.xMin + viewport.current.xMax) / 2;
      const centerY = (viewport.current.yMin + viewport.current.yMax) / 2;
      viewport.zoom(zoomAmount, { x: centerX, y: centerY });
      return true;
    }

    case '-':
    case '_': {
      const centerX2 = (viewport.current.xMin + viewport.current.xMax) / 2;
      const centerY2 = (viewport.current.yMin + viewport.current.yMax) / 2;
      viewport.zoom(1 / zoomAmount, { x: centerX2, y: centerY2 });
      return true;
    }

    // Reset
    case '0':
    case 'r':
      viewport.reset();
      return true;

    // Undo
    case 'z':
      viewport.undo();
      return true;
  }

  return false;
}

/**
 * Touch event handler
 */
export class TouchHandler {
  private touches = new Map<number, { x: number; y: number; time: number }>();
  private lastDistance = 0;

  onTouchStart(event: TouchEvent, canvasRect: DOMRect): void {
    for (let i = 0; i < event.touches.length; i++) {
      const touch = event.touches[i];
      if (touch) {
        this.touches.set(touch.identifier, {
          x: touch.clientX - canvasRect.left,
          y: touch.clientY - canvasRect.top,
          time: Date.now(),
        });
      }
    }

    // Calculate distance for pinch detection
    if (event.touches.length === 2) {
      const touches = Array.from(this.touches.values());
      const [t1, t2] = touches;
      if (t1 && t2) {
        this.lastDistance = Math.hypot(t2.x - t1.x, t2.y - t1.y);
      }
    }
  }

  onTouchMove(event: TouchEvent, viewport: GraphViewport, canvasRect: DOMRect): void {
    if (event.touches.length === 1) {
      // Single finger drag = pan
      const touch = event.touches[0];
      if (touch) {
        const current = this.touches.get(touch.identifier);
        if (current) {
          const endPos = {
            x: touch.clientX - canvasRect.left,
            y: touch.clientY - canvasRect.top,
          };
          handleMouseDrag(current, endPos, viewport, canvasRect.width, canvasRect.height);
          this.touches.set(touch.identifier, { ...endPos, time: Date.now() });
        }
      }
    } else if (event.touches.length === 2) {
      // Two finger touch = pinch zoom
      const result = handlePinchZoom(event.touches, this.lastDistance, viewport, canvasRect);
      this.lastDistance = result.newDistance;
    }
  }

  onTouchEnd(event: TouchEvent): void {
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      if (touch) {
        this.touches.delete(touch.identifier);
      }
    }
  }

  clear(): void {
    this.touches.clear();
    this.lastDistance = 0;
  }
}

/**
 * Scroll indicator (for accessibility)
 */
export function createScrollIndicator(
  viewport: GraphViewport,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number; width: number; height: number } {
  const vp = viewport.current;
  const xRange = vp.xMax - vp.xMin;
  const yRange = vp.yMax - vp.yMin;

  // Approximate visible portion relative to total data range
  // This is a simplification; actual implementation would track data bounds
  const estimatedDataXRange = xRange * 2;
  const estimatedDataYRange = yRange * 2;

  return {
    x: 0,
    y: 0,
    width: Math.max(10, (xRange / estimatedDataXRange) * canvasWidth),
    height: Math.max(10, (yRange / estimatedDataYRange) * canvasHeight),
  };
}
