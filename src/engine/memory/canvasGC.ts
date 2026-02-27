interface CanvasBuffer {
  canvas: OffscreenCanvas | HTMLCanvasElement;
  lastUsed: number;
  size: number;
  key: string;
}

export class CanvasBufferManager {
  private buffers: Map<string, CanvasBuffer> = new Map();
  private maxBuffers: number;
  private memoryLimit: number;
  private currentMemoryUsage: number = 0;
  private gcThreshold: number;
  private readonly GC_INTERVAL = 30000; // 30 seconds
  
    constructor(
    maxBuffers: number = parseInt(import.meta.env.VITE_MAX_CANVAS_BUFFERS ?? '5'),
    memoryLimitMB: number = 256
  ) {
    this.maxBuffers = maxBuffers;
    this.memoryLimit = memoryLimitMB * 1024 * 1024; // Convert to bytes
    this.gcThreshold = this.memoryLimit * 0.8; // Start GC at 80% usage
    
    // Start periodic GC
    setInterval(() => this.garbageCollect(), this.GC_INTERVAL);
  }
  
  allocate(
    key: string,
    width: number,
    height: number,
    useOffscreen: boolean = true
  ): OffscreenCanvas | HTMLCanvasElement {
    // Check if buffer already exists
    const existing = this.buffers.get(key);
    if (existing) {
      existing.lastUsed = Date.now();
      return existing.canvas;
    }
    
    // Check memory limits
    const bufferSize = this.calculateBufferSize(width, height);
    if (this.currentMemoryUsage + bufferSize > this.memoryLimit) {
      this.garbageCollect(true); // Force GC
    }
    
    // Create new buffer
    let canvas: OffscreenCanvas | HTMLCanvasElement;
    
    if (useOffscreen && typeof OffscreenCanvas !== 'undefined') {
      canvas = new OffscreenCanvas(width, height);
    } else {
      canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
    }
    
    const buffer: CanvasBuffer = {
      canvas,
      lastUsed: Date.now(),
      size: bufferSize,
      key
    };
    
    this.buffers.set(key, buffer);
    this.currentMemoryUsage += bufferSize;
    
    // Enforce buffer count limit
    if (this.buffers.size > this.maxBuffers) {
      this.evictOldestBuffer();
    }
    
    return canvas;
  }
  
  release(key: string): boolean {
    const buffer = this.buffers.get(key);
    if (buffer) {
      this.currentMemoryUsage -= buffer.size;
      this.buffers.delete(key);
      
      if (buffer.canvas instanceof OffscreenCanvas) {
        const ctx = buffer.canvas.getContext('2d', { willReadFrequently: true });
        ctx?.clearRect(0, 0, 1, 1);
      } else {
        const htmlCanvas = buffer.canvas as HTMLCanvasElement;
        htmlCanvas.width = 1;
        htmlCanvas.height = 1;
        const ctx = htmlCanvas.getContext('2d', { willReadFrequently: true });
        ctx?.clearRect(0, 0, 1, 1);
      }
      
      return true;
    }
    return false;
  }
  
  garbageCollect(force: boolean = false): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes
    
    // Check if we need to run GC
    if (!force && this.currentMemoryUsage < this.gcThreshold) {
      return;
    }
    
    // Collect stats before GC
    const statsBefore = {
      bufferCount: this.buffers.size,
      memoryUsage: this.currentMemoryUsage
    };
    
    // Remove old buffers
    for (const [key, buffer] of this.buffers.entries()) {
      if (force || now - buffer.lastUsed > maxAge) {
        this.release(key);
      }
    }
    
    // If still over limit, remove least recently used
    if (this.currentMemoryUsage > this.memoryLimit) {
      this.evictByLRU();
    }
    
    // Log GC stats in development
    if (import.meta.env.DEV) {
      console.log('Canvas GC completed:', {
        before: statsBefore,
        after: {
          bufferCount: this.buffers.size,
          memoryUsage: this.currentMemoryUsage
        },
        freed: statsBefore.memoryUsage - this.currentMemoryUsage
      });
    }
  }
  
  clearAll(): void {
    for (const key of this.buffers.keys()) {
      this.release(key);
    }
    this.buffers.clear();
    this.currentMemoryUsage = 0;
  }
  
  getStats(): {
    bufferCount: number;
    memoryUsage: number;
    memoryLimit: number;
    usagePercentage: number;
  } {
    return {
      bufferCount: this.buffers.size,
      memoryUsage: this.currentMemoryUsage,
      memoryLimit: this.memoryLimit,
      usagePercentage: (this.currentMemoryUsage / this.memoryLimit) * 100
    };
  }
  
  private calculateBufferSize(width: number, height: number): number {
    // Approximate size: 4 bytes per pixel (RGBA)
    return width * height * 4;
  }
  
  private evictOldestBuffer(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    
    for (const [key, buffer] of this.buffers.entries()) {
      if (buffer.lastUsed < oldestTime) {
        oldestTime = buffer.lastUsed;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.release(oldestKey);
    }
  }
  
  private evictByLRU(): void {
    const buffersArray = Array.from(this.buffers.entries());
    buffersArray.sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    
    for (const [key] of buffersArray) {
      if (this.currentMemoryUsage <= this.memoryLimit * 0.7) {
        break;
      }
      this.release(key);
    }
  }
}

// Singleton instance
export const canvasBufferManager = new CanvasBufferManager();