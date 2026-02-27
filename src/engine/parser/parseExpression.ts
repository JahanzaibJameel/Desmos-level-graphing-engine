/**
 * Safe expression parser with full AST support
 * Handles: y=f(x), implicit equations, sliders, piecewise, parametric
 */

import { LightweightEvaluator, isLightweightCompatible } from './lightweightEvaluator';

export type ExpressionType = 
  | 'explicit' // y = f(x)
  | 'implicit' // f(x,y) = 0
  | 'parametric' // {x: f(t), y: g(t)}
  | 'polar' // r = f(θ)
  | 'inequality' // y > f(x)
  | 'slider' // a = 5
  | 'function-def' // f(x) = x^2
  | 'unknown';

export interface ParsedExpression {
  original: string;
  type: ExpressionType;
  variables: Set<string>;
  parameters: Set<string>; // a, b, etc. for sliders
  hasError: boolean;
  error?: string;
  node?: any;
  evaluator?: LightweightEvaluator; // Lightweight evaluator for simple expressions
}

export interface SliderInfo {
  name: string;
  defaultValue: number;
  minValue: number;
  maxValue: number;
  step: number;
}

const SLIDER_PATTERN = /^\s*([a-z_]\w*)\s*=\s*([\d.e+-]+)\s*$/i;

/**
 * Parse expression and classify its type
 */
export function parseExpression(text: string): ParsedExpression {
  const trimmed = text.trim();
  
  const result: ParsedExpression = {
    original: text,
    type: 'unknown',
    variables: new Set(),
    parameters: new Set(),
    hasError: false,
  };

  if (!trimmed) {
    result.error = 'Empty expression';
    result.hasError = true;
    return result;
  }

  // Check for slider definition (a = 5)
  const sliderMatch = SLIDER_PATTERN.exec(trimmed);
  if (sliderMatch) {
    result.type = 'slider';
    const name = (sliderMatch[1] ?? '').toLowerCase();
    if (name) result.parameters.add(name);
    return result;
  }
  // Lightweight variable extraction without full AST to avoid bundling mathjs
  const varPattern = /[a-zA-Z_]\w*/g;
  const names = new Set<string>();
  let m: RegExpExecArray | null;
  const knownConsts = new Set(['pi', 'e']);
  const functionNames = new Set([
    'sin','cos','tan','asin','acos','atan','sqrt','abs','log','ln','exp','pow','min','max'
  ]);

  while ((m = varPattern.exec(trimmed)) !== null) {
    const name = m[0];
    if (knownConsts.has(name.toLowerCase())) continue;
    if (functionNames.has(name.toLowerCase())) continue;
    names.add(name);
  }

  result.variables = names;

  // Classify expression type heuristically
  if (names.size === 0) {
    result.type = 'slider';
  } else if (names.size === 1) {
    const varName = Array.from(names)[0];
    if (varName === 'x') result.type = 'explicit';
    else if (varName === 'y') result.type = 'implicit';
    else if (varName === 't') result.type = 'parametric';
    else if (varName === 'theta' || varName === 'θ') result.type = 'polar';
    else result.type = 'slider';
  } else if (names.has('x') && names.has('y')) {
    result.type = 'implicit';
  } else if (names.has('x') && names.has('t')) {
    result.type = 'parametric';
  }

  // Extract parameters heuristically
  for (const v of result.variables) {
    if (/^[A-Z]|^[a-z]$|^(a|b|c|k|m|n)/.test(v)) {
      result.parameters.add(v);
    }
  }

  // Try to create a lightweight evaluator for simple expressions
  if (result.type === 'explicit' || result.type === 'parametric') {
    if (isLightweightCompatible(trimmed)) {
      try {
        result.evaluator = new LightweightEvaluator(trimmed);
      } catch {
        // Lightweight evaluator failed; mathjs will be used as fallback in CurveLayer
      }
    }
  }

  return result;
}

/**
 * Extract slider definitions from expression text
 */
export function extractSliders(expressions: string[]): SliderInfo[] {
  const sliders: Map<string, SliderInfo> = new Map();

  for (const expr of expressions) {
    const parsed = parseExpression(expr);
    if (parsed.type === 'slider' && parsed.parameters.size > 0) {
      const name = String(Array.from(parsed.parameters)[0] ?? '');
      if (!sliders.has(name) && name) {
        // Parse the value from the expression
        const match = /=\s*([\d.e+-]+)/.exec(expr);
        const value = match ? parseFloat(match[1] ?? '5') : 5;

        sliders.set(name, {
          name,
          defaultValue: value,
          minValue: Math.max(-Infinity, value - Math.abs(value) * 2) || -10,
          maxValue: value + Math.abs(value) * 2 || 10,
          step: Math.abs(value) * 0.1 || 0.5,
        });
      }
    }
  }

  return Array.from(sliders.values());
}

/**
 * Create numeric evaluator from compiled expression or lightweight evaluator.
 * Prefers lightweight evaluator if available (no mathjs dependency).
 */
export function createEvaluator(
  node: any,
  variables: Record<string, number> = {},
  lightweight?: LightweightEvaluator
): (x: number) => number {
  // Prefer lightweight evaluator if available
  if (lightweight) {
    return (x: number) => {
      try {
        return lightweight.evaluate({ x, ...variables });
      } catch {
        return NaN;
      }
    };
  }

  // Fall back to mathjs node (compiled asynchronously elsewhere)
  if (!node) {
    return () => NaN;
  }

  return (x: number) => {
    try {
      const scope = { x, ...variables };
      const result = (node as any).evaluate(scope);
      const num = typeof result === 'number' ? result : Number(result);
      return Number.isFinite(num) ? num : NaN;
    } catch {
      return NaN;
    }
  };
}

/**
 * Safe evaluate with all variables, preferring lightweight evaluator.
 */
export function evaluate(
  node: any,
  scope: Record<string, number>,
  lightweight?: LightweightEvaluator
): number {
  // Prefer lightweight evaluator if available
  if (lightweight) {
    try {
      return lightweight.evaluate(scope);
    } catch {
      return NaN;
    }
  }

  // Fall back to mathjs node
  if (!node) return NaN;

  try {
    const result = (node as any).evaluate(scope);
    const num = typeof result === 'number' ? result : Number(result);
    return Number.isFinite(num) ? num : NaN;
  } catch {
    return NaN;
  }
}
