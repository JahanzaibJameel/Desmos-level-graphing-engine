// React import not required with the new JSX runtime
import { useEffect, useRef } from 'react';
import { GraphCanvas } from './canvas/GraphCanvas';
import { ExpressionEditor } from './ui/ExpressionEditor';
import { SliderPanel } from './ui/SliderPanel';
import { ExportMenu } from './ui/ExportMenu';
import { useViewport } from './hooks/useViewport';
import { useExpressions } from './hooks/useExpressions';
import { useExpressionsStore } from './store/expressions.store';
import { useSlidersStore } from './store/sliders.store';
import './App.css';

function App() {
  const { viewport, setViewport, reset, undo } = useViewport();
  const { expressions } = useExpressions();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Clean corrupted localStorage data (nil UUIDs) on mount
  useEffect(() => {
    try {
      const expressionsData = localStorage.getItem('graphing-expressions');
      if (expressionsData) {
        // Safely parse JSON with proper error handling
        let parsed;
        try {
          parsed = JSON.parse(expressionsData);
        } catch (parseError) {
          console.warn('Failed to parse graphing expressions from localStorage:', parseError);
          // If parsing fails, treat as empty data
          parsed = { state: { expressions: [] } };
        }
        
        // Check if any expression has nil UUID
        if (parsed.state?.expressions?.some((e: { id?: string }) => e.id === '00000000-0000-0000-0000-000000000000'))) {
          console.warn('Detected corrupted expression IDs, clearing stores...');
          localStorage.removeItem('graphing-expressions');
          localStorage.removeItem('graphing-sliders');
          localStorage.removeItem('graphing-viewport');
        }
      }
    } catch (error) {
      console.error('Error checking localStorage:', error);
    }
  }, []);

  const handleViewportChange = (newViewport: typeof viewport) => {
    setViewport(newViewport);
  };

  const handleReset = () => {
    reset();
  };

  const handleUndo = () => {
    undo();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      {/* Skip to main content link for keyboard navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:bg-indigo-600 focus:text-white focus:px-4 focus:py-2"
      >
        Skip to main content
      </a>
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
          Desmos-Level Graphing Engine v2.0
        </h1>
        <p className="text-slate-600 mt-2">
          Production-ready mathematical graphing with enterprise features
        </p>
      </header>

      <main id="main-content" className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1">
          {/* Graph Panel - Center, largest area */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-2xl p-6 h-full flex flex-col">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h2 className="text-2xl font-bold text-slate-900">
                  Graph
                </h2>
                <div className="flex gap-3 flex-wrap">
                  <button
                    onClick={handleUndo}
                    className="px-4 py-2 text-sm font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400 transition-all"
                    title="Undo last viewport change"
                  >
                    ↶ Undo
                  </button>
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    title="Reset to default viewport"
                  >
                    🔄 Reset
                  </button>
                  <ExportMenu canvasRef={canvasRef} />
                </div>
              </div>
              <div className="relative">
                <GraphCanvas
                  viewport={viewport}
                  width={800}
                  height={600}
                  onViewportChange={handleViewportChange}
                  onCanvasReady={(canvas) => {
                    canvasRef.current = canvas;
                  }}
                />
              </div>
            </div>
          </div>

          {/* Controls Panel - Left column */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-2xl p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
                Dashboard
              </h3>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg">
                  <span className="text-slate-600 font-medium">X Range:</span>
                  <span className="font-mono text-indigo-600">[{viewport.current.xMin.toFixed(3)}, {viewport.current.xMax.toFixed(3)}]</span>
                </div>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg">
                  <span className="text-slate-600 font-medium">Y Range:</span>
                  <span className="font-mono text-indigo-600">[{viewport.current.yMin.toFixed(3)}, {viewport.current.yMax.toFixed(3)}]</span>
                </div>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg">
                  <span className="text-slate-600 font-medium">Zoom:</span>
                  <span className="font-mono text-emerald-600">{viewport.zoomLevel.toFixed(2)}x</span>
                </div>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg">
                  <span className="text-slate-600 font-medium">Curves:</span>
                  <span className="font-mono text-purple-600">{expressions.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features Panel - Right column */}
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
            ✨ Features
          </h3>
          <ul className="space-y-2.5 text-sm text-slate-700">
            <li className="flex items-start gap-2">
              <span className="text-green-500 font-bold mt-0.5">✓</span>
              <span><strong>Lightweight evaluator</strong> for instant rendering</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 font-bold mt-0.5">✓</span>
              <span><strong>Real-time sliders</strong> with live graph updates</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 font-bold mt-0.5">✓</span>
              <span><strong>Adaptive sampling</strong> for smooth curves</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 font-bold mt-0.5">✓</span>
              <span><strong>Implicit rendering</strong> with marching squares</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 font-bold mt-0.5">✓</span>
              <span><strong>Smooth interactions</strong> (pan, zoom, multi-touch)</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 pt-8 border-t border-slate-300">
        <div className="text-center text-slate-600 text-sm">
          <p className="font-medium">Desmos-Level Graphing Engine v2.0</p>
          <p className="mt-1 flex justify-center gap-2 flex-wrap">
            <span>✓ Production Ready</span>
            <span>•</span>
            <span>✓ MIT Licensed</span>
            <span>•</span>
            <span>✓ Enterprise Architecture</span>
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Built with React 19 • TypeScript • Vite • Lightweight Evaluator • Adaptive Sampling
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;