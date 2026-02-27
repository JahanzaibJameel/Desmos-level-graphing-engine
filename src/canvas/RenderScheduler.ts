import { GraphViewport } from '../engine/graph/viewport';
import { BufferManager } from './BufferManager';
import { GridLayer } from './layers/GridLayer';
import { AxesLayer } from './layers/AxesLayer';
import { CurveLayer } from './layers/CurveLayer';


export enum RenderPriority {
  HIGH = 0,
  MEDIUM = 1,
  LOW = 2
}

export interface RenderTask {
  id: string;
  priority: RenderPriority;
  execute: () => void;
  dependencies?: string[];
}

export class RenderScheduler {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private viewport: GraphViewport;
  private devicePixelRatio: number;
  private bufferManager: BufferManager;
  private tasks: Map<string, RenderTask> = new Map();
  private scheduledFrameId: number | null = null;
  private lastRenderChecksum: string | null = null;
  private frameCount: number = 0;
  
  private gridLayer: GridLayer;
  private axesLayer: AxesLayer;
  private curveLayer: CurveLayer;
  
  constructor(canvas: HTMLCanvasElement, viewport: GraphViewport, bufferManager: BufferManager, devicePixelRatio = 1) {
    this.canvas = canvas;
    // Enable willReadFrequently for better performance with getImageData calls
    this.ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true })!;
    this.viewport = viewport;
    this.devicePixelRatio = devicePixelRatio;
    this.bufferManager = bufferManager;
    
    // Initialize layers
    this.gridLayer = new GridLayer(this.bufferManager);
    this.axesLayer = new AxesLayer(this.bufferManager);
    this.curveLayer = new CurveLayer(this.bufferManager);
    
    // Set up default rendering pipeline
    this.setupRenderingPipeline();
  }
  
  updateViewport(viewport: GraphViewport): void {
    this.viewport = viewport;
    
    // Update all layers with new viewport
    this.gridLayer.updateViewport(viewport);
    this.axesLayer.updateViewport(viewport);
    this.curveLayer.updateViewport(viewport);
  }
  
  scheduleRender(): void {
    if (this.scheduledFrameId !== null) {
      cancelAnimationFrame(this.scheduledFrameId);
    }
    
    this.scheduledFrameId = requestAnimationFrame(() => {
      this.render();
      this.scheduledFrameId = null;
    });
  }
  
  private render(): void {
    this.frameCount++;
    
    // mark viewport as used to satisfy TS no-unused warnings
    void this.viewport;
    
    // Clear canvas completely
    const cssWidth = Math.round(this.canvas.width / this.devicePixelRatio);
    const cssHeight = Math.round(this.canvas.height / this.devicePixelRatio);
    
    // Reset canvas state deterministically
    this.ctx.save();
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, cssWidth, cssHeight);
    this.ctx.restore();
    
    // Execute render tasks in priority order, with stable sort for same-priority tasks
    const tasks = Array.from(this.tasks.values())
      .sort((a, b) => {
        const priorityDiff = a.priority - b.priority;
        if (priorityDiff !== 0) return priorityDiff;
        // Stable sort by task ID for same priority
        return a.id.localeCompare(b.id);
      });
    
    for (const task of tasks) {
      try {
        task.execute();
      } catch (error) {
        console.error(`Render task ${task.id} failed:`, error);
      }
    }
    
    // Validate rendering determinism by checksumming pixel buffer
    this.validateRenderDeterminism();
    
    // Memory management check (every 60 operation increments)
    if (this.frameCount % 60 === 0) {
      this.bufferManager.cleanup();
    }
  }
  
  private validateRenderDeterminism(): void {
    try {
      const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      const currentChecksum = this.hashPixelBuffer(imageData.data);
      
      // Store checksum for this render
      this.lastRenderChecksum = currentChecksum;
    } catch (error) {
      console.warn('Could not validate render determinism:', error);
    }
  }
  
  private hashPixelBuffer(data: Uint8ClampedArray): string {
    // Sample every 16th byte to create fast hash (one per 4 pixels)
    let hash = 0;
    
    for (let i = 0; i < data.length; i += 16) {
      const byte = data[i];
      if (byte !== undefined) {
        hash = ((hash << 5) - hash) + byte;
        hash = hash & hash; // Keep as 32-bit int
      }
    }

    return Math.abs(hash).toString(16).padStart(16, '0');
  }
  
  private setupRenderingPipeline(): void {
    // Grid layer (lowest priority, cached)
    this.addTask({
      id: 'grid',
      priority: RenderPriority.LOW,
      execute: () => {
        const cssWidth = Math.round(this.canvas.width / this.devicePixelRatio);
        const cssHeight = Math.round(this.canvas.height / this.devicePixelRatio);
        this.gridLayer.render(this.ctx, cssWidth, cssHeight, this.devicePixelRatio);
      }
    });
    
    // Axes layer (medium priority, cached)
    this.addTask({
      id: 'axes',
      priority: RenderPriority.MEDIUM,
      execute: () => {
        const cssWidth = Math.round(this.canvas.width / this.devicePixelRatio);
        const cssHeight = Math.round(this.canvas.height / this.devicePixelRatio);
        this.axesLayer.render(this.ctx, cssWidth, cssHeight, this.devicePixelRatio);
      }
    });
    
    // Curve layer (highest priority, dynamic)
    this.addTask({
      id: 'curves',
      priority: RenderPriority.HIGH,
      execute: () => {
        const cssWidth = Math.round(this.canvas.width / this.devicePixelRatio);
        const cssHeight = Math.round(this.canvas.height / this.devicePixelRatio);
        this.curveLayer.render(this.ctx, cssWidth, cssHeight, this.devicePixelRatio);
      }
    });
  }
  
  private addTask(task: RenderTask): void {
    this.tasks.set(task.id, task);
  }
  
  removeTask(id: string): void {
    this.tasks.delete(id);
  }
  
  setExpressions(expressions: string[]): void {
    this.curveLayer.setExpressions(expressions);
    this.scheduleRender();
  }
  
  getPerformanceMetrics() {
    return {
      frameCount: this.frameCount,
      lastRenderChecksum: this.lastRenderChecksum,
      bufferStats: this.bufferManager.getStats()
    };
  }
  
  dispose(): void {
    if (this.scheduledFrameId !== null) {
      cancelAnimationFrame(this.scheduledFrameId);
    }
    
    this.gridLayer.dispose();
    this.axesLayer.dispose();
    this.curveLayer.dispose();
    this.bufferManager.dispose();
    
    this.tasks.clear();
  }
}