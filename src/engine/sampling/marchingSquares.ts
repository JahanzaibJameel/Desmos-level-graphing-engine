/**
 * Marching Squares implicit contour extraction
 * Finds iso-contour for f(x,y)=0 over a grid, returns array of polylines
 */

export type Point = { x: number; y: number };
export type Polyline = Point[];

interface MarchingOptions {
  cols?: number; // grid columns
  rows?: number; // grid rows
  iso?: number; // iso value to extract (0 for f(x,y)=0)
  maxSegments?: number;
}

export function marchingSquares(
  fn: (x: number, y: number) => number,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  options: MarchingOptions = {}
): Polyline[] {
  const cols = options.cols || 128;
  const rows = options.rows || 128;
  const iso = options.iso ?? 0;
  const maxSegments = options.maxSegments || 10000;

  const dx = (xMax - xMin) / cols;
  const dy = (yMax - yMin) / rows;

  // Evaluate grid
  const grid: number[][] = new Array(rows + 1);
  for (let j = 0; j <= rows; j++) {
    grid[j] = new Array<number>(cols + 1).fill(NaN);
    const y = yMin + j * dy;
    for (let i = 0; i <= cols; i++) {
      const x = xMin + i * dx;
      try {
        const v = fn(x, y);
        grid[j]![i] = typeof v === 'number' && isFinite(v) ? v : NaN;
      } catch {
        grid[j]![i] = NaN;
      }
    }
  }

  const segments: Polyline[] = [];

  function sampleEdge(i: number, j: number, edge: number): Point | null {
    // edge: 0=left,1=top,2=right,3=bottom
    let x1 = 0, y1 = 0, v1: number | undefined = undefined;
    let x2 = 0, y2 = 0, v2: number | undefined = undefined;
    if (edge === 0) {
      x1 = xMin + i * dx; y1 = yMin + j * dy; v1 = grid[j]![i]!;
      x2 = xMin + i * dx; y2 = yMin + (j + 1) * dy; v2 = grid[j + 1]![i]!;
    } else if (edge === 1) {
      x1 = xMin + i * dx; y1 = yMin + (j + 1) * dy; v1 = grid[j + 1]![i]!;
      x2 = xMin + (i + 1) * dx; y2 = yMin + (j + 1) * dy; v2 = grid[j + 1]![i + 1]!;
    } else if (edge === 2) {
      x1 = xMin + (i + 1) * dx; y1 = yMin + (j + 1) * dy; v1 = grid[j + 1]![i + 1]!;
      x2 = xMin + (i + 1) * dx; y2 = yMin + j * dy; v2 = grid[j]![i + 1]!;
    } else {
      x1 = xMin + (i + 1) * dx; y1 = yMin + j * dy; v1 = grid[j]![i + 1]!;
      x2 = xMin + i * dx; y2 = yMin + j * dy; v2 = grid[j]![i]!;
    }

    if (!isFinite(v1) || !isFinite(v2)) return null;
    const t = (iso - v1) / (v2 - v1);
    if (!isFinite(t)) return null;
    const sx = x1 + t * (x2 - x1);
    const sy = y1 + t * (y2 - y1);
    return { x: sx, y: sy };
  }

  // Marching squares case table: for each 4-bit index list edges intersected
  const edgeTable: number[][] = [
    [], [0,3], [3,2], [0,2], [1,2], [0,1,2,3], [1,3], [0,1],
    [0,1], [1,3], [0,1,2,3], [1,2], [0,2], [3,2], [0,3], []
  ];

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const v00 = grid[j]![i]!;
      const v10 = grid[j]![i + 1]!;
      const v11 = grid[j + 1]![i + 1]!;
      const v01 = grid[j + 1]![i]!;

      const b0 = isFinite(v00) && v00 > iso ? 1 : 0;
      const b1 = isFinite(v10) && v10 > iso ? 1 : 0;
      const b2 = isFinite(v11) && v11 > iso ? 1 : 0;
      const b3 = isFinite(v01) && v01 > iso ? 1 : 0;

      const idx = b0 | (b1 << 1) | (b2 << 2) | (b3 << 3);
      const edges = edgeTable[idx];
      if (!edges || edges.length === 0) continue;

      // For simple approach, create line segments between consecutive edge samples
      const poly: Polyline = [];
      for (let k = 0; k < edges.length; k++) {
        const e = edges[k]!;
        const p = sampleEdge(i, j, e);
        if (p) poly.push(p);
      }
      if (poly.length >= 2) {
        segments.push(poly);
        if (segments.length >= maxSegments) return segments;
      }
    }
  }

  return segments;
}
