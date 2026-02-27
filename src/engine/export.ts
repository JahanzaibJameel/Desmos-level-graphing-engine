/**
 * Export System
 * SVG, PNG, JSON, MathML, URL-shareable state
 */

import { Expression } from '../store/expressions.store';
import { GraphViewport } from './graph/viewport';

export interface ExportOptions {
  width?: number;
  height?: number;
  includeGrid?: boolean;
  includeAxes?: boolean;
  backgroundColor?: string;
  highRes?: boolean;
}

/**
 * Export as SVG (vector format)
 */
export function exportSVG(
  expressions: Expression[],
  viewport: GraphViewport,
  points: Array<{ x: number; y: number; color: string }>,
  intersections: Array<{ x: number; y: number }>,
  options: ExportOptions = {}
): string {
  const w = options.width ?? 800;
  const h = options.height ?? 600;
  const bg = options.backgroundColor ?? '#ffffff';

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <style>
      .grid-line { stroke: #e0e0e0; stroke-width: 0.5; }
      .axis { stroke: #000; stroke-width: 2; }
      .curve { fill: none; stroke-width: 2; }
      .point { fill: currentColor; }
      .intersection { fill: #ff0000; r: 3; }
    </style>
  </defs>
  
  <!-- Background -->
  <rect width="${w}" height="${h}" fill="${bg}" />
`;

  // Grid
  if (options.includeGrid !== false) {
    svg += generateGridSVG(viewport, w, h);
  }

  // Axes
  if (options.includeAxes !== false) {
    svg += generateAxesSVG(viewport, w, h);
  }

  // Curves
  for (let i = 0; i < expressions.length; i++) {
    const expr = expressions[i];
    if (!expr || !expr.visible) continue;

    const pathData = generatePathFromPoints(points.filter(p => (p as any).exprIndex === i));
    if (pathData && expr) {
      svg += `  <path class="curve" d="${pathData}" stroke="${expr.color}" />\n`;
    }
  }

  // Intersections
  if (intersections.length > 0) {
    for (const point of intersections) {
      svg += `  <circle class="intersection" cx="${scaleX(point.x, viewport, w)}" cy="${scaleY(point.y, viewport, h)}" />\n`;
    }
  }

  svg += '</svg>';
  return svg;
}

/**
 * Export canvas to PNG
 */
export async function exportPNG(
  canvas: HTMLCanvasElement,
  filename: string = 'graph.png'
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        downloadBlob(blob, filename);
      }
      resolve(blob);
    }, 'image/png');
  });
}

/**
 * Export as JSON state
 */
export function exportJSON(
  expressions: Expression[],
  viewport: GraphViewport,
  sliders: Record<string, number>
): string {
  const state = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    expressions: expressions.map(e => ({
      text: e.text,
      color: e.color,
      visible: e.visible,
    })),
    viewport: {
      xMin: viewport.current.xMin,
      xMax: viewport.current.xMax,
      yMin: viewport.current.yMin,
      yMax: viewport.current.yMax,
      pixelRatio: viewport.current.pixelRatio,
    },
    sliders,
  };

  return JSON.stringify(state, null, 2);
}

/**
 * Export as MathML
 */
export function exportMathML(expressions: string[]): string {
  let mathml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  mathml += '<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">\n';
  mathml += '  <mrow>\n';

  for (let i = 0; i < expressions.length; i++) {
    if (i > 0) mathml += '    <mo>,</mo>\n';
    const expr = expressions[i] ?? '';
    mathml += `    <!-- Expression: ${expr} -->\n`;
    mathml += `    <mi>${escapeXml(expr)}</mi>\n`;
  }

  mathml += '  </mrow>\n</math>';
  return mathml;
}

/**
 * Create shareable URL with compressed state
 */
export function createShareableURL(
  expressions: Expression[],
  viewport: GraphViewport,
  sliders: Record<string, number>,
  baseURL: string = 'https://graphing.example.com'
): string {
  const state = {
    e: expressions.map(e => `${e.text}|${(e.color ?? '#000000').substring(1)}`).join(';'),
    x: `${viewport.current.xMin.toFixed(2)}-${viewport.current.xMax.toFixed(2)}`,
    y: `${viewport.current.yMin.toFixed(2)}-${viewport.current.yMax.toFixed(2)}`,
    s: Object.entries(sliders).map(([k, v]) => `${k}:${v.toFixed(2)}`).join(';'),
  };

  const params = new URLSearchParams(state as any);
  return `${baseURL}?${params.toString()}`;
}

/**
 * Generate grid SVG
 */
function generateGridSVG(viewport: GraphViewport, w: number, h: number): string {
  let grid = '';
  const vp = viewport.current;

  // Vertical grid lines
  const xStep = (vp.xMax - vp.xMin) / 10;
  for (let i = 0; i <= 10; i++) {
    const x = vp.xMin + xStep * i;
    const px = scaleX(x, viewport, w);
    grid += `  <line class="grid-line" x1="${px}" y1="0" x2="${px}" y2="${h}" />\n`;
  }

  // Horizontal grid lines
  const yStep = (vp.yMax - vp.yMin) / 10;
  for (let i = 0; i <= 10; i++) {
    const y = vp.yMin + yStep * i;
    const py = scaleY(y, viewport, h);
    grid += `  <line class="grid-line" x1="0" y1="${py}" x2="${w}" y2="${py}" />\n`;
  }

  return grid;
}

/**
 * Generate axes SVG
 */
function generateAxesSVG(viewport: GraphViewport, w: number, h: number): string {
  const vp = viewport.current;
  const xAxisY = scaleY(0, viewport, h);
  const yAxisX = scaleX(0, viewport, w);

  let axes = '';

  // X-axis
  if (vp.yMin <= 0 && vp.yMax >= 0) {
    axes += `  <line class="axis" x1="0" y1="${xAxisY}" x2="${w}" y2="${xAxisY}" />\n`;
  }

  // Y-axis
  if (vp.xMin <= 0 && vp.xMax >= 0) {
    axes += `  <line class="axis" x1="${yAxisX}" y1="0" x2="${yAxisX}" y2="${h}" />\n`;
  }

  return axes;
}

/**
 * Generate SVG path from point array
 */
function generatePathFromPoints(points: Array<{ x: number; y: number } | null | undefined>): string {
  const validPoints = points.filter((p): p is { x: number; y: number } => p !== null && p !== undefined);
  if (validPoints.length === 0) return '';

  const pathData = validPoints
    .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y))
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  return pathData;
}

/**
 * Scale world X to SVG pixel
 */
function scaleX(x: number, viewport: GraphViewport, width: number): number {
  const vp = viewport.current;
  return ((x - vp.xMin) / (vp.xMax - vp.xMin)) * width;
}

/**
 * Scale world Y to SVG pixel (inverted)
 */
function scaleY(y: number, viewport: GraphViewport, height: number): number {
  const vp = viewport.current;
  return ((vp.yMax - y) / (vp.yMax - vp.yMin)) * height;
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Trigger file download
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download text file
 */
export function downloadText(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'text/plain' });
  downloadBlob(blob, filename);
}

/**
 * Download JSON
 */
export function downloadJSON(text: string, filename: string = 'export.json'): void {
  const blob = new Blob([text], { type: 'application/json' });
  downloadBlob(blob, filename);
}

/**
 * Download SVG
 */
export function downloadSVG(svg: string, filename: string = 'graph.svg'): void {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  downloadBlob(blob, filename);
}
