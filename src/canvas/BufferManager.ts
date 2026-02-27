import { canvasBufferManager } from '../engine/memory/canvasGC';
import { DeterministicIDGenerator } from '../engine/determinism';

interface BufferCache {
  [key: string]: {
    buffer: OffscreenCanvas | HTMLCanvasElement;
    contentHash: string;
    width: number;
    height: number;
    dpr?: number;
    accessCount: number;
  };
}

export class BufferManager {
  private cache: BufferCache = {};
  private maxCacheSize: number = 10;
  private accessCounterGlobal: number = 0;
  
  getBuffer(
    key: string,
    width: number,
    height: number,
    dpr: number = 1
  ): OffscreenCanvas | HTMLCanvasElement {
    const cached = this.cache[key];
    
    // Content-hash based validation: regenerate hash from key
    const contentHash = this.generateContentHash(key, width, height, dpr);
    
    // Check if cached buffer is still valid (including DPR)
    if (cached && 
        cached.width === width && 
        cached.height === height &&
        cached.dpr === dpr &&
        cached.contentHash === contentHash) {
      // Update access counter for LRU
      cached.accessCount = this.accessCounterGlobal++;
      return cached.buffer;
    }
    
    // Create new buffer
    const allocWidth = Math.max(1, Math.round(width * dpr));
    const allocHeight = Math.max(1, Math.round(height * dpr));
    const buffer = canvasBufferManager.allocate(key, allocWidth, allocHeight);
    // If buffer is a canvas, set its drawing scale so callers can draw in CSS pixels
    const bufferCtx = (buffer instanceof OffscreenCanvas ? buffer.getContext('2d', { willReadFrequently: true }) : (buffer as HTMLCanvasElement).getContext('2d', { willReadFrequently: true }));
    if (bufferCtx) {
      bufferCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    
    // Cache it with content hash
    this.cache[key] = {
      buffer,
      contentHash,
      width,
      height,
      dpr,
      accessCount: this.accessCounterGlobal++
    };
    
    // Clean up old buffers if cache is full
    this.cleanup();
    
    return buffer;
  }
  
  cleanup(): void {
    const keys = Object.keys(this.cache);
    
    // If over limit, remove least recently used (by access count)
    if (keys.length > this.maxCacheSize) {
      // Sort by access count (deterministic LRU)
      const sorted = Object.entries(this.cache)
        .sort((a, b) => a[1].accessCount - b[1].accessCount);
      
      const toRemove = sorted.slice(0, sorted.length - this.maxCacheSize);
      for (const [key] of toRemove) {
        canvasBufferManager.release(key);
        delete this.cache[key];
      }
    }
  }
  
  /**
   * Generate deterministic content hash for buffer validation
   */
  private generateContentHash(key: string, width: number, height: number, dpr: number): string {
    const content = `${key}:${width}:${height}:${dpr}`;
    return DeterministicIDGenerator.generateFromContent(content);
  }
  
  releaseBuffer(key: string): void {
    if (this.cache[key]) {
      canvasBufferManager.release(key);
      delete this.cache[key];
    }
  }
  
  clear(): void {
    for (const key of Object.keys(this.cache)) {
      canvasBufferManager.release(key);
    }
    this.cache = {};
  }
  
  getStats() {
    return {
      activeBuffers: Object.keys(this.cache).length,
      totalBuffers: canvasBufferManager.getStats().bufferCount,
      memoryUsage: canvasBufferManager.getStats().memoryUsage
    };
  }
  
  dispose(): void {
    this.clear();
  }
}