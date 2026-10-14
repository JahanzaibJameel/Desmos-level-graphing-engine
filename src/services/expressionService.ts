export type CompiledExpression = {
  node: object | null | null;
  expression: string;
};

export function validateExpression(expression: string): boolean {
  if (!expression || typeof expression !== 'string') return false;
  const trimmed = expression.trim();
  if (trimmed.length === 0) return false;

  // Lightweight safety checks: disallow access to global objects and obvious injection
  const forbidden = /(process|require|window|global|eval|constructor|self)\b/i;
  if (forbidden.test(trimmed)) return false;

  // Allow typical math characters
  const allowed = /^[0-9a-zA-Z_\s+\-*/^%().,=<>!:|&]+$/;
  return allowed.test(trimmed);
}

// Async compile if needed; dynamic-imports mathjs to avoid bundling it eagerly.
export async function compileExpression(expression: string): Promise<CompiledExpression> {
  try {
    const math: { compile: (expr: string) => object } = await import('mathjs');
    const node = (math as { compile: (expr: string) => object }).compile(expression);
    return { node, expression };
  } catch {
    return { node: null, expression };
  }
}
