import { OperationCounter, DeterministicTimeout } from '../../engine/determinism';
import { PrecisionManager } from '../../engine/determinism';

interface SamplingOptions {
  maxPoints?: number;
  tolerance?: number;
  maxDepth?: number;
  maxOperations?: number;
}

export class AdaptiveSampler {
  private maxPoints: number;
  private tolerance: number;
  private maxDepth: number;
  private maxOperations: number;
  
  constructor(options: SamplingOptions = {}) {
    this.maxPoints = options.maxPoints || 10000;
    this.tolerance = options.tolerance || 0.1;
    this.maxDepth = options.maxDepth || 20;
    // Max operations replaces timeout - use operation count not wall-clock time
    this.maxOperations = options.maxOperations || 100000;
  }
  
  sample(
    fn: (x: number) => number,
    domain: [number, number],
    options?: SamplingOptions
  ): Array<{ x: number; y: number }> {
    const operationTimeout = new DeterministicTimeout(
      options?.maxOperations || this.maxOperations,
      'adaptive-sampler'
    );
    
    const localMaxPoints = options?.maxPoints || this.maxPoints;
    const localTolerance = options?.tolerance || this.tolerance;
    const localMaxDepth = options?.maxDepth || this.maxDepth;
    
    const points: Array<{ x: number; y: number }> = [];
    const stack: Array<[number, number, number]> = [[domain[0], domain[1], 0]];
    
    while (stack.length > 0 && points.length < localMaxPoints) {
      OperationCounter.increment();
      
      // Check deterministic operation-count-based timeout
      if (operationTimeout.hasElapsed()) {
        console.warn(`Sampling operation limit reached: ${operationTimeout.getElapsed()} operations`);
        break;
      }
      
      const [a, b, depth] = stack.pop()!;
      
      if (depth >= localMaxDepth) {
        // Max depth reached, add points
        this.addPoints(fn, a, b, points, 2);
        continue;
      }
      
      // Use PrecisionManager for midpoint calculation
      const mid = PrecisionManager.midpoint(a, b);
      const fa = this.safeEvaluate(fn, a);
      const fb = this.safeEvaluate(fn, b);
      const fm = this.safeEvaluate(fn, mid);
      
      // Check if values are valid
      if (!this.isValid(fa) || !this.isValid(fb) || !this.isValid(fm)) {
        this.addPoints(fn, a, b, points, 2);
        continue;
      }
      
      // Check if linear approximation is sufficient
      const expectedMidY = PrecisionManager.midpoint(fa, fb);
      const error = Math.abs(PrecisionManager.subtract(fm, expectedMidY));
      
      if (PrecisionManager.lessThan(error, localTolerance)) {
        this.addPoints(fn, a, b, points, 2);
      } else {
        // Need more refinement
        stack.push([mid, b, depth + 1]);
        stack.push([a, mid, depth + 1]);
      }
    }
    
    // Deterministic sort by x coordinate using PrecisionManager comparison
    points.sort((a, b) => PrecisionManager.compare(a.x, b.x));
    
    return points;
  }
  
  private safeEvaluate(fn: (x: number) => number, x: number): number {
    try {
      const result = fn(x);
      return this.isValid(result) ? result : NaN;
    } catch {
      return NaN;
    }
  }
  
  private isValid(value: number): boolean {
    return typeof value === 'number' && isFinite(value);
  }
  
  private addPoints(
    fn: (x: number) => number,
    a: number,
    b: number,
    points: Array<{ x: number; y: number }>,
    count: number
  ): void {
    for (let i = 0; i < count; i++) {
      // Deterministic point calculation: a + (i / (count - 1)) * (b - a)
      const t = count === 1 ? 0 : PrecisionManager.divide(i, count - 1);
      const interval = PrecisionManager.subtract(b, a);
      const x = PrecisionManager.add(a, PrecisionManager.multiply(t, interval));
      const y = this.safeEvaluate(fn, x);
      
      if (this.isValid(y)) {
        points.push({ x, y });
      }
    }
  }
}