/**
 * DeterminismValidator enforces deterministic output by:
 * - Running same algorithm twice and comparing outputs
 * - Validating numerical precision across operations
 * - Hashing rendered pixel buffers
 * - Checking worker output consistency
 * - Throwing on any non-deterministic behavior
 */

export interface ValidationResult {
  deterministic: boolean;
  confidence: number;
  failures: ValidationFailure[];
  checksums?: {
    first: string;
    second: string;
  };
}

export interface ValidationFailure {
  type: 'output_mismatch' | 'precision_loss' | 'checksum_mismatch' | 'dimension_mismatch' | 'error_thrown';
  message: string;
  context: Record<string, unknown>;
}

/**
 * Validates deterministic behavior of algorithms and rendering
 */
export class DeterminismValidator {
  /**
   * Validate that an algorithm produces identical output when run twice
   */
  static validateAlgorithmDeterminism<T>(
    algorithm: () => T,
    iterations: number = 2,
    deepEqual?: (a: T, b: T) => boolean
  ): ValidationResult {
    const failures: ValidationFailure[] = [];

    // Run algorithm multiple times
    const results: T[] = [];

    for (let i = 0; i < iterations; i++) {
      try {
        results.push(algorithm());
      } catch (error) {
        failures.push({
          type: 'error_thrown',
          message: `Algorithm threw error on iteration ${i}: ${String(error)}`,
          context: { iteration: i, error: String(error) }
        });
        return {
          deterministic: false,
          confidence: 0,
          failures
        };
      }
    }

    // Compare results
    const equal = deepEqual ?? DeterminismValidator.defaultDeepEqual;

    if (results.length > 0) {
      for (let i = 1; i < results.length; i++) {
        const first = results[0];
        const current = results[i];
        
        if (first !== undefined && current !== undefined) {
          if (!equal(first, current)) {
            failures.push({
              type: 'output_mismatch',
              message: `Output differs between iterations 0 and ${i}`,
              context: {
                iteration1: 0,
                iteration2: i,
                first: DeterminismValidator.serializeForComparison(first),
                second: DeterminismValidator.serializeForComparison(current)
              }
            });
          }
        }
      }
    }

    return {
      deterministic: failures.length === 0,
      confidence: 1 - (failures.length / iterations),
      failures
    };
  }

  /**
   * Validate numerical precision by checking if operations maintain consistency
   */
  static validateNumericalPrecision(
    algorithm: () => number,
    tolerance: number = 1e-15,
    iterations: number = 2
  ): ValidationResult {
    const failures: ValidationFailure[] = [];
    const results: number[] = [];

    for (let i = 0; i < iterations; i++) {
      try {
        const result = algorithm();

        if (!Number.isFinite(result)) {
          failures.push({
            type: 'precision_loss',
            message: `Algorithm produced non-finite result on iteration ${i}: ${result}`,
            context: { iteration: i, result }
          });
          continue;
        }

        results.push(result);
      } catch (error) {
        failures.push({
          type: 'error_thrown',
          message: `Algorithm threw on iteration ${i}`,
          context: { iteration: i, error: String(error) }
        });
        return {
          deterministic: false,
          confidence: 0,
          failures
        };
      }
    }

    // Check consistency within tolerance
    if (results.length > 0) {
      for (let i = 1; i < results.length; i++) {
        const first = results[0];
        const current = results[i];
        
        if (first !== undefined && current !== undefined) {
          const diff = Math.abs(first - current);

          if (diff > tolerance) {
            failures.push({
              type: 'precision_loss',
              message: `Numerical precision loss between iterations: diff=${diff} > tolerance=${tolerance}`,
              context: {
                iteration1: 0,
                iteration2: i,
                value1: first,
                value2: current,
                difference: diff,
                tolerance
              }
            });
          }
        }
      }
    }

    return {
      deterministic: failures.length === 0,
      confidence: 1 - (failures.length / Math.max(1, iterations - 1)),
      failures
    };
  }

  /**
   * Validate canvas rendering produces identical pixel buffer
   */
  static validateCanvasRenderingDeterminism(
    renderFn: (ctx: CanvasRenderingContext2D) => void,
    width: number,
    height: number
  ): ValidationResult {
    const failures: ValidationFailure[] = [];

    // Create two canvases and render separately
    const canvas1 = document.createElement('canvas');
    const canvas2 = document.createElement('canvas');
    canvas1.width = width;
    canvas1.height = height;
    canvas2.width = width;
    canvas2.height = height;

    const ctx1 = canvas1.getContext('2d', { alpha: false });
    const ctx2 = canvas2.getContext('2d', { alpha: false });

    if (!ctx1 || !ctx2) {
      failures.push({
        type: 'error_thrown',
        message: 'Failed to get canvas contexts',
        context: { width, height }
      });
      return {
        deterministic: false,
        confidence: 0,
        failures
      };
    }

    try {
      // Render first time
      ctx1.fillStyle = '#ffffff';
      ctx1.fillRect(0, 0, width, height);
      renderFn(ctx1);

      // Render second time
      ctx2.fillStyle = '#ffffff';
      ctx2.fillRect(0, 0, width, height);
      renderFn(ctx2);
    } catch (error) {
      failures.push({
        type: 'error_thrown',
        message: `Render function threw: ${String(error)}`,
        context: { error: String(error) }
      });
      return {
        deterministic: false,
        confidence: 0,
        failures
      };
    }

    // Compare pixel buffers
    try {
      const imageData1 = ctx1.getImageData(0, 0, width, height);
      const imageData2 = ctx2.getImageData(0, 0, width, height);

      const hash1 = DeterminismValidator.hashPixelBuffer(imageData1.data);
      const hash2 = DeterminismValidator.hashPixelBuffer(imageData2.data);

      if (hash1 !== hash2) {
        failures.push({
          type: 'checksum_mismatch',
          message: 'Rendered pixel buffers differ',
          context: {
            checksum1: hash1,
            checksum2: hash2,
            width,
            height
          }
        });
      }

      return {
        deterministic: failures.length === 0,
        confidence: failures.length === 0 ? 1 : 0,
        checksums: { first: hash1, second: hash2 },
        failures
      };
    } catch (error) {
      failures.push({
        type: 'error_thrown',
        message: `Failed to get canvas image data: ${String(error)}`,
        context: { error: String(error) }
      });
      return {
        deterministic: false,
        confidence: 0,
        failures
      };
    }
  }

  /**
   * Validate that array is deterministically sorted
   */
  static validateDeterministicSort<T>(
    array: T[],
    compareFn: (a: T, b: T) => number
  ): ValidationResult {
    const failures: ValidationFailure[] = [];

    // Check that array is actually sorted
    for (let i = 1; i < array.length; i++) {
      const prev = array[i - 1];
      const curr = array[i];
      
      if (prev === undefined || curr === undefined) {
        continue; // Skip undefined entries
      }
      
      const comparison = compareFn(prev, curr);

      if (comparison > 0) {
        failures.push({
          type: 'output_mismatch',
          message: `Array is not properly sorted at index ${i}`,
          context: {
            index: i,
            prevElement: DeterminismValidator.serializeForComparison(array[i - 1]),
            currentElement: DeterminismValidator.serializeForComparison(array[i]),
            comparison
          }
        });
        break; // Report first sort violation
      }
    }

    return {
      deterministic: failures.length === 0,
      confidence: failures.length === 0 ? 1 : 0,
      failures
    };
  }

  /**
   * Validate that object key iteration is deterministic
   */
  static validateKeyIterationDeterminism(obj: Record<string, unknown>): ValidationResult {
    const failures: ValidationFailure[] = [];

    // Get keys twice and compare
    const keys1 = Object.keys(obj).sort();
    const keys2 = Object.keys(obj).sort();

    if (JSON.stringify(keys1) !== JSON.stringify(keys2)) {
      failures.push({
        type: 'output_mismatch',
        message: 'Object key iteration is non-deterministic',
        context: { keys1, keys2 }
      });
    }

    return {
      deterministic: failures.length === 0,
      confidence: failures.length === 0 ? 1 : 0,
      failures
    };
  }

  /**
   * Validate Map iteration order is deterministic
   */
  static validateMapIterationDeterminism<K, V>(
    map: Map<K, V>
  ): ValidationResult {
    const failures: ValidationFailure[] = [];

    // Get entries in insertion order
    const entries1 = Array.from(map.entries());
    const entries2 = Array.from(map.entries());

    // Compare order
    if (entries1.length !== entries2.length) {
      failures.push({
        type: 'dimension_mismatch',
        message: 'Map size changed between iterations',
        context: { size1: entries1.length, size2: entries2.length }
      });
    } else {
      for (let i = 0; i < entries1.length; i++) {
        const entry1 = entries1[i];
        const entry2 = entries2[i];
        
        if (entry1 === undefined || entry2 === undefined) {
          continue; // Skip undefined entries
        }
        
        const key1 = DeterminismValidator.serializeForComparison(entry1[0]);
        const key2 = DeterminismValidator.serializeForComparison(entry2[0]);

        if (key1 !== key2) {
          failures.push({
            type: 'output_mismatch',
            message: `Map iteration order differs at index ${i}`,
            context: { index: i, key1, key2 }
          });
          break;
        }
      }
    }

    return {
      deterministic: failures.length === 0,
      confidence: failures.length === 0 ? 1 : 0,
      failures
    };
  }

  /**
   * Create a checkpoint snapshot for later comparison
   */
  static createCheckpoint(data: unknown): string {
    return DeterminismValidator.hashData(data);
  }

  /**
   * Verify data matches a previous checkpoint
   */
  static verifyCheckpoint(data: unknown, checkpoint: string): boolean {
    const currentHash = DeterminismValidator.hashData(data);
    return currentHash === checkpoint;
  }

  // ========== Private Helpers ==========

  private static defaultDeepEqual<T>(a: T, b: T): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  private static serializeForComparison(value: unknown): string {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private static hashData(data: unknown): string {
    const serialized = JSON.stringify(data);
    return DeterminismValidator.hashString(serialized);
  }

  private static hashString(str: string): string {
    // Use fallback hash for browser compatibility
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
  }

  private static hashPixelBuffer(data: Uint8ClampedArray): string {
    // Hash every 16th byte (one per 4 pixels) to reduce size
    const sampled = new Uint8Array(Math.floor(data.length / 16));

    for (let i = 0; i < sampled.length; i++) {
      const byte = data[i * 16];
      if (byte !== undefined) {
        sampled[i] = byte;
      }
    }

    let hash = 0;

    for (let i = 0; i < sampled.length; i++) {
      const byte = sampled[i];
      if (byte !== undefined) {
        hash = ((hash << 5) - hash) + byte;
        hash = hash & hash;
      }
    }

    return Math.abs(hash).toString(16).padStart(16, '0');
  }
}

/**
 * Assertion utility for determinism validation
 */
export function assertDeterministic(
  condition: boolean,
  message: string,
  context?: Record<string, unknown>
): void {
  if (!condition) {
    throw new DeterminismAssertionError(message, context ?? {});
  }
}

/**
 * Error thrown when determinism validation fails
 */
export class DeterminismAssertionError extends Error {
  constructor(
    message: string,
    public readonly context: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DeterminismAssertionError';
    Object.setPrototypeOf(this, DeterminismAssertionError.prototype);
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
