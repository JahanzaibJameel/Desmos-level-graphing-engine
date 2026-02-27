/**
 * OperationCounter provides deterministic circuit breakers and timeouts
 * based on operation counts instead of wall-clock time.
 * 
 * This ensures identical behavior across all platforms and execution speeds.
 */

export interface CircuitBreakerConfig {
  maxOperations: number;
  name: string;
}

export class OperationCounter {
  private static counters: Map<string, number> = new Map();
  private static circuitBreakers: Map<string, CircuitBreakerConfig> = new Map();
  private static globalCounter: number = 0;

  /**
   * Increment global operation counter
   */
  static increment(): void {
    OperationCounter.globalCounter++;
  }

  /**
   * Get global operation count
   */
  static getGlobalCount(): number {
    return OperationCounter.globalCounter;
  }

  /**
   * Reset all counters
   */
  static reset(): void {
    OperationCounter.globalCounter = 0;
    OperationCounter.counters.clear();
    OperationCounter.circuitBreakers.clear();
  }

  /**
   * Create a named counter
   */
  static createCounter(name: string): Counter {
    return new Counter(name);
  }

  /**
   * Register a circuit breaker
   */
  static registerCircuitBreaker(config: CircuitBreakerConfig): CircuitBreaker {
    OperationCounter.circuitBreakers.set(config.name, config);
    return new CircuitBreaker(config.name, config.maxOperations);
  }

  /**
   * Check if circuit breaker would trip
   */
  static wouldTrip(breaker: CircuitBreaker): boolean {
    return breaker.getOperationCount() >= breaker.getMaxOperations();
  }

  /**
   * Get counter value
   */
  static getCounterValue(name: string): number {
    return OperationCounter.counters.get(name) ?? 0;
  }

  /**
   * Set counter value
   */
  static setCounterValue(name: string, value: number): void {
    OperationCounter.counters.set(name, value);
  }

  /**
   * Increment named counter
   */
  static incrementCounter(name: string): number {
    const current = OperationCounter.getCounterValue(name);
    const next = current + 1;
    OperationCounter.setCounterValue(name, next);
    OperationCounter.increment();
    return next;
  }
}

/**
 * A named counter for tracking operations in a specific context
 */
export class Counter {
  private count: number = 0;

  constructor(private name: string) {
    OperationCounter.setCounterValue(name, 0);
  }

  /**
   * Increment and check circuit breaker conditions
   */
  increment(): void {
    this.count++;
    OperationCounter.incrementCounter(this.name);
  }

  /**
   * Get current count
   */
  getCount(): number {
    return this.count;
  }

  /**
   * Reset counter
   */
  reset(): void {
    this.count = 0;
    OperationCounter.setCounterValue(this.name, 0);
  }

  /**
   * Check if operation limit exceeded
   */
  isLimited(maxOps: number): boolean {
    return this.count >= maxOps;
  }

  /**
   * Get remaining operations before limit
   */
  remaining(maxOps: number): number {
    return Math.max(0, maxOps - this.count);
  }
}

/**
 * A circuit breaker that trips after a deterministic operation count
 */
export class CircuitBreaker {
  private operationCount: number = 0;
  private isTripped: boolean = false;

  constructor(
    private name: string,
    private maxOperations: number
  ) {}

  /**
   * Execute function with circuit breaker protection
   */
  execute<T>(
    fn: () => T,
    fallback?: () => T
  ): T {
    this.operationCount++;

    if (this.operationCount > this.maxOperations) {
      this.isTripped = true;
      if (fallback) {
        return fallback();
      }
      throw new CircuitBreakerError(
        `Circuit breaker "${this.name}" tripped after ${this.maxOperations} operations`,
        {
          breaker: this.name,
          maxOperations: this.maxOperations,
          actualOperations: this.operationCount
        }
      );
    }

    try {
      return fn();
    } catch (error) {
      this.isTripped = true;
      throw error;
    }
  }

  /**
   * Check if circuit breaker has tripped
   */
  getTripped(): boolean {
    return this.isTripped;
  }

  /**
   * Get current operation count
   */
  getOperationCount(): number {
    return this.operationCount;
  }

  /**
   * Get max operations allowed
   */
  getMaxOperations(): number {
    return this.maxOperations;
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.operationCount = 0;
    this.isTripped = false;
  }

  /**
   * Get remaining operations before trip
   */
  getRemaining(): number {
    return Math.max(0, this.maxOperations - this.operationCount);
  }

  /**
   * Check if operation would exceed limit
   */
  wouldExceed(additionalOps: number = 1): boolean {
    return this.operationCount + additionalOps > this.maxOperations;
  }
}

/**
 * Error thrown when circuit breaker trips
 */
export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly context: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CircuitBreakerError';
    Object.setPrototypeOf(this, CircuitBreakerError.prototype);
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

/**
 * Deterministic timeout based on operation counts instead of wall-clock time
 */
export class DeterministicTimeout {
  private startCount: number;
  private operationLimit: number;

  constructor(
    private maxOperations: number,
    name: string = 'timeout'
  ) {
    // Ensure counter exists for tracking
    OperationCounter.createCounter(name);
    this.startCount = OperationCounter.getGlobalCount();
    this.operationLimit = this.startCount + maxOperations;
  }

  /**
   * Check if timeout has elapsed
   */
  hasElapsed(): boolean {
    return OperationCounter.getGlobalCount() >= this.operationLimit;
  }

  /**
   * Get remaining operations
   */
  getRemaining(): number {
    return Math.max(0, this.operationLimit - OperationCounter.getGlobalCount());
  }

  /**
   * Get elapsed operations
   */
  getElapsed(): number {
    return OperationCounter.getGlobalCount() - this.startCount;
  }

  /**
   * Reset timeout
   */
  reset(): void {
    this.startCount = OperationCounter.getGlobalCount();
    this.operationLimit = this.startCount + this.maxOperations;
  }
}
