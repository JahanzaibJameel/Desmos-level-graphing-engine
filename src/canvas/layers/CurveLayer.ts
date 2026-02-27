import { GraphViewport } from '../../engine/graph/viewport';
import { BufferManager } from '../BufferManager';
import { AdaptiveSampler } from '../../engine/sampling/adaptive';
import { marchingSquares } from '../../engine/sampling/marchingSquares';
import { useSlidersStore } from '../../store/sliders.store';
import { parseExpression, evaluate } from '../../engine/parser/parseExpression';

export class CurveLayer {
  private bufferManager: BufferManager;
  private viewport: GraphViewport | null = null;
  private expressions: string[] = [];
  private parsedExpressions: ReturnType<typeof parseExpression>[] = [];
  private sampler: AdaptiveSampler;
  private compiledEvaluators: Array<(x: number) => number> = [];
  private compiledNodes: Array<any | null> = [];
  private colors: string[] = [
    '#3b82f6', // blue-500
    '#ef4444', // red-500
    '#10b981', // emerald-500
    '#f59e0b', // amber-500
    '#8b5cf6', // violet-500
    '#ec4899', // pink-500
    '#06b6d4', // cyan-500
    '#84cc16', // lime-500
  ];
  
  constructor(bufferManager: BufferManager) {
    this.bufferManager = bufferManager;
    this.sampler = new AdaptiveSampler();
  }
  
  updateViewport(viewport: GraphViewport): void {
    this.viewport = viewport;
  }
  
  setExpressions(expressions: string[]): void {
    this.expressions = expressions;
    this.parsedExpressions = expressions.map((expr) => parseExpression(expr));
    
    // Prepare placeholders for mathjs nodes (async compilation for implicit only)
    this.compiledNodes = new Array(expressions.length).fill(null);
    this.compiledEvaluators = this.parsedExpressions.map((parsed, idx) => {
      const expr = expressions[idx] ?? '';
      
      // If we have a lightweight evaluator, use it immediately (no async needed)
      if (parsed.evaluator) {
        return (x: number) => {
          try {
            const sliderScope = useSlidersStore.getState().getSliderScope();
            return evaluate(null, { x, ...sliderScope }, parsed.evaluator);
          } catch {
            return NaN;
          }
        };
      }
      
      // For implicit equations, kick off async mathjs compilation
      if (/\by\b/.test(expr)) {
        (async () => {
          try {
            const math = await import('mathjs');
            const node = math.compile(expr);
            this.compiledNodes[idx] = node;
          } catch (e) {
            // leave as null
          }
        })();
      }

      return (x: number) => {
        const node = this.compiledNodes[idx];
        if (!node) return NaN;
        try {
          const sliderScope = useSlidersStore.getState().getSliderScope();
          const scope = { x, ...sliderScope };
          const result = (node as any).evaluate(scope);
          const num = typeof result === 'number' ? result : Number(result);
          return Number.isFinite(num) ? num : NaN;
        } catch {
          return NaN;
        }
      };
    });
  }
  
  render(ctx: CanvasRenderingContext2D, width: number, height: number, dpr = 1): void {
    void dpr;
    if (!this.viewport || this.expressions.length === 0) return;
    
    const { xMin, xMax, yMin, yMax } = this.viewport.current;
    const viewportWidth = xMax - xMin;
    const viewportHeight = yMax - yMin;
    
    ctx.save();
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    for (let i = 0; i < this.expressions.length; i++) {
      const expression = this.expressions[i];
      const color = this.colors[i % this.colors.length] ?? '#3b82f6';
      
      try {
        const expr = this.expressions[i] ?? '';
        // Heuristic: if expression contains 'y' variable, treat as implicit f(x,y)=0
        if (/\by\b/.test(expr)) {
          // compile to function of (x,y)
          try {
            const node = this.compiledNodes[i];
            if (!node) throw new Error('not compiled yet');
            const fn = (x: number, y: number) => {
              try {
                const sliderScope = useSlidersStore.getState().getSliderScope();
                const scope = { x, y, ...sliderScope } as any;
                const v = node.evaluate(scope);
                return typeof v === 'number' ? v : Number(v);
              } catch {
                return NaN;
              }
            };

            const segments = marchingSquares(fn, xMin, xMax, yMin, yMax, { cols: 150, rows: 150 });
            // Render each polyline
            for (const poly of segments) {
              this.renderCurve(ctx, poly, width, height, xMin, yMin, viewportWidth, viewportHeight, color);
            }
          } catch (e) {
            // fallback to explicit sampling
            const evaluator = this.compiledEvaluators[i] ?? this.createEvaluator();
            const points = this.sampler.sample(evaluator, [xMin, xMax], { maxPoints: 10000, tolerance: 0.1 });
            this.renderCurve(ctx, points, width, height, xMin, yMin, viewportWidth, viewportHeight, color);
          }
        } else {
          const evaluator = this.compiledEvaluators[i] ?? this.createEvaluator();
          const points = this.sampler.sample(
            evaluator,
            [xMin, xMax],
            { maxPoints: 10000, tolerance: 0.1 }
          );

          this.renderCurve(ctx, points, width, height, xMin, yMin, viewportWidth, viewportHeight, color);
        }
      } catch (error) {
        console.error(`Failed to render expression: ${expression}`, error);
      }
    }
    
    ctx.restore();
  }
  
  private createEvaluator(): (x: number) => number {
    // Fallback evaluator: until async compilation completes, return NaN
    return (x: number) => {
      void x;
      return NaN;
    };
  }
  
  private renderCurve(
    ctx: CanvasRenderingContext2D,
    points: Array<{ x: number; y: number }>,
    width: number,
    height: number,
    xMin: number,
    yMin: number,
    viewportWidth: number,
    viewportHeight: number,
    color: string
  ): void {
    ctx.strokeStyle = color;
    ctx.beginPath();
    
    let firstValid = true;
    
    for (const point of points) {
      const screenX = ((point.x - xMin) / viewportWidth) * width;
      const screenY = height - ((point.y - yMin) / viewportHeight) * height;
      
      if (isFinite(screenX) && isFinite(screenY)) {
        if (firstValid) {
          ctx.moveTo(screenX, screenY);
          firstValid = false;
        } else {
          ctx.lineTo(screenX, screenY);
        }
      } else {
        // Break the path at discontinuities
        firstValid = true;
      }
    }
    
    ctx.stroke();
  }
  
  dispose(): void {
    // Clean up sampler resources if needed
    // reference bufferManager to avoid unused-private warning
    void this.bufferManager;
  }
}