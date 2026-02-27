/**
 * Intersection Detection Engine
 * Finds curve-curve, curve-axis intersections and critical points
 */



export interface IntersectionPoint {
  x: number;
  y: number;
  type: 'intersection' | 'critical' | 'inflection' | 'asymptote';
  confidence: number; // 0-1
  curveIndices?: [number, number]; // For curve-curve intersections
}

export interface CriticalPoint {
  x: number;
  y: number;
  type: 'maximum' | 'minimum' | 'inflection';
  confidence: number;
}

/**
 * Detect intersections between two curves
 */
export function detectCurveIntersections(
  f1: (x: number) => number,
  f2: (x: number) => number,
  xMin: number,
  xMax: number,
  tolerance: number = 1e-6,
  maxPoints: number = 50
): IntersectionPoint[] {
  const intersections: IntersectionPoint[] = [];
  const step = (xMax - xMin) / 100;

  let prevF1 = f1(xMin);
  let prevF2 = f2(xMin);
  let prevDiff = prevF1 - prevF2;

  for (let i = 1; i <= 100 && intersections.length < maxPoints; i++) {
    const x = xMin + step * i;
    if (x > xMax) break;

    const f1Val = f1(x);
    const f2Val = f2(x);
    const diff = f1Val - f2Val;

    // Sign change indicates crossing
    if (Math.sign(prevDiff) !== Math.sign(diff) && Math.abs(diff) < 100 && Math.abs(prevDiff) < 100) {
      // Refine with binary search
      const refined = binarySearchIntersection(f1, f2, x - step, x, tolerance);
      if (refined) {
        const y = f1(refined);
        if (Number.isFinite(y)) {
          intersections.push({
            x: refined,
            y,
            type: 'intersection',
            confidence: 0.95,
            curveIndices: [0, 1],
          });
        }
      }
    }

    prevDiff = diff;
    prevF1 = f1Val;
    prevF2 = f2Val;
  }

  return intersections;
}

/**
 * Detect curve with x-axis intersections (zeros)
 */
export function detectZeros(
  f: (x: number) => number,
  xMin: number,
  xMax: number,
  tolerance: number = 1e-6,
  maxPoints: number = 50
): IntersectionPoint[] {
  const zeros: IntersectionPoint[] = [];
  const step = (xMax - xMin) / 100;

  let prevY = f(xMin);
  let prevSign = Math.sign(prevY);

  for (let i = 1; i <= 100 && zeros.length < maxPoints; i++) {
    const x = xMin + step * i;
    if (x > xMax) break;

    const y = f(x);
    const sign = Math.sign(y);

    // Sign change
    if (sign !== prevSign && Math.abs(y) < 100 && Math.abs(prevY) < 100) {
      const refined = binarySearchZero(f, x - step, x, tolerance);
      if (refined) {
        zeros.push({
          x: refined,
          y: 0,
          type: 'intersection',
          confidence: 0.95,
        });
      }
    }

    prevSign = sign;
    prevY = y;
  }

  return zeros;
}

/**
 * Find critical points (local extrema)
 */
export function detectCriticalPoints(
  f: (x: number) => number,
  xMin: number,
  xMax: number,
  maxPoints: number = 20
): CriticalPoint[] {
  const points: CriticalPoint[] = [];
  const step = (xMax - xMin) / 50;
  const h = step * 0.1;

  for (let i = 1; i < 50 && points.length < maxPoints; i++) {
    const x = xMin + step * i;
    if (x > xMax) break;

    const yMid = f(x);
    const yLeft = f(x - h);
    const yRight = f(x + h);

    if (!Number.isFinite(yMid) || !Number.isFinite(yLeft) || !Number.isFinite(yRight)) {
      continue;
    }

    const derivative1 = (yRight - yLeft) / (2 * h);

    // Zero derivative indicates potential extremum
    if (Math.abs(derivative1) < 0.01) {
      // Check second derivative using simple gradient
      const y2Left = f(x - 2 * h);
      const y2Right = f(x + 2 * h);

      if (!Number.isFinite(y2Left) || !Number.isFinite(y2Right)) continue;

      const derivative2 = (yRight - 2 * yMid + yLeft) / (h * h);

      if (Math.abs(derivative2) > 0.01) {
        const type = derivative2 > 0 ? 'minimum' : 'maximum';
        points.push({
          x,
          y: yMid,
          type,
          confidence: 0.8,
        });
      }
    }
  }

  return points;
}

/**
 * Detect asymptotes by looking for discontinuities
 */
export function detectAsymptotes(
  f: (x: number) => number,
  xMin: number,
  xMax: number,
  maxPoints: number = 20
): IntersectionPoint[] {
  const asymptotes: IntersectionPoint[] = [];
  const step = (xMax - xMin) / 100;

  let prevY = f(xMin);
  let prevFinite = Number.isFinite(prevY);

  for (let i = 1; i <= 100 && asymptotes.length < maxPoints; i++) {
    const x = xMin + step * i;
    if (x > xMax) break;

    const y = f(x);
    const finite = Number.isFinite(y);

    // Transition from finite to infinite or back
    if (finite !== prevFinite) {
      asymptotes.push({
        x,
        y: finite ? y : NaN,
        type: 'asymptote',
        confidence: 0.7,
      });
    }

    // Large jump in value (indicates asymptote)
    if (prevFinite && finite && Math.abs(y - prevY) > Math.max(10, Math.abs(prevY) * 0.5)) {
      asymptotes.push({
        x: (x + (x - step)) / 2,
        y: NaN,
        type: 'asymptote',
        confidence: 0.6,
      });
    }

    prevY = y;
    prevFinite = finite;
  }

  return asymptotes;
}

/**
 * Binary search for exact zero
 */
function binarySearchZero(
  f: (x: number) => number,
  xLeft: number,
  xRight: number,
  tolerance: number,
  maxIterations: number = 50
): number | null {
  let left = xLeft;
  let right = xRight;

  for (let i = 0; i < maxIterations; i++) {
    const mid = (left + right) / 2;
    const fMid = f(mid);

    if (Math.abs(fMid) < tolerance) {
      return mid;
    }

    const fLeft = f(left);
    if (Math.sign(fLeft) === Math.sign(fMid)) {
      left = mid;
    } else {
      right = mid;
    }

    if (Math.abs(right - left) < tolerance) {
      return (left + right) / 2;
    }
  }

  return null;
}

/**
 * Binary search for intersection point
 */
function binarySearchIntersection(
  f1: (x: number) => number,
  f2: (x: number) => number,
  xLeft: number,
  xRight: number,
  tolerance: number,
  maxIterations: number = 50
): number | null {
  let left = xLeft;
  let right = xRight;

  for (let i = 0; i < maxIterations; i++) {
    const mid = (left + right) / 2;
    const diff = f1(mid) - f2(mid);

    if (Math.abs(diff) < tolerance) {
      return mid;
    }

    const diffLeft = f1(left) - f2(left);
    if (Math.sign(diffLeft) === Math.sign(diff)) {
      left = mid;
    } else {
      right = mid;
    }

    if (Math.abs(right - left) < tolerance) {
      return (left + right) / 2;
    }
  }

  return null;
}

/**
 * Merge nearby intersections
 */
export function mergeNearbyIntersections(
  points: IntersectionPoint[],
  threshold: number = 0.1
): IntersectionPoint[] {
  if (points.length === 0) return points;

  const sorted = [...points].sort((a, b) => a.x - b.x);
  const merged: IntersectionPoint[] = [];

  let current = sorted[0]!;
  for (let i = 1; i < sorted.length; i++) {
    const s = sorted[i]!;
    if (Math.abs(s.x - current.x) < threshold) {
      // Merge: keep the one with higher confidence
      if (s.confidence > current.confidence) {
        current = s;
      }
    } else {
      merged.push(current);
      current = s;
    }
  }
  merged.push(current);

  return merged;
}
