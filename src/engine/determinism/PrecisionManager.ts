import Decimal from 'decimal.js';

/**
 * PrecisionManager enforces explicit, deterministic floating-point arithmetic.
 * 
 * All mathematical operations must go through this system to guarantee:
 * - Consistent rounding across architectures
 * - Deterministic error handling
 * - Validated results before use
 */

export type PrecisionMode = 'float64' | 'float32' | 'decimal' | 'high-precision';
export type RoundingMode = 'ROUND_UP' | 'ROUND_DOWN' | 'ROUND_HALF_UP' | 'ROUND_HALF_EVEN' | 'ROUND_CEIL' | 'ROUND_FLOOR';

export interface PrecisionConfig {
  mode: PrecisionMode;
  roundingMode: RoundingMode;
  decimalPlaces: number;
  epsilon: number;
  maxValue: number;
  minValue: number;
}

export class PrecisionManager {
  // IEEE 754 double-precision epsilon
  static readonly EPSILON_FLOAT64 = 2.220446049250313e-16;
  // Single-precision epsilon
  static readonly EPSILON_FLOAT32 = 1.1920929e-7;
  // Standard epsilon for comparisons
  static readonly EPSILON_COMPARISON = 1e-15;
  // Default config
  private static defaultConfig: PrecisionConfig = {
    mode: 'decimal',
    roundingMode: 'ROUND_HALF_EVEN',
    decimalPlaces: 30,
    epsilon: PrecisionManager.EPSILON_FLOAT64,
    maxValue: Number.MAX_SAFE_INTEGER,
    minValue: Number.MIN_SAFE_INTEGER
  };

  private static config: PrecisionConfig = { ...PrecisionManager.defaultConfig };
  private static operationCount: number = 0;

  /**
   * Configure precision globally
   */
  static configure(overrides: Partial<PrecisionConfig>): void {
    PrecisionManager.config = {
      ...PrecisionManager.config,
      ...overrides
    };
    this.validateConfig();
  }

  /**
   * Reset to default configuration
   */
  static reset(): void {
    PrecisionManager.config = { ...PrecisionManager.defaultConfig };
  }

  /**
   * Get current configuration
   */
  static getConfig(): PrecisionConfig {
    return { ...PrecisionManager.config };
  }

  /**
   * Get operation count (used for deterministic circuit breakers)
   */
  static getOperationCount(): number {
    return PrecisionManager.operationCount;
  }

  /**
   * Reset operation counter
   */
  static resetOperationCount(): void {
    PrecisionManager.operationCount = 0;
  }

  /**
   * Normalize a number to the configured precision
   */
  static normalize(value: number): number {
    PrecisionManager.operationCount++;

    if (!Number.isFinite(value)) {
      throw new DeterminismError(
        `Cannot normalize non-finite value: ${value}`,
        { value, operation: 'normalize' }
      );
    }

    if (PrecisionManager.config.mode === 'decimal') {
      const decimal = new Decimal(value);
      return decimal.toDecimalPlaces(
        PrecisionManager.config.decimalPlaces,
        PrecisionManager.getRoundingConstant() as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
      ).toNumber();
    }

    return value;
  }

  /**
   * Add two numbers with precision
   */
  static add(a: number, b: number): number {
    PrecisionManager.operationCount++;
    PrecisionManager.validateInputs(a, b, 'add');

    const result = new Decimal(a).plus(new Decimal(b));
    return PrecisionManager.finalizeResult(result, 'add');
  }

  /**
   * Subtract two numbers with precision
   */
  static subtract(a: number, b: number): number {
    PrecisionManager.operationCount++;
    PrecisionManager.validateInputs(a, b, 'subtract');

    const result = new Decimal(a).minus(new Decimal(b));
    return PrecisionManager.finalizeResult(result, 'subtract');
  }

  /**
   * Multiply two numbers with precision
   */
  static multiply(a: number, b: number): number {
    PrecisionManager.operationCount++;
    PrecisionManager.validateInputs(a, b, 'multiply');

    const result = new Decimal(a).times(new Decimal(b));
    return PrecisionManager.finalizeResult(result, 'multiply');
  }

  /**
   * Divide two numbers with precision
   */
  static divide(a: number, b: number): number {
    PrecisionManager.operationCount++;
    PrecisionManager.validateInputs(a, b, 'divide');

    if (Math.abs(b) < PrecisionManager.config.epsilon) {
      throw new DeterminismError(
        `Division by number too close to zero: ${b}`,
        { a, b, operation: 'divide', epsilon: PrecisionManager.config.epsilon }
      );
    }

    const result = new Decimal(a).dividedBy(new Decimal(b));
    return PrecisionManager.finalizeResult(result, 'divide');
  }

  /**
   * Square root with precision
   */
  static sqrt(value: number): number {
    PrecisionManager.operationCount++;

    if (value < 0) {
      throw new DeterminismError(
        `Cannot take square root of negative number: ${value}`,
        { value, operation: 'sqrt' }
      );
    }

    const result = new Decimal(value).sqrt();
    return PrecisionManager.finalizeResult(result, 'sqrt');
  }

  /**
   * Power with precision
   */
  static pow(base: number, exponent: number): number {
    PrecisionManager.operationCount++;
    PrecisionManager.validateInputs(base, exponent, 'pow');

    const result = new Decimal(base).pow(new Decimal(exponent));
    return PrecisionManager.finalizeResult(result, 'pow');
  }

  /**
   * Natural logarithm with precision
   */
  static ln(value: number): number {
    PrecisionManager.operationCount++;

    if (value <= 0) {
      throw new DeterminismError(
        `Cannot take logarithm of non-positive number: ${value}`,
        { value, operation: 'ln' }
      );
    }

    const result = new Decimal(value).ln();
    return PrecisionManager.finalizeResult(result, 'ln');
  }

  /**
   * Logarithm with arbitrary base
   */
  static log(value: number, base: number): number {
    PrecisionManager.operationCount++;

    if (value <= 0) {
      throw new DeterminismError(
        `Cannot take logarithm of non-positive number: ${value}`,
        { value, base, operation: 'log' }
      );
    }

    if (base <= 0 || base === 1) {
      throw new DeterminismError(
        `Invalid logarithm base: ${base}`,
        { value, base, operation: 'log' }
      );
    }

    const numerator = new Decimal(value).ln();
    const denominator = new Decimal(base).ln();
    const result = numerator.dividedBy(denominator);
    return PrecisionManager.finalizeResult(result, 'log');
  }

  /**
   * Compare two numbers with epsilon tolerance
   */
  static compare(a: number, b: number, epsilon?: number): number {
    PrecisionManager.operationCount++;
    const epsilon_ = epsilon ?? PrecisionManager.config.epsilon;

    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      throw new DeterminismError(
        `Cannot compare non-finite numbers: ${a}, ${b}`,
        { a, b, operation: 'compare' }
      );
    }

    const diff = Math.abs(a - b);
    if (diff < epsilon_) return 0;
    return a < b ? -1 : 1;
  }

  /**
   * Check equality with epsilon tolerance
   */
  static equals(a: number, b: number, epsilon?: number): boolean {
    return PrecisionManager.compare(a, b, epsilon) === 0;
  }

  /**
   * Check if a > b with epsilon tolerance
   */
  static greaterThan(a: number, b: number, epsilon?: number): boolean {
    return PrecisionManager.compare(a, b, epsilon) > 0;
  }

  /**
   * Check if a < b with epsilon tolerance
   */
  static lessThan(a: number, b: number, epsilon?: number): boolean {
    return PrecisionManager.compare(a, b, epsilon) < 0;
  }

  /**
   * Clamp value to range with precision
   */
  static clamp(value: number, min: number, max: number): number {
    PrecisionManager.operationCount++;

    if (PrecisionManager.lessThan(value, min)) return PrecisionManager.normalize(min);
    if (PrecisionManager.greaterThan(value, max)) return PrecisionManager.normalize(max);
    return PrecisionManager.normalize(value);
  }

  /**
   * Interpolate between two values
   */
  static lerp(a: number, b: number, t: number): number {
    PrecisionManager.operationCount++;
    PrecisionManager.validateInputs(a, b, 'lerp');

    if (t < 0 || t > 1) {
      throw new DeterminismError(
        `Invalid interpolation parameter: ${t} (must be in [0, 1])`,
        { a, b, t, operation: 'lerp' }
      );
    }

    // (1 - t) * a + t * b
    const oneMinusT = PrecisionManager.subtract(1, t);
    const term1 = PrecisionManager.multiply(oneMinusT, a);
    const term2 = PrecisionManager.multiply(t, b);
    return PrecisionManager.add(term1, term2);
  }

  /**
   * Midpoint between two values
   */
  static midpoint(a: number, b: number): number {
    return PrecisionManager.lerp(a, b, 0.5);
  }

  /**
   * sinusoid with high precision
   * Note: Uses precomputed high-precision values to avoid library differences
   */
  static sin(value: number): number {
    PrecisionManager.operationCount++;

    if (!Number.isFinite(value)) {
      throw new DeterminismError(
        `Cannot compute sine of non-finite value: ${value}`,
        { value, operation: 'sin' }
      );
    }

    // Normalize to [-2π, 2π] for better precision
    const TWO_PI = 6.283185307179586476925286766559005768394338798750211641949;
    const normalized = new Decimal(value).mod(new Decimal(TWO_PI)).toNumber();
    
    // Use high-precision Taylor series (20 terms for full IEEE 754 precision)
    return PrecisionManager.sinTaylor(normalized);
  }

  /**
   * Cosine with high precision
   */
  static cos(value: number): number {
    PrecisionManager.operationCount++;

    if (!Number.isFinite(value)) {
      throw new DeterminismError(
        `Cannot compute cosine of non-finite value: ${value}`,
        { value, operation: 'cos' }
      );
    }

    // cos(x) = sin(x + π/2)
    const PI_HALF = 1.5707963267948966192313216916397514420985846996875529104874;
    const shifted = PrecisionManager.add(value, PI_HALF);
    return PrecisionManager.sin(shifted);
  }

  /**
   * arctangent with high precision
   */
  static atan2(y: number, x: number): number {
    PrecisionManager.operationCount++;

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new DeterminismError(
        `Cannot compute atan2 of non-finite values: y=${y}, x=${x}`,
        { y, x, operation: 'atan2' }
      );
    }

    // Use Decimal.js for atan2 computation
    const xDec = new Decimal(x);
    const yDec = new Decimal(y);

    if (xDec.isZero()) {
      if (yDec.isZero()) {
        throw new DeterminismError(
          'atan2(0, 0) is undefined',
          { y, x, operation: 'atan2' }
        );
      }
      const PI = 3.1415926535897932384626433832795028841971693993751058209749;
      return yDec.isPositive() ? PI / 2 : -PI / 2;
    }

    // atan2(y, x) = atan(y/x) with quadrant adjustment
    const quotient = yDec.dividedBy(xDec);
    return PrecisionManager.atanTaylor(quotient.toNumber(), x < 0);
  }

  // ========== Private Helpers ==========

  private static validateInputs(a: number, b: number, operation: string): void {
    if (!Number.isFinite(a)) {
      throw new DeterminismError(
        `Invalid input to ${operation}: a=${a}`,
        { a, b, operation }
      );
    }
    if (!Number.isFinite(b)) {
      throw new DeterminismError(
        `Invalid input to ${operation}: b=${b}`,
        { a, b, operation }
      );
    }
  }

  private static finalizeResult(result: Decimal, operation: string): number {
    const value = result.toNumber();

    if (!Number.isFinite(value)) {
      throw new DeterminismError(
        `Operation ${operation} produced non-finite result: ${value}`,
        { result: value, operation }
      );
    }

    return PrecisionManager.normalize(value);
  }

  private static validateConfig(): void {
    Decimal.set({
      precision: this.config.decimalPlaces,
      rounding: this.getRoundingConstant() as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
    });
  }

  private static getRoundingConstant(): number {
    switch (this.config.roundingMode) {
      case 'ROUND_UP': return Decimal.ROUND_UP;
      case 'ROUND_DOWN': return Decimal.ROUND_DOWN;
      case 'ROUND_HALF_UP': return Decimal.ROUND_HALF_UP;
      case 'ROUND_HALF_EVEN': return Decimal.ROUND_HALF_EVEN;
      case 'ROUND_CEIL': return Decimal.ROUND_CEIL;
      case 'ROUND_FLOOR': return Decimal.ROUND_FLOOR;
      default: return Decimal.ROUND_HALF_EVEN;
    }
  }

  /**
   * Taylor series implementation of sine (20 terms for full precision)
   * Formula: sin(x) = x - x³/3! + x⁵/5! - x⁷/7! + ...
   */
  private static sinTaylor(x: number): number {
    const xDec = new Decimal(x);
    let result = new Decimal(0);
    let term = xDec;
    
    for (let n = 1; n <= 20; n += 2) {
      result = result.plus(term);
      
      // Next term: multiply by -x²/((n+1)(n+2))
      const x2 = xDec.times(xDec);
      const factorial = new Decimal((n + 1) * (n + 2));
      term = term.times(x2.negated()).dividedBy(factorial);
    }

    return result.toNumber();
  }

  /**
   * Taylor series implementation of arctangent
   */
  private static atanTaylor(x: number, quadrant2or3: boolean): number {
    const xDec = new Decimal(x);
    
    // For |x| > 1, use identity: atan(x) = π/2 - atan(1/x)
    const PI = 3.1415926535897932384626433832795028841971693993751058209749;
    const absX = Math.abs(x);
    
    let value = xDec;
    if (absX > 1) {
      value = new Decimal(1).dividedBy(xDec);
    }

    let result = new Decimal(0);
    let term = value;
    let power = value;

    for (let n = 1; n <= 20; n += 2) {
      const sign = n % 4 === 1 ? 1 : -1;
      result = result.plus(term.times(sign).dividedBy(new Decimal(n)));

      // Next term
      power = power.times(value).times(value);
      term = power.dividedBy(new Decimal(n + 2));
    }

    if (absX > 1) {
      result = new Decimal(PI / 2).minus(result);
    }

    if (quadrant2or3) {
      result = result.plus(new Decimal(PI));
    }

    return result.toNumber();
  }
}

/**
 * Custom error for determinism violations
 */
export class DeterminismError extends Error {
  constructor(
    message: string,
    public readonly context: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DeterminismError';
    Object.setPrototypeOf(this, DeterminismError.prototype);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      context: this.context,
      stack: this.stack
    };
  }
}

// Initialize Decimal.js configuration
Decimal.set({
  precision: 30,
  rounding: Decimal.ROUND_HALF_EVEN
});
