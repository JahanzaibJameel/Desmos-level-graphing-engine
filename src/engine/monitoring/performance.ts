/**
 * Performance Monitoring System
 * Tracks FPS, render time, memory usage
 * Implements adaptive degradation strategy
 */

export type PerformanceStrategy = 'precise' | 'approximate' | 'degraded' | 'webgl';

export interface PerformanceMetrics {
  fps: number;
  frameTime: number; // milliseconds
  renderTime: number;
  lastFrameTime: number;
  averageFps: number;
  memoryUsage: number; // bytes
  sampleCount: number;
  strategy: PerformanceStrategy;
}

export interface PerformanceTarget {
  targetFps: number;
  maxRenderTime: number; // milliseconds
  maxMemory: number; // bytes
}

/**
 * Performance Monitor
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    fps: 60,
    frameTime: 16.67,
    renderTime: 0,
    lastFrameTime: 0,
    averageFps: 60,
    memoryUsage: 0,
    sampleCount: 0,
    strategy: 'precise',
  };

  private frameTimes: number[] = [];
  private renderTimes: number[] = [];
  private maxSamples = 60; // 1 second at 60fps
  private lastTime = performance.now();
  private lastMemoryCheck = performance.now();

  private target: PerformanceTarget = {
    targetFps: 60,
    maxRenderTime: 16, // < 60 FPS
    maxMemory: 256 * 1024 * 1024, // 256 MB
  };

  /**
   * Record frame start
   */
  frameStart(): void {
    this.lastTime = performance.now();
  }

  /**
   * Record frame end and update metrics
   */
  frameEnd(renderTime: number): void {
    const now = performance.now();
    const frameTime = now - this.lastTime;

    this.frameTimes.push(frameTime);
    this.renderTimes.push(renderTime);

    if (this.frameTimes.length > this.maxSamples) {
      this.frameTimes.shift();
      this.renderTimes.shift();
    }

    this.updateMetrics();
  }

  /**
   * Check memory periodically
   */
  private updateMetrics(): void {
    const now = performance.now();

    // Update FPS calculations
    if (this.frameTimes.length > 0) {
      const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
      this.metrics.averageFps = avgFrameTime > 0 ? 1000 / avgFrameTime : 0;
      this.metrics.frameTime = avgFrameTime;

      if (this.frameTimes.length > 0) {
        const lastFrameTime = this.frameTimes[this.frameTimes.length - 1]!;
        this.metrics.fps = lastFrameTime > 0 ? 1000 / lastFrameTime : 0;
      }
    }

    if (this.renderTimes.length > 0) {
      this.metrics.renderTime = this.renderTimes.reduce((a, b) => a + b, 0) / this.renderTimes.length;
    }

    // Check memory every 1 second
    if (now - this.lastMemoryCheck > 1000) {
      this.lastMemoryCheck = now;
      if ((performance as any).memory) {
        this.metrics.memoryUsage = ((performance as any).memory as any).usedJSHeapSize || 0;
      }
    }

    // Update strategy
    this.updateStrategy();
  }

  /**
   * Determine rendering strategy based on performance
   */
  private updateStrategy(): void {
    const fps = this.metrics.averageFps;
    const memory = this.metrics.memoryUsage;

    if (fps >= this.target.targetFps * 0.9 && memory < this.target.maxMemory * 0.8) {
      this.metrics.strategy = 'precise';
    } else if (fps >= this.target.targetFps * 0.7 && memory < this.target.maxMemory * 0.9) {
      this.metrics.strategy = 'approximate';
    } else if (fps >= 30 && memory < this.target.maxMemory) {
      this.metrics.strategy = 'degraded';
    } else {
      this.metrics.strategy = 'webgl'; // Would switch to WebGL if available
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Should reduce sample quality
   */
  shouldReduceQuality(): boolean {
    return this.metrics.strategy !== 'precise';
  }

  /**
   * Get sample reduction factor (0-1)
   */
  getSampleReduction(): number {
    switch (this.metrics.strategy) {
      case 'precise': return 1.0;
      case 'approximate': return 0.7;
      case 'degraded': return 0.4;
      case 'webgl': return 0.2;
      default: return 1.0;
    }
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.frameTimes = [];
    this.renderTimes = [];
    this.metrics = {
      fps: 60,
      frameTime: 16.67,
      renderTime: 0,
      lastFrameTime: 0,
      averageFps: 60,
      memoryUsage: 0,
      sampleCount: 0,
      strategy: 'precise',
    };
  }
}

/**
 * Quick FPS counter
 */
export class FPSCounter {
  private frameCount = 0;
  private lastTime = performance.now();
  private fps = 60;

  tick(): number {
    this.frameCount++;
    const now = performance.now();
    const elapsed = now - this.lastTime;

    if (elapsed >= 1000) {
      this.fps = (this.frameCount * 1000) / elapsed;
      this.frameCount = 0;
      this.lastTime = now;
    }

    return this.fps;
  }

  getFPS(): number {
    return this.fps;
  }

  reset(): void {
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.fps = 60;
  }
}

/**
 * Memory tracker
 */
export class MemoryTracker {
  private samples: number[] = [];
  private maxSamples = 60;

  record(): number {
    if ((performance as any).memory) {
      const used = (((performance as any).memory) as any).usedJSHeapSize || 0;
      this.samples.push(used);
      if (this.samples.length > this.maxSamples) {
        this.samples.shift();
      }
      return used;
    }
    return 0;
  }

  getAverage(): number {
    if (this.samples.length === 0) return 0;
    return this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
  }

  getPeak(): number {
    return Math.max(...this.samples, 0);
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
