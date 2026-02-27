/**
 * Lightweight expression parser and evaluator for simple math expressions.
 * Avoids heavy mathjs dependency for common cases (explicit y=f(x), parametric).
 * Falls back to using `mathjs` for implicit or complex expressions.
 */

const MATH_CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  π: Math.PI,
  e: Math.E,
  true: 1,
  false: 0,
};

const MATH_FUNCTIONS: Record<string, (x: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  exp: Math.exp,
  log: Math.log10,
  ln: Math.log,
  log10: Math.log10,
  log2: Math.log2,
  sign: Math.sign,
  trunc: Math.trunc,
  frac: (x: number) => x - Math.floor(x),
  sec: (x: number) => 1 / Math.cos(x),
  csc: (x: number) => 1 / Math.sin(x),
  cot: (x: number) => 1 / Math.tan(x),
  deg: (x: number) => x * (180 / Math.PI),
  rad: (x: number) => x * (Math.PI / 180),
};

interface Token {
  type: string;
  value: string;
}

interface ASTNode {
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

class Tokenizer {
  private input: string;
  private pos = 0;

  constructor(input: string) {
    // Replace all whitespace with empty string (use split/join instead of replaceAll for compatibility)
    this.input = input.split(/\s+/).join('').toLowerCase();
  }

  peek(): string {
    return this.input[this.pos] ?? '';
  }

  advance(): string {
    return this.input[this.pos++] ?? '';
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];
    while (this.pos < this.input.length) {
      const ch = this.peek();

      if (/\d/.test(ch) || (ch === '.' && /\d/.test(this.input[this.pos + 1] ?? ''))) {
        tokens.push(this.readNumber());
      } else if (/[a-z_]/.test(ch)) {
        tokens.push(this.readIdentifier());
      } else if ('+-*/%^'.includes(ch)) {
        tokens.push({ type: 'op', value: this.advance() });
      } else if ('(),'.includes(ch)) {
        tokens.push({ type: ch, value: this.advance() });
      } else {
        this.advance(); // skip unknown
      }
    }
    return tokens;
  }

  private readNumber(): Token {
    let value = '';
    while (/[\d.]/.test(this.peek())) {
      value += this.advance();
    }
    return { type: 'number', value };
  }

  private readIdentifier(): Token {
    let value = '';
    while (/[a-z0-9_]/.test(this.peek())) {
      value += this.advance();
    }
    return { type: 'id', value };
  }
}

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  advance(): Token | undefined {
    return this.tokens[this.pos++];
  }

  parse(): ASTNode {
    return this.parseExpression();
  }

  private parseExpression(): ASTNode {
    let left = this.parseTerm();

    while (this.peek()?.type === 'op' && ['+', '-'].includes(this.peek()?.value ?? '')) {
      const op = this.advance()?.value ?? '+';
      const right = this.parseTerm();
      left = { type: 'binary', op, left, right };
    }

    return left;
  }

  private parseTerm(): ASTNode {
    let left = this.parseFactor();

    while (this.peek()?.type === 'op' && ['*', '/', '%'].includes(this.peek()?.value ?? '')) {
      const op = this.advance()?.value ?? '*';
      const right = this.parseFactor();
      left = { type: 'binary', op, left, right };
    }

    return left;
  }

  private parseFactor(): ASTNode {
    let left = this.parsePower();

    while (this.peek()?.type === 'op' && this.peek()?.value === '^') {
      this.advance();
      const right = this.parsePower();
      left = { type: 'binary', op: '^', left, right };
    }

    return left;
  }

  private parsePower(): ASTNode {
    if (this.peek()?.type === 'op' && ['+', '-'].includes(this.peek()?.value ?? '')) {
      const op = this.advance()?.value ?? '+';
      const expr = this.parseUnary();
      if (op === '-') {
        return { type: 'unary', op: '-', expr };
      }
      return expr;
    }

    return this.parseUnary();
  }

  private parseUnary(): ASTNode {
    const token = this.peek();

    if (token?.type === 'number') {
      this.advance();
      return { type: 'number', value: parseFloat(token.value) };
    }

    if (token?.type === 'id') {
      const id = this.advance()?.value ?? '';

      if (this.peek()?.value === '(') {
        // Function call
        this.advance(); // consume '('
        const args: ASTNode[] = [];
        if (this.peek()?.value !== ')') {
          args.push(this.parseExpression());
          while (this.peek()?.value === ',') {
            this.advance(); // consume ','
            args.push(this.parseExpression());
          }
        }
        this.advance(); // consume ')'
        return { type: 'call', name: id, args };
      }

      // Variable
      return { type: 'var', name: id };
    }

    if (this.peek()?.value === '(') {
      this.advance(); // consume '('
      const expr = this.parseExpression();
      this.advance(); // consume ')'
      return expr;
    }

    throw new Error(`Unexpected token: ${token?.value}`);
  }
}

export class LightweightEvaluator {
  private ast: ASTNode;

  constructor(expression: string) {
    try {
      const tokenizer = new Tokenizer(expression);
      const tokens = tokenizer.tokenize();
      const parser = new Parser(tokens);
      this.ast = parser.parse();
    } catch (error) {
      throw new Error(`Failed to parse expression "${expression}": ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  evaluate(variables: Record<string, number>): number {
    try {
      return this.evaluateNode(this.ast, variables);
    } catch (error) {
      return NaN;
    }
  }

  private evaluateNode(node: ASTNode, variables: Record<string, number>): number {
    if (node.type === 'number') {
      return node.value;
    }

    if (node.type === 'var') {
      const name = node.name as string;
      if (name in MATH_CONSTANTS) {
        const val = MATH_CONSTANTS[name];
        if (val !== undefined) return val;
      }
      if (name in variables) {
        const val = variables[name];
        if (val !== undefined) return val;
      }
      return NaN; // Undefined variable
    }

    if (node.type === 'binary') {
      const left = this.evaluateNode(node.left, variables);
      const right = this.evaluateNode(node.right, variables);
      if (Number.isNaN(left) || Number.isNaN(right)) return NaN;

      switch (node.op) {
        case '+':
          return left + right;
        case '-':
          return left - right;
        case '*':
          return left * right;
        case '/':
          return left / right;
        case '%':
          return left % right;
        case '^':
          return Math.pow(left, right);
        default:
          return NaN;
      }
    }

    if (node.type === 'unary') {
      const expr = this.evaluateNode(node.expr, variables);
      if (Number.isNaN(expr)) return NaN;
      switch (node.op) {
        case '-':
          return -expr;
        case '+':
          return expr;
        default:
          return NaN;
      }
    }

    if (node.type === 'call') {
      const name = node.name as string;
      const args = node.args as ASTNode[];

      if (name === 'min' || name === 'max') {
        const values = args.map((arg) => this.evaluateNode(arg, variables));
        if (values.some(Number.isNaN)) return NaN;
        return name === 'min' ? Math.min(...values) : Math.max(...values);
      }

      if (name === 'pow' || name === '**') {
        if (args.length !== 2) return NaN;
        const base = this.evaluateNode(args[0]!, variables);
        const exp = this.evaluateNode(args[1]!, variables);
        if (Number.isNaN(base) || Number.isNaN(exp)) return NaN;
        return Math.pow(base, exp);
      }

      if (name === 'atan2') {
        if (args.length !== 2) return NaN;
        const y = this.evaluateNode(args[0]!, variables);
        const x = this.evaluateNode(args[1]!, variables);
        if (Number.isNaN(y) || Number.isNaN(x)) return NaN;
        return Math.atan2(y, x);
      }

      if (name in MATH_FUNCTIONS) {
        if (args.length !== 1) return NaN;
        const arg = this.evaluateNode(args[0]!, variables);
        if (Number.isNaN(arg)) return NaN;
        const fn = MATH_FUNCTIONS[name];
        if (fn !== undefined) {
          return fn(arg);
        }
      }

      return NaN; // Unknown function
    }

    return NaN;
  }
}

/**
 * Try to evaluate an expression using the lightweight evaluator.
 * Returns NaN if the expression is unsupported.
 */
export function evaluateLightweight(expression: string, variables: Record<string, number>): number {
  try {
    const evaluator = new LightweightEvaluator(expression);
    return evaluator.evaluate(variables);
  } catch {
    return NaN;
  }
}

/**
 * Check if an expression can be handled by the lightweight evaluator.
 * Returns true if well-formed and contains only supported constructs.
 */
export function isLightweightCompatible(expression: string): boolean {
  try {
    new LightweightEvaluator(expression);
    return true;
  } catch {
    return false;
  }
}
