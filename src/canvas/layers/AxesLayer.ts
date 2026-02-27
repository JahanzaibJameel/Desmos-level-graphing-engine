import { GraphViewport } from '../../engine/graph/viewport';
import { BufferManager } from '../BufferManager';

export class AxesLayer {
  private bufferManager: BufferManager;
  private viewport: GraphViewport | null = null;
  
  constructor(bufferManager: BufferManager) {
    this.bufferManager = bufferManager;
  }
  
  updateViewport(viewport: GraphViewport): void {
    this.viewport = viewport;
  }
  
  render(ctx: CanvasRenderingContext2D, width: number, height: number, dpr = 1): void {
    void dpr;
    if (!this.viewport) return;
    
    const { xMin, xMax, yMin, yMax } = this.viewport.current;
    
    ctx.save();
    
    // Draw x-axis
    if (yMin <= 0 && yMax >= 0) {
      const y = height - ((0 - yMin) / (yMax - yMin)) * height;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      
      // Draw x-axis ticks and labels
      this.drawAxisTicks(ctx, width, height, 'x');
    }
    
    // Draw y-axis
    if (xMin <= 0 && xMax >= 0) {
      const x = ((0 - xMin) / (xMax - xMin)) * width;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      
      // Draw y-axis ticks and labels
      this.drawAxisTicks(ctx, width, height, 'y');
    }
    
    // Draw origin marker
    if (xMin <= 0 && xMax >= 0 && yMin <= 0 && yMax >= 0) {
      const originX = ((0 - xMin) / (xMax - xMin)) * width;
      const originY = height - ((0 - yMin) / (yMax - yMin)) * height;
      
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(originX, originY, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
  }
  
  private drawAxisTicks(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    axis: 'x' | 'y'
  ): void {
    if (!this.viewport) return;
    
    const { xMin, xMax, yMin, yMax } = this.viewport.current;
    
    ctx.fillStyle = '#000000';
    ctx.font = '12px Arial';
    ctx.textAlign = axis === 'x' ? 'center' : 'right';
    ctx.textBaseline = axis === 'x' ? 'top' : 'middle';
    
    const tickSpacing = this.calculateTickSpacing(axis === 'x' ? xMax - xMin : yMax - yMin);
    const firstTick = Math.ceil((axis === 'x' ? xMin : yMin) / tickSpacing) * tickSpacing;
    const lastTick = Math.floor((axis === 'x' ? xMax : yMax) / tickSpacing) * tickSpacing;
    
    for (let value = firstTick; value <= lastTick; value += tickSpacing) {
      if (Math.abs(value) < 1e-10) continue; // Skip origin (handled separately)
      
      let x: number, y: number;
      
      if (axis === 'x') {
        x = ((value - xMin) / (xMax - xMin)) * width;
        y = height - ((0 - yMin) / (yMax - yMin)) * height;
        
        // Draw tick
        ctx.beginPath();
        ctx.moveTo(x, y - 5);
        ctx.lineTo(x, y + 5);
        ctx.stroke();
        
        // Draw label
        const label = this.formatTickLabel(value);
        ctx.fillText(label, x, y + 10);
      } else {
        x = ((0 - xMin) / (xMax - xMin)) * width;
        y = height - ((value - yMin) / (yMax - yMin)) * height;
        
        // Draw tick
        ctx.beginPath();
        ctx.moveTo(x - 5, y);
        ctx.lineTo(x + 5, y);
        ctx.stroke();
        
        // Draw label
        const label = this.formatTickLabel(value);
        ctx.fillText(label, x - 10, y);
      }
    }
  }
  
  private calculateTickSpacing(range: number): number {
    const pixelsPerUnit = 800 / range; // Assuming 800px width
    const targetPixelsBetweenTicks = 80;
    const targetSpacing = targetPixelsBetweenTicks / pixelsPerUnit;
    
    // Find nice spacing
    const exponent = Math.floor(Math.log10(targetSpacing));
    const fraction = targetSpacing / Math.pow(10, exponent);
    
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
  
  private formatTickLabel(value: number): string {
    if (Math.abs(value) < 1e-10) return '0';
    
    // Use scientific notation for very large or small numbers
    if (Math.abs(value) >= 1e6 || (Math.abs(value) < 1e-4 && value !== 0)) {
      return value.toExponential(2);
    }
    
    // Format based on magnitude
    if (Math.abs(value) >= 1000) {
      return value.toFixed(0);
    } else if (Math.abs(value) >= 1) {
      return value.toFixed(1);
    } else {
      // Find appropriate decimal places
      const decimalPlaces = Math.max(0, Math.ceil(-Math.log10(Math.abs(value))) + 1);
      return value.toFixed(Math.min(decimalPlaces, 6));
    }
  }
  
  dispose(): void {
    // Reference bufferManager to avoid unused-private warnings
    void this.bufferManager;
  }
}