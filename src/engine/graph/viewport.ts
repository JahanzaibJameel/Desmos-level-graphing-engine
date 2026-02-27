import { NumericalProofSystem } from './validation/proofSystem';
import { PrecisionManager } from '../determinism';

export interface Viewport {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  pixelRatio: number;
}

export interface ViewportConstraints {
  minXRange: number;
  minYRange: number;
  maxXRange: number;
  maxYRange: number;
  maxZoomLevel: number;
}

export class GraphViewport {
  private viewport: Viewport;
  private constraints: ViewportConstraints;
  private history: Viewport[] = [];
  private maxHistorySize = 50;
  
  constructor(
    initialViewport: Partial<Viewport> = {},
    constraints: Partial<ViewportConstraints> = {}
  ) {
    this.viewport = {
      xMin: -10,
      xMax: 10,
      yMin: -10,
      yMax: 10,
      pixelRatio: 1,
      ...initialViewport
    };
    
    this.constraints = {
      minXRange: 1e-10,
      minYRange: 1e-10,
      maxXRange: 1e12,
      maxYRange: 1e12,
      maxZoomLevel: 1e12,
      ...constraints
    };
    
    this.saveToHistory();
  }
  
  get current(): Viewport {
    return { ...this.viewport };
  }
  
  get width(): number {
    return PrecisionManager.subtract(this.viewport.xMax, this.viewport.xMin);
  }
  
  get height(): number {
    return PrecisionManager.subtract(this.viewport.yMax, this.viewport.yMin);
  }
  
  get center(): { x: number; y: number } {
    return {
      x: PrecisionManager.midpoint(this.viewport.xMin, this.viewport.xMax),
      y: PrecisionManager.midpoint(this.viewport.yMin, this.viewport.yMax)
    };
  }
  
  get zoomLevel(): number {
    const baseWidth = 20; // Initial width of 20 units
    return PrecisionManager.divide(baseWidth, this.width);
  }
  
  pan(dx: number, dy: number): void {
    this.viewport.xMin = PrecisionManager.add(this.viewport.xMin, dx);
    this.viewport.xMax = PrecisionManager.add(this.viewport.xMax, dx);
    this.viewport.yMin = PrecisionManager.add(this.viewport.yMin, dy);
    this.viewport.yMax = PrecisionManager.add(this.viewport.yMax, dy);
    this.enforceConstraints();
    this.saveToHistory();
  }
  
  zoom(factor: number, center?: { x: number; y: number }): void {
    const zoomCenter = center || this.center;
    
    const newWidth = PrecisionManager.divide(this.width, factor);
    const newHeight = PrecisionManager.divide(this.height, factor);
    
    if (PrecisionManager.lessThan(newWidth, this.constraints.minXRange) || 
        PrecisionManager.lessThan(newHeight, this.constraints.minYRange)) {
      return;
    }
    
    if (PrecisionManager.greaterThan(newWidth, this.constraints.maxXRange) || 
        PrecisionManager.greaterThan(newHeight, this.constraints.maxYRange)) {
      return;
    }
    
    const newZoomLevel = PrecisionManager.divide(20, newWidth);
    if (PrecisionManager.greaterThan(newZoomLevel, this.constraints.maxZoomLevel)) {
      return;
    }
    
    this.viewport.xMin = PrecisionManager.subtract(zoomCenter.x, PrecisionManager.divide(newWidth, 2));
    this.viewport.xMax = PrecisionManager.add(zoomCenter.x, PrecisionManager.divide(newWidth, 2));
    this.viewport.yMin = PrecisionManager.subtract(zoomCenter.y, PrecisionManager.divide(newHeight, 2));
    this.viewport.yMax = PrecisionManager.add(zoomCenter.y, PrecisionManager.divide(newHeight, 2));
    
    this.enforceConstraints();
    this.saveToHistory();
  }
  
  setViewport(newViewport: Partial<Viewport>): void {
    this.viewport = { ...this.viewport, ...newViewport };
    this.enforceConstraints();
    this.saveToHistory();
  }
  
  fitToPoints(points: Array<{ x: number; y: number }>, padding = 0.1): void {
    if (points.length === 0) return;
    
    let xMin = Infinity;
    let xMax = -Infinity;
    let yMin = Infinity;
    let yMax = -Infinity;
    
    for (const point of points) {
      xMin = Math.min(xMin, point.x);
      xMax = Math.max(xMax, point.x);
      yMin = Math.min(yMin, point.y);
      yMax = Math.max(yMax, point.y);
    }
    
    const width = PrecisionManager.subtract(xMax, xMin);
    const height = PrecisionManager.subtract(yMax, yMin);
    
    this.viewport.xMin = PrecisionManager.subtract(xMin, PrecisionManager.multiply(width, padding));
    this.viewport.xMax = PrecisionManager.add(xMax, PrecisionManager.multiply(width, padding));
    this.viewport.yMin = PrecisionManager.subtract(yMin, PrecisionManager.multiply(height, padding));
    this.viewport.yMax = PrecisionManager.add(yMax, PrecisionManager.multiply(height, padding));
    
    this.enforceConstraints();
    this.saveToHistory();
  }
  
  reset(): void {
    this.viewport = {
      xMin: -10,
      xMax: 10,
      yMin: -10,
      yMax: 10,
      pixelRatio: this.viewport.pixelRatio
    };
    this.saveToHistory();
  }
  
  undo(): boolean {
    if (this.history.length <= 1) return false;
    
    this.history.pop(); // Remove current
    const previous = this.history.pop();
    if (previous) {
      this.viewport = previous;
      this.saveToHistory();
      return true;
    }
    return false;
  }
  
  worldToScreen(x: number, y: number, canvasWidth: number, canvasHeight: number): { x: number; y: number } {
    const screenX = PrecisionManager.multiply(
      PrecisionManager.divide(PrecisionManager.subtract(x, this.viewport.xMin), this.width),
      canvasWidth
    );
    const screenY = PrecisionManager.subtract(
      canvasHeight,
      PrecisionManager.multiply(
        PrecisionManager.divide(PrecisionManager.subtract(y, this.viewport.yMin), this.height),
        canvasHeight
      )
    );
    return { x: screenX, y: screenY };
  }
  
  screenToWorld(screenX: number, screenY: number, canvasWidth: number, canvasHeight: number): { x: number; y: number } {
    const worldX = PrecisionManager.add(
      PrecisionManager.multiply(
        PrecisionManager.divide(screenX, canvasWidth),
        this.width
      ),
      this.viewport.xMin
    );
    const worldY = PrecisionManager.subtract(
      this.viewport.yMax,
      PrecisionManager.multiply(
        PrecisionManager.divide(screenY, canvasHeight),
        this.height
      )
    );
    return { x: worldX, y: worldY };
  }
  
  validateNumericalStability(): boolean {
    const proof = NumericalProofSystem.proveInvertible({
      forward: (point: { x: number; y: number }) => 
        this.worldToScreen(point.x, point.y, 800, 600),
      inverse: (point: { x: number; y: number }) =>
        this.screenToWorld(point.x, point.y, 800, 600)
    });
    
    return proof.success;
  }
  
  private enforceConstraints(): void {
    // Ensure min/max are in correct order with epsilon comparison
    if (PrecisionManager.greaterThan(this.viewport.xMin, this.viewport.xMax)) {
      [this.viewport.xMin, this.viewport.xMax] = [this.viewport.xMax, this.viewport.xMin];
    }
    if (PrecisionManager.greaterThan(this.viewport.yMin, this.viewport.yMax)) {
      [this.viewport.yMin, this.viewport.yMax] = [this.viewport.yMax, this.viewport.yMin];
    }
    
    // Ensure minimum range
    if (PrecisionManager.lessThan(this.width, this.constraints.minXRange)) {
      const centerX = PrecisionManager.midpoint(this.viewport.xMin, this.viewport.xMax);
      this.viewport.xMin = PrecisionManager.subtract(centerX, PrecisionManager.divide(this.constraints.minXRange, 2));
      this.viewport.xMax = PrecisionManager.add(centerX, PrecisionManager.divide(this.constraints.minXRange, 2));
    }
    
    if (PrecisionManager.lessThan(this.height, this.constraints.minYRange)) {
      const centerY = PrecisionManager.midpoint(this.viewport.yMin, this.viewport.yMax);
      this.viewport.yMin = PrecisionManager.subtract(centerY, PrecisionManager.divide(this.constraints.minYRange, 2));
      this.viewport.yMax = PrecisionManager.add(centerY, PrecisionManager.divide(this.constraints.minYRange, 2));
    }
    
    // Ensure maximum range
    if (PrecisionManager.greaterThan(this.width, this.constraints.maxXRange)) {
      const centerX = PrecisionManager.midpoint(this.viewport.xMin, this.viewport.xMax);
      this.viewport.xMin = PrecisionManager.subtract(centerX, PrecisionManager.divide(this.constraints.maxXRange, 2));
      this.viewport.xMax = PrecisionManager.add(centerX, PrecisionManager.divide(this.constraints.maxXRange, 2));
    }
    
    if (PrecisionManager.greaterThan(this.height, this.constraints.maxYRange)) {
      const centerY = PrecisionManager.midpoint(this.viewport.yMin, this.viewport.yMax);
      this.viewport.yMin = PrecisionManager.subtract(centerY, PrecisionManager.divide(this.constraints.maxYRange, 2));
      this.viewport.yMax = PrecisionManager.add(centerY, PrecisionManager.divide(this.constraints.maxYRange, 2));
    }
  }
  
  private saveToHistory(): void {
    this.history.push({ ...this.viewport });
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }
}