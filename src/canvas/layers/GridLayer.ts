import { GraphViewport } from '../../engine/graph/viewport';
import { BufferManager } from '../BufferManager';

export class GridLayer {
  private bufferManager: BufferManager;
  private viewport: GraphViewport | null = null;
  private lastViewportHash: string = '';
  
  constructor(bufferManager: BufferManager) {
    this.bufferManager = bufferManager;
  }
  
  updateViewport(viewport: GraphViewport): void {
    this.viewport = viewport;
  }

  render(ctx: CanvasRenderingContext2D, width: number, height: number, dpr = 1): void {
    if (!this.viewport) return;
    
    const viewportHash = this.getViewportHash();
    
    // Use cached buffer if available
    const buffer = this.bufferManager.getBuffer(
      `grid_${viewportHash}_dpr${dpr}`,
      width,
      height,
      dpr
    );
    
    const bufferCtx = this.getBufferContext(buffer);
    if (!bufferCtx) {
      // Fallback to drawing directly to the main context
      this.renderDirect(ctx, width, height);
      return;
    }

    // If viewport changed (hash different from last rendered), redraw into buffer
    if (this.lastViewportHash !== viewportHash) {
      // Clear buffer (bufferCtx is already scaled to dpr via BufferManager)
      bufferCtx.clearRect(0, 0, width, height);
      // Render grid into buffer context
      this.renderDirect(bufferCtx as CanvasRenderingContext2D, width, height);
      this.lastViewportHash = viewportHash;
    }

    // Draw cached buffer onto main context (ctx is scaled to dpr by GraphCanvas)
    ctx.drawImage(buffer as CanvasImageSource, 0, 0, width, height);
  }
  
  private renderDirect(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, width: number, height: number): void {
    if (!this.viewport) return;
    
    const { xMin, xMax, yMin, yMax } = this.viewport.current;
    const viewportWidth = xMax - xMin;
    const viewportHeight = yMax - yMin;
    
    ctx.save();
    
    // Calculate grid spacing based on viewport size
    const targetGridSpacing = 50; // pixels
    const worldSpacing = this.calculateGridSpacing(viewportWidth, width, targetGridSpacing);
    
    // Draw grid lines
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    
    // Vertical lines
    const firstX = Math.ceil(xMin / worldSpacing) * worldSpacing;
    for (let x = firstX; x <= xMax; x += worldSpacing) {
      const screenX = ((x - xMin) / viewportWidth) * width;
      ctx.beginPath();
      ctx.moveTo(screenX, 0);
      ctx.lineTo(screenX, height);
      ctx.stroke();
    }
    
    // Horizontal lines
    const firstY = Math.ceil(yMin / worldSpacing) * worldSpacing;
    for (let y = firstY; y <= yMax; y += worldSpacing) {
      const screenY = height - ((y - yMin) / viewportHeight) * height;
      ctx.beginPath();
      ctx.moveTo(0, screenY);
      ctx.lineTo(width, screenY);
      ctx.stroke();
    }
    
    // Draw major grid lines (every 5th line)
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1.5;
    
    // Major vertical lines
    const majorWorldSpacing = worldSpacing * 5;
    const firstMajorX = Math.ceil(xMin / majorWorldSpacing) * majorWorldSpacing;
    for (let x = firstMajorX; x <= xMax; x += majorWorldSpacing) {
      const screenX = ((x - xMin) / viewportWidth) * width;
      ctx.beginPath();
      ctx.moveTo(screenX, 0);
      ctx.lineTo(screenX, height);
      ctx.stroke();
    }
    
    // Major horizontal lines
    const firstMajorY = Math.ceil(yMin / majorWorldSpacing) * majorWorldSpacing;
    for (let y = firstMajorY; y <= yMax; y += majorWorldSpacing) {
      const screenY = height - ((y - yMin) / viewportHeight) * height;
      ctx.beginPath();
      ctx.moveTo(0, screenY);
      ctx.lineTo(width, screenY);
      ctx.stroke();
    }
    
    ctx.restore();
  }
  
  private calculateGridSpacing(worldWidth: number, pixelWidth: number, targetPixels: number): number {
    const pixelsPerUnit = pixelWidth / worldWidth;
    const targetWorldSpacing = targetPixels / pixelsPerUnit;
    
    // Round to nearest nice number (1, 2, 5, 10, 20, 50, ...)
    const exponent = Math.floor(Math.log10(targetWorldSpacing));
    const fraction = targetWorldSpacing / Math.pow(10, exponent);
    
    let niceFraction: number;
    if (fraction < 1.5) {
      niceFraction = 1;
    } else if (fraction < 3) {
      niceFraction = 2;
    } else if (fraction < 7) {
      niceFraction = 5;
    } else {
      niceFraction = 10;
    }
    
    return niceFraction * Math.pow(10, exponent);
  }
  
  private getViewportHash(): string {
    if (!this.viewport) return '';
    
    const v = this.viewport.current;
    // Round to 6 decimal places for hash
    return `${Math.round(v.xMin * 1e6)}_${Math.round(v.xMax * 1e6)}_${Math.round(v.yMin * 1e6)}_${Math.round(v.yMax * 1e6)}`;
  }
  
  private getBufferContext(buffer: OffscreenCanvas | HTMLCanvasElement): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null {
    if (buffer instanceof OffscreenCanvas) {
      return buffer.getContext('2d', { alpha: false });
    } else if (buffer instanceof HTMLCanvasElement) {
      return buffer.getContext('2d', { alpha: false });
    }
    return null;
  }
  
  dispose(): void {
    if (this.viewport) {
      this.bufferManager.releaseBuffer(`grid_${this.getViewportHash()}`);
    }
  }
}