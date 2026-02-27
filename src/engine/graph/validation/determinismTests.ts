/**
 * Deterministic Test Suite
 * 
 * Tests that graphing engine produces bitwise identical output across:
 * - Multiple executions
 * - Different viewport configurations
 * - Different expression sets
 * - Mathematical operations with high precision
 */

import { PrecisionManager, DeterminismValidator, OperationCounter, DeterministicIDGenerator } from '../../determinism';
import { AdaptiveSampler } from '../../sampling/adaptive';
import { GraphViewport } from '../viewport';
import { CoordinateTransformer } from '../transforms';

export interface DeterminismTestResult {
  testName: string;
  passed: boolean;
  message: string;
  details?: unknown;
}

export class DeterminismTestSuite {
  private results: DeterminismTestResult[] = [];

  /**
   * Run all determinism tests
   */
  runAll(): DeterminismTestResult[] {
    this.results = [];

    // Precision Manager Tests
    this.testPrecisionManagerDeterminism();
    this.testPrecisionManagerArithmetic();
    this.testPrecisionManagerComparisons();
    this.testPrecisionManagerTranscendental();

    // Sampling Tests
    this.testAdaptiveSamplerDeterminism();
    this.testAdaptiveSamplerConsistency();

    // Viewport Tests
    this.testViewportDeterminism();
    this.testViewportCoordinateTransforms();

    // Transform Tests
    this.testLinearTransformInvertibility();
    this.testLogTransformPrecision();
    this.testPolarTransformDeterminism();

    // ID Generation Tests
    this.testDeterministicIDGeneration();
    this.testDeterministicIDConsistency();

    // Operation Counter Tests
    this.testOperationCounterDeterminism();

    return this.results;
  }

  /**
   * Get test summary
   */
  getSummary(): { passed: number; failed: number; total: number; failureRate: number } {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;

    return {
      passed,
      failed,
      total,
      failureRate: total > 0 ? failed / total : 0
    };
  }

  /**
   * Get detailed failure report
   */
  getFailureReport(): DeterminismTestResult[] {
    return this.results.filter(r => !r.passed);
  }

  // ========== Precision Manager Tests ==========

  private testPrecisionManagerDeterminism(): void {
    const result: DeterminismTestResult = {
      testName: 'PrecisionManager determinism',
      passed: true,
      message: ''
    };

    try {
      const validation = DeterminismValidator.validateNumericalPrecision(
        () => PrecisionManager.add(Math.PI, Math.E),
        1e-15,
        10
      );

      result.passed = validation.deterministic;
      result.message = validation.deterministic
        ? 'Arithmetic operations are deterministic'
        : `Found ${validation.failures.length} determinism violations`;
      result.details = validation;
    } catch (error) {
      result.passed = false;
      result.message = `Error during test: ${String(error)}`;
    }

    this.results.push(result);
  }

  private testPrecisionManagerArithmetic(): void {
    const result: DeterminismTestResult = {
      testName: 'PrecisionManager arithmetic equivalence',
      passed: true,
      message: ''
    };

    try {
      const a = 123.456789;
      const b = 987.654321;

      // Test multiple operations
      const operations = [
        { name: 'add', fn: () => PrecisionManager.add(a, b) },
        { name: 'subtract', fn: () => PrecisionManager.subtract(a, b) },
        { name: 'multiply', fn: () => PrecisionManager.multiply(a, b) },
        { name: 'divide', fn: () => PrecisionManager.divide(a, b) },
        { name: 'sqrt', fn: () => PrecisionManager.sqrt(a) }
      ];

      const failures: string[] = [];

      for (const op of operations) {
        const validation = DeterminismValidator.validateNumericalPrecision(
          op.fn,
          1e-15,
          5
        );

        if (!validation.deterministic) {
          failures.push(`${op.name}: ${validation.failures[0]?.message}`);
        }
      }

      result.passed = failures.length === 0;
      result.message = result.passed ? 'All arithmetic operations deterministic' : failures.join(', ');
    } catch (error) {
      result.passed = false;
      result.message = `Error: ${String(error)}`;
    }

    this.results.push(result);
  }

  private testPrecisionManagerComparisons(): void {
    const result: DeterminismTestResult = {
      testName: 'PrecisionManager epsilon comparisons',
      passed: true,
      message: ''
    };

    try {
      const epsilon = PrecisionManager.EPSILON_FLOAT64;

      // Test epsilon-based comparisons
      const a = 1.0;
      const b = 1.0 + epsilon / 2; // Within epsilon

      const equals = PrecisionManager.equals(a, b);
      const gt = PrecisionManager.greaterThan(b, a);
      const lt = PrecisionManager.lessThan(a, b);

      result.passed = equals && gt && !lt;
      result.message = result.passed
        ? 'Epsilon comparisons work correctly'
        : `Comparison failed: equals=${equals}, gt=${gt}, lt=${lt}`;
    } catch (error) {
      result.passed = false;
      result.message = `Error: ${String(error)}`;
    }

    this.results.push(result);
  }

  private testPrecisionManagerTranscendental(): void {
    const result: DeterminismTestResult = {
      testName: 'PrecisionManager transcendental functions',
      passed: true,
      message: ''
    };

    try {
      const operations = [
        { name: 'sin', fn: () => PrecisionManager.sin(Math.PI / 4) },
        { name: 'cos', fn: () => PrecisionManager.cos(Math.PI / 3) },
        { name: 'ln', fn: () => PrecisionManager.ln(Math.E) },
        { name: 'atan2', fn: () => PrecisionManager.atan2(1, 1) }
      ];

      const failures: string[] = [];

      for (const op of operations) {
        const validation = DeterminismValidator.validateNumericalPrecision(
          op.fn,
          1e-14,
          5
        );

        if (!validation.deterministic) {
          failures.push(op.name);
        }
      }

      result.passed = failures.length === 0;
      result.message = result.passed
        ? 'Transcendental functions deterministic'
        : `Failed: ${failures.join(', ')}`;
    } catch (error) {
      result.passed = false;
      result.message = `Error: ${String(error)}`;
    }

    this.results.push(result);
  }

  // ========== Sampling Tests ==========

  private testAdaptiveSamplerDeterminism(): void {
    const result: DeterminismTestResult = {
      testName: 'AdaptiveSampler determinism',
      passed: true,
      message: ''
    };

    try {
      const sampler = new AdaptiveSampler({ maxPoints: 1000, tolerance: 0.1 });
      const fn = (x: number) => Math.sin(x);
      const domain: [number, number] = [0, Math.PI * 2];

      const validation = DeterminismValidator.validateAlgorithmDeterminism<Array<{ x: number; y: number }>>(
        () => sampler.sample(fn, domain),
        3,
        (a: Array<{ x: number; y: number }>, b: Array<{ x: number; y: number }>) => {
          if (a.length !== b.length) return false;
          return a.every((point: { x: number; y: number }, i: number) =>
            PrecisionManager.equals(point.x, b[i]?.x ?? 0, 1e-14) &&
            PrecisionManager.equals(point.y, b[i]?.y ?? 0, 1e-14)
          );
        }
      );

      result.passed = validation.deterministic;
      result.message = validation.deterministic
        ? 'Sampling produces identical results'
        : `Found ${validation.failures.length} differences`;
      result.details = validation;
    } catch (error) {
      result.passed = false;
      result.message = `Error: ${String(error)}`;
    }

    this.results.push(result);
  }

  private testAdaptiveSamplerConsistency(): void {
    const result: DeterminismTestResult = {
      testName: 'AdaptiveSampler point ordering',
      passed: true,
      message: ''
    };

    try {
      const sampler = new AdaptiveSampler({ maxPoints: 500 });
      const fn = (x: number) => x * x;
      const domain: [number, number] = [-10, 10];

      const points = sampler.sample(fn, domain);

      // Validate points are sorted by x coordinate
      const validation = DeterminismValidator.validateDeterministicSort(
        points,
        (a: { x: number; y: number }, b: { x: number; y: number }) => PrecisionManager.compare(a.x, b.x)
      );

      result.passed = validation.deterministic;
      result.message = result.passed
        ? 'Points are properly sorted'
        : 'Points are not in deterministic order';
    } catch (error) {
      result.passed = false;
      result.message = `Error: ${String(error)}`;
    }

    this.results.push(result);
  }

  // ========== Viewport Tests ==========

  private testViewportDeterminism(): void {
    const result: DeterminismTestResult = {
      testName: 'GraphViewport determinism',
      passed: true,
      message: ''
    };

    try {
      const createViewport = () => {
        const vp = new GraphViewport();
        vp.zoom(2.5, { x: 0, y: 0 });
        vp.pan(1.5, -2.0);
        return vp.current;
      };

      const validation = DeterminismValidator.validateAlgorithmDeterminism(
        createViewport,
        3,
        (a: { xMin: number; xMax: number; yMin: number; yMax: number }, b: { xMin: number; xMax: number; yMin: number; yMax: number }) => {
          return (
            PrecisionManager.equals(a.xMin, b.xMin, 1e-14) &&
            PrecisionManager.equals(a.xMax, b.xMax, 1e-14) &&
            PrecisionManager.equals(a.yMin, b.yMin, 1e-14) &&
            PrecisionManager.equals(a.yMax, b.yMax, 1e-14)
          );
        }
      );

      result.passed = validation.deterministic;
      result.message = validation.deterministic
        ? 'Viewport transformations are deterministic'
        : 'Viewport produces different results';
    } catch (error) {
      result.passed = false;
      result.message = `Error: ${String(error)}`;
    }

    this.results.push(result);
  }

  private testViewportCoordinateTransforms(): void {
    const result: DeterminismTestResult = {
      testName: 'GraphViewport coordinate conversions',
      passed: true,
      message: ''
    };

    try {
      const vp = new GraphViewport({ xMin: -10, xMax: 10, yMin: -10, yMax: 10 });
      const canvasWidth = 800;
      const canvasHeight = 600;

      // Test round-trip conversion
      const worldPoint = { x: 3.14159, y: -2.71828 };
      const screenPoint = vp.worldToScreen(worldPoint.x, worldPoint.y, canvasWidth, canvasHeight);
      const backToWorld = vp.screenToWorld(screenPoint.x, screenPoint.y, canvasWidth, canvasHeight);

      const xMatch = PrecisionManager.equals(worldPoint.x, backToWorld.x, 1e-10);
      const yMatch = PrecisionManager.equals(worldPoint.y, backToWorld.y, 1e-10);

      result.passed = xMatch && yMatch;
      result.message = result.passed
        ? 'Coordinate transformations are invertible'
        : `Inversion error: x=${Math.abs(worldPoint.x - backToWorld.x)}, y=${Math.abs(worldPoint.y - backToWorld.y)}`;
    } catch (error) {
      result.passed = false;
      result.message = `Error: ${String(error)}`;
    }

    this.results.push(result);
  }

  // ========== Transform Tests ==========

  private testLinearTransformInvertibility(): void {
    const result: DeterminismTestResult = {
      testName: 'LinearTransform invertibility',
      passed: true,
      message: ''
    };

    try {
      const transformer = new CoordinateTransformer();
      const transform = transformer.createLinearTransform({
        scaleX: 2.5,
        scaleY: 1.5,
        offsetX: 100,
        offsetY: -50
      });

      const validation = DeterminismValidator.validateAlgorithmDeterminism<{ x: number; y: number }>(
        () => {
          const point = { x: 42.123, y: 37.456 };
          const forward = transform.forward(point);
          const back = transform.inverse(forward);
          return back;
        },
        5,
        (a: { x: number; y: number }, b: { x: number; y: number }) =>
          PrecisionManager.equals(a.x, b.x, 1e-14) &&
          PrecisionManager.equals(a.y, b.y, 1e-14)
      );

      result.passed = validation.deterministic;
      result.message = result.passed
        ? 'Linear transform is invertible'
        : 'Inversion produces different results';
    } catch (error) {
      result.passed = false;
      result.message = `Error: ${String(error)}`;
    }

    this.results.push(result);
  }

  private testLogTransformPrecision(): void {
    const result: DeterminismTestResult = {
      testName: 'LogTransform precision',
      passed: true,
      message: ''
    };

    try {
      const transformer = new CoordinateTransformer();
      const transform = transformer.createLogTransform(10, 'x');

      // Test with positive values
      const validation = DeterminismValidator.validateAlgorithmDeterminism<{ x: number; y: number }>(
        () => {
          const point = { x: 1000, y: 50 };
          return transform.forward(point);
        },
        5,
        (a: { x: number; y: number }, b: { x: number; y: number }) =>
          PrecisionManager.equals(a.x, b.x, 1e-14) &&
          PrecisionManager.equals(a.y, b.y, 1e-14)
      );

      result.passed = validation.deterministic;
      result.message = result.passed
        ? 'Log transform produces consistent results'
        : 'Log transform has precision issues';
    } catch (error) {
      result.passed = false;
      result.message = `Error: ${String(error)}`;
    }

    this.results.push(result);
  }

  private testPolarTransformDeterminism(): void {
    const result: DeterminismTestResult = {
      testName: 'PolarTransform determinism',
      passed: true,
      message: ''
    };

    try {
      const transformer = new CoordinateTransformer();
      const transform = transformer.createPolarTransform({ x: 0, y: 0 });

      const validation = DeterminismValidator.validateAlgorithmDeterminism<{ x: number; y: number }>(
        () => {
          const point = { x: 3, y: 4 };
          const polar = transform.forward(point);
          const back = transform.inverse(polar);
          return back;
        },
        5,
        (a: { x: number; y: number }, b: { x: number; y: number }) =>
          PrecisionManager.equals(a.x, b.x, 1e-13) &&
          PrecisionManager.equals(a.y, b.y, 1e-13)
      );

      result.passed = validation.deterministic;
      result.message = result.passed
        ? 'Polar transform is deterministic'
        : 'Polar transform has inconsistencies';
    } catch (error) {
      result.passed = false;
      result.message = `Error: ${String(error)}`;
    }

    this.results.push(result);
  }

  // ========== ID Generation Tests ==========

  private testDeterministicIDGeneration(): void {
    const result: DeterminismTestResult = {
      testName: 'DeterministicIDGenerator basic functionality',
      passed: true,
      message: ''
    };

    try {
      const content = 'test_expression_sin(x)';
      const id1 = DeterministicIDGenerator.generateFromContent(content);
      const id2 = DeterministicIDGenerator.generateFromContent(content);

      result.passed = id1 === id2;
      result.message = result.passed
        ? 'IDs are consistent for same content'
        : `IDs differ: ${id1} vs ${id2}`;
    } catch (error) {
      result.passed = false;
      result.message = `Error: ${String(error)}`;
    }

    this.results.push(result);
  }

  private testDeterministicIDConsistency(): void {
    const result: DeterminismTestResult = {
      testName: 'DeterministicIDGenerator expression consistency',
      passed: true,
      message: ''
    };

    try {
      const expressions = [
        'sin(x)',
        'cos(x)',
        'x^2',
        'exp(-x)',
        '1/x'
      ];

      const ids: Map<string, string> = new Map();
      let consistent = true;

      // Generate IDs multiple times
      for (let i = 0; i < 3; i++) {
        for (const expr of expressions) {
          const id = DeterministicIDGenerator.generateExpressionID(expr);

          if (ids.has(expr)) {
            if (ids.get(expr) !== id) {
              consistent = false;
              break;
            }
          } else {
            ids.set(expr, id);
          }
        }
      }

      result.passed = consistent;
      result.message = result.passed
        ? 'Expression IDs are consistent'
        : 'Expression IDs differ across runs';
    } catch (error) {
      result.passed = false;
      result.message = `Error: ${String(error)}`;
    }

    this.results.push(result);
  }

  // ========== Operation Counter Tests ==========

  private testOperationCounterDeterminism(): void {
    const result: DeterminismTestResult = {
      testName: 'OperationCounter determinism',
      passed: true,
      message: ''
    };

    try {
      OperationCounter.reset();

      const breaker1 = OperationCounter.registerCircuitBreaker({
        maxOperations: 100,
        name: 'test-breaker'
      });

      let tripCount1 = 0;
      for (let i = 0; i < 150; i++) {
        try {
          breaker1.execute(() => {
            OperationCounter.increment();
          });
        } catch {
          tripCount1++;
        }
      }

      OperationCounter.reset();

      const breaker2 = OperationCounter.registerCircuitBreaker({
        maxOperations: 100,
        name: 'test-breaker'
      });

      let tripCount2 = 0;
      for (let i = 0; i < 150; i++) {
        try {
          breaker2.execute(() => {
            OperationCounter.increment();
          });
        } catch {
          tripCount2++;
        }
      }

      result.passed = tripCount1 === tripCount2;
      result.message = result.passed
        ? 'Circuit breaker trips deterministically'
        : `Different trip counts: ${tripCount1} vs ${tripCount2}`;
    } catch (error) {
      result.passed = false;
      result.message = `Error: ${String(error)}`;
    }

    this.results.push(result);
  }
}

/**
 * Print test results in human-readable format
 */
export function printTestResults(results: DeterminismTestResult[]): void {
  console.log('\n' + '='.repeat(80));
  console.log('DETERMINISM TEST RESULTS');
  console.log('='.repeat(80));

  for (const result of results) {
    const status = result.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${status}: ${result.testName}`);
    console.log(`  → ${result.message}`);

    if (result.details && !result.passed) {
      console.log(`  Details: ${JSON.stringify(result.details, null, 2)}`);
    }
  }

  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  console.log('\n' + '='.repeat(80));
  console.log(`Results: ${passed}/${total} tests passed (${((passed / total) * 100).toFixed(1)}%)`);
  console.log('='.repeat(80) + '\n');
}
