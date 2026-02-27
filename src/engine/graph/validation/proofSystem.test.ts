import { describe, it, expect } from 'vitest';
import { NumericalProofSystem } from './proofSystem';

describe('NumericalProofSystem', () => {
  describe('proveDeterministic', () => {
    it('should prove deterministic algorithm', () => {
      const deterministicFn = (x: number) => x * 2;
      const proof = NumericalProofSystem.proveDeterministic(deterministicFn, 10);
      expect(proof.success).toBe(true);
      expect(proof.confidence).toBeGreaterThan(0.9);
    });
    
    it('should detect non-deterministic algorithm', () => {
      let counter = 0;
      const nonDeterministicFn = () => counter++;
      const proof = NumericalProofSystem.proveDeterministic(nonDeterministicFn, 10);
      expect(proof.success).toBe(false);
    });
  });
  
  describe('proveInvertible', () => {
    it('should prove linear transform is invertible', () => {
      const transform = {
        forward: (point: { x: number; y: number }) => ({
          x: point.x * 2 + 1,
          y: point.y * 3 - 2
        }),
        inverse: (point: { x: number; y: number }) => ({
          x: (point.x - 1) / 2,
          y: (point.y + 2) / 3
        })
      };
      
      const proof = NumericalProofSystem.proveInvertible(transform);
      expect(proof.success).toBe(true);
    });
    
    it('should detect non-invertible transform', () => {
      const transform = {
        forward: (point: { x: number; y: number }) => ({
          x: point.x * 0,
          y: point.y
        }),
        inverse: (point: { x: number; y: number }) => ({
          x: 0,
          y: point.y
        })
      };
      
      const proof = NumericalProofSystem.proveInvertible(transform);
      expect(proof.success).toBe(false);
    });
  });
  
  describe('proveContinuity', () => {
    it('should prove continuous function', () => {
      const continuousFn = (x: number) => Math.sin(x);
      const proof = NumericalProofSystem.proveContinuity(continuousFn, [0, 2 * Math.PI], 100);
      expect(proof.success).toBe(true);
      expect(proof.confidence).toBeGreaterThan(0.9);
    });
    
    it('should detect discontinuity', () => {
      const discontinuousFn = (x: number) => {
        if (x < 0) return -1;
        if (x > 0) return 1;
        return 0;
      };
      
      const proof = NumericalProofSystem.proveContinuity(discontinuousFn, [-1, 1], 100);
      expect(proof.success).toBe(false);
    });
  });
});