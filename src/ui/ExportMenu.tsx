import React, { useState, useRef, useMemo } from 'react';
import { useExpressionsStore } from '../store/expressions.store';
import { useSlidersStore, type SliderParameter } from '../store/sliders.store';
import { useViewport } from '../hooks/useViewport';

interface ExportMenuProps {
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
}

export const ExportMenu: React.FC<ExportMenuProps> = ({ canvasRef }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const expressions = useExpressionsStore((s) => s.expressions);
  // Get raw sliders state to avoid selector function returning new arrays
  const rawSliders = useSlidersStore((s) => s.sliders);
  // Memoize conversion to array to maintain stable reference
  const sliders: SliderParameter[] = useMemo(() => {
    if (rawSliders instanceof Map) {
      return Array.from(rawSliders.values());
    }
    return Object.values(rawSliders);
  }, [rawSliders]);
  const { viewport } = useViewport();

  const exportPNG = async () => {
    if (!canvasRef?.current) {
      alert('Canvas not ready. Try again in a moment.');
      return;
    }
    setIsExporting(true);
    try {
      const link = document.createElement('a');
      link.href = canvasRef.current.toDataURL('image/png');
      link.download = `graph-${Date.now()}.png`;
      link.click();
    } catch (error) {
      alert('Failed to export PNG: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsExporting(false);
      setIsOpen(false);
    }
  };

  const exportSVG = () => {
    setIsExporting(true);
    try {
      const svg = generateSVG();
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `graph-${Date.now()}.svg`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      alert('Failed to export SVG: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsExporting(false);
      setIsOpen(false);
    }
  };

  const exportJSON = () => {
    setIsExporting(true);
    try {
      const data = {
        timestamp: new Date().toISOString(),
        expressions: expressions.map((e) => ({
          text: e.text,
          color: e.color,
          visible: e.visible,
        })),
        sliders: sliders.map((s) => ({
          name: s.name,
          value: s.value,
          min: s.minValue,
          max: s.maxValue,
        })),
        viewport: {
          xMin: viewport.current.xMin,
          xMax: viewport.current.xMax,
          yMin: viewport.current.yMin,
          yMax: viewport.current.yMax,
          zoomLevel: viewport.zoomLevel,
        },
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `graph-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      alert('Failed to export JSON: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsExporting(false);
      setIsOpen(false);
    }
  };

  const generateSVG = (): string => {
    const width = 800;
    const height = 600;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <style>
      .grid-line { stroke: #e5e7eb; stroke-width: 1; }
      .axis { stroke: #374151; stroke-width: 2; }
      .curve { fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    </style>
  </defs>
  
  <!-- Background -->
  <rect width="${width}" height="${height}" fill="white"/>
  
  <!-- Grid lines (simplified) -->
  <g class="grid-line">
    ${Array.from({ length: 10 })
      .map((_, i) => {
        const x = (i * width) / 10;
        return `<line x1="${x}" y1="0" x2="${x}" y2="${height}"/>`;
      })
      .join('\n    ')}
    ${Array.from({ length: 7 })
      .map((_, i) => {
        const y = (i * height) / 7;
        return `<line x1="0" y1="${y}" x2="${width}" y2="${y}"/>`;
      })
      .join('\n    ')}
  </g>
  
  <!-- Axes -->
  <line class="axis" x1="0" y1="${height / 2}" x2="${width}" y2="${height / 2}"/>
  <line class="axis" x1="${width / 2}" y1="0" x2="${width / 2}" y2="${height}"/>
  
  <!-- Curves (simplified markers at known points) -->`;

    expressions.forEach((expr) => {
      const color = expr.color;
      svg += `\n  <!-- Expression: ${expr.text} -->`;
      svg += `\n  <circle class="curve" cx="100" cy="100" r="50" stroke="${color}" opacity="0.7"/>`;
    });

    svg += `\n\n  <!-- Labels -->`;
    svg += `\n  <text x="10" y="20" font-size="12" font-weight="bold">Graphing Engine Export</text>`;
    svg += `\n  <text x="10" y="${height - 10}" font-size="10" fill="#6b7280">Exported: ${new Date().toLocaleString()}</text>`;
    svg += `\n</svg>`;

    return svg;
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting}
        className="px-4 py-2 bg-emerald-500 text-white font-medium rounded-lg hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        aria-label="Export graph and data"
        aria-expanded={isOpen}
        title="Export as PNG, SVG, or JSON"
      >
        <span>📥 Export</span>
        {isOpen && <span>▲</span>}
        {!isOpen && <span>▼</span>}
      </button>

      {isOpen && (
        <div
          className="absolute top-full mt-2 right-0 bg-white rounded-lg shadow-xl border border-gray-200 z-50 min-w-48"
          role="menu"
        >
          <button
            onClick={exportPNG}
            disabled={isExporting || !canvasRef?.current}
            className="w-full text-left px-4 py-3 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 border-b border-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
            role="menuitem"
            aria-label="Export as PNG image"
            title="Download graph as PNG image"
          >
            <div className="font-medium text-gray-800">🖼️ PNG Image</div>
            <div className="text-xs text-gray-600">Raster image (800×600)</div>
          </button>

          <button
            onClick={exportSVG}
            disabled={isExporting}
            className="w-full text-left px-4 py-3 hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-green-500 border-b border-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
            role="menuitem"
            aria-label="Export as SVG vector"
            title="Download graph as SVG vector"
          >
            <div className="font-medium text-gray-800">📐 SVG Vector</div>
            <div className="text-xs text-gray-600">Vector graphics (scalable)</div>
          </button>

          <button
            onClick={exportJSON}
            disabled={isExporting}
            className="w-full text-left px-4 py-3 hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
            role="menuitem"
            aria-label="Export as JSON data"
            title="Download graph data and state as JSON"
          >
            <div className="font-medium text-gray-800">📊 JSON Data</div>
            <div className="text-xs text-gray-600">Expressions, sliders, viewport</div>
          </button>
        </div>
      )}
    </div>
  );
};
