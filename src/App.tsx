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
        const parsed = JSON.parse(expressionsData);
        // Check if any expression has nil UUID
        if (parsed.state?.expressions?.some((e: any) => e.id === '00000000-0000-0000-0000-000000000000')) {
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

  // Add default test expressions and slider on mount (with initialization guard)
  useEffect(() => {
    const exprState = useExpressionsStore.getState();
    const sliderState = useSlidersStore.getState();

    // Only initialize if both stores are empty (first real load or cleared)
    const existingExpressions = exprState.expressions;
    const existingSliders = sliderState.getSliders();

    if (existingExpressions.length > 0 || existingSliders.length > 0) {
      // Stores already have data, don't reinitialize
      return;
    }

    // Add default sliders
    sliderState.addSlider({
      name: 'a',
      value: 2,
      minValue: 0,
      maxValue: 5,
      step: 0.1,
      isAnimating: false,
      animationSpeed: 1,
    });
    sliderState.addSlider({
      name: 'b',
      value: 1,
      minValue: 0.5,
      maxValue: 3,
      step: 0.1,
      isAnimating: false,
      animationSpeed: 1,
    });
    sliderState.addSlider({
      name: 'c',
      value: 0,
      minValue: -2,
      maxValue: 2,
      step: 0.1,
      isAnimating: false,
      animationSpeed: 1,
    });

    // Add default test expressions (performance test suite)
    exprState.addExpression('sin(x)');
    exprState.addExpression('a*cos(b*x)');
    exprState.addExpression('x^2 - 2*x + 1');
    exprState.addExpression('sin(x) + cos(2*x)');
    exprState.addExpression('1/(1+exp(-x))');
    exprState.addExpression('sqrt(abs(x))');
    exprState.addExpression('sin(a*x)*cos(b*x)');
    exprState.addExpression('tan(x)');
    exprState.addExpression('x^3 - 3*x');
    exprState.addExpression('exp(-x^2)');
    // Add implicit equation test (marching squares)
    exprState.addExpression('x^2 + y^2 - 4');
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
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      {/* Skip to main content link for keyboard navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2"
      >
        Skip to main content
      </a>
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
          Desmos-Level Graphing Engine v2.0
        </h1>
        <p className="text-gray-600 mt-2">
          Production-ready mathematical graphing with enterprise features
        </p>
      </header>
      
      <main id="main-content" className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-lg p-6 h-full flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <h2 className="text-2xl font-bold text-gray-800">Graph</h2>
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={handleUndo}
                  className="px-4 py-2 text-sm font-medium bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-all"
                  title="Undo last viewport change"
                >
                  ↶ Undo
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  title="Reset to default viewport"
                >
                  🔄 Reset
                </button>
                <ExportMenu canvasRef={canvasRef} />
              </div>
            </div>
            
            <div className="flex-1 bg-gradient-to-b from-gray-50 to-white rounded-lg p-4 mb-6">
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
            
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">💡 Tips:</h4>
              <ul className="text-xs text-blue-800 space-y-1">
                <li>• <strong>Click + drag</strong> to pan</li>
                <li>• <strong>Scroll wheel</strong> to zoom</li>
                <li>• <strong>Double-click</strong> to reset</li>
                <li>• <strong>Sliders</strong> update curves in real-time</li>
              </ul>
            </div>
          </div>
        </div>
        
        <div>
          <ExpressionEditor />
          
          <SliderPanel />
          
          <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
              📊 Viewport
            </h3>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-lg">
                <span className="text-gray-600 font-medium">X Range:</span>
                <span className="font-mono text-blue-600">
                  [{viewport.current.xMin.toFixed(3)}, {viewport.current.xMax.toFixed(3)}]
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-lg">
                <span className="text-gray-600 font-medium">Y Range:</span>
                <span className="font-mono text-blue-600">
                  [{viewport.current.yMin.toFixed(3)}, {viewport.current.yMax.toFixed(3)}]
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-lg">
                <span className="text-gray-600 font-medium">Zoom:</span>
                <span className="font-mono text-green-600">{viewport.zoomLevel.toFixed(2)}x</span>
              </div>
              <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-lg">
                <span className="text-gray-600 font-medium">Curves:</span>
                <span className="font-mono text-purple-600">{expressions.length}</span>
              </div>
            </div>
          </div>
          
          <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
              ⚡ Features
            </h3>
            <ul className="space-y-2.5 text-sm text-gray-700">
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
      </div>
      </main>
      
      <footer className="mt-12 pt-8 border-t border-gray-300" role="contentinfo">
        <div className="text-center text-gray-600 text-sm">
          <p className="font-medium">Desmos-Level Graphing Engine v2.0</p>
          <p className="mt-1 flex justify-center gap-2 flex-wrap">
            <span>✓ Production Ready</span>
            <span>•</span>
            <span>✓ MIT Licensed</span>
            <span>•</span>
            <span>✓ Enterprise Architecture</span>
          </p>
          <p className="mt-3 text-xs text-gray-500">
            Built with React 19 • TypeScript • Vite • Lightweight Evaluator • Adaptive Sampling
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;