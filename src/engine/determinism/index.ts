/**
 * Determinism Module - Enforces bitwise identical output across all environments
 * 
 * This module provides the foundational infrastructure for deterministic computation:
 * - PrecisionManager: Explicit precision for all mathematical operations
 * - OperationCounter: Deterministic circuit breakers based on operation counts
 * - DeterministicIDGenerator: Content-hash-based ID generation
 * - DeterminismValidator: Verification that output is truly deterministic
 */

export {
  PrecisionManager,
  DeterminismError,
  type PrecisionMode,
  type RoundingMode,
  type PrecisionConfig
} from './PrecisionManager';

export {
  OperationCounter,
  Counter,
  CircuitBreaker,
  DeterministicTimeout,
  CircuitBreakerError,
  type CircuitBreakerConfig
} from './OperationCounter';

export {
  DeterministicIDGenerator,
  generateDeterministicIDAsync,
  type IDGeneratorConfig
} from './DeterministicIDGenerator';

export {
  DeterminismValidator,
  assertDeterministic,
  DeterminismAssertionError,
  type ValidationResult,
  type ValidationFailure
} from './DeterminismValidator';
