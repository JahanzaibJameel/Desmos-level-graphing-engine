import Decimal from 'decimal.js';
import { NumericalProofSystem } from './validation/proofSystem';
import { PrecisionManager } from '../determinism';

export interface Transform {
  forward: (point: { x: number; y: number }) => { x: number; y: number };
  inverse: (point: { x: number; y: number }) => { x: number; y: number };
  jacobian: (point: { x: number; y: number }) => number;
}

export interface ScaleTransform {
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
}

export class CoordinateTransformer {
  private precision: 'float32' | 'float64' | 'decimal' = 'float64';
  private decimalPrecision: number = 30;
  
  createLinearTransform(scale: ScaleTransform): Transform {
    const forward = (point: { x: number; y: number }) => ({
      x: PrecisionManager.add(
        PrecisionManager.multiply(scale.scaleX, point.x),
        scale.offsetX
      ),
      y: PrecisionManager.add(
        PrecisionManager.multiply(scale.scaleY, point.y),
        scale.offsetY
      )
    });
    
    const inverse = (point: { x: number; y: number }) => ({
      x: PrecisionManager.divide(
        PrecisionManager.subtract(point.x, scale.offsetX),
        scale.scaleX
      ),
      y: PrecisionManager.divide(
        PrecisionManager.subtract(point.y, scale.offsetY),
        scale.scaleY
      )
    });
    
    const jacobian = () => PrecisionManager.multiply(scale.scaleX, scale.scaleY);
    
    return { forward, inverse, jacobian };
  }
  
  createLogTransform(base: number = 10, axis: 'x' | 'y' | 'both' = 'both'): Transform {
    const forward = (point: { x: number; y: number }) => ({
      x: axis === 'x' || axis === 'both' ? PrecisionManager.log(point.x, base) : point.x,
      y: axis === 'y' || axis === 'both' ? PrecisionManager.log(point.y, base) : point.y
    });
    
    const inverse = (point: { x: number; y: number }) => ({
      x: axis === 'x' || axis === 'both' ? PrecisionManager.pow(base, point.x) : point.x,
      y: axis === 'y' || axis === 'both' ? PrecisionManager.pow(base, point.y) : point.y
    });
    
    const jacobian = (point: { x: number; y: number }) => {
      let jacobianVal = 1;
      if (axis === 'x' || axis === 'both') {
        jacobianVal = PrecisionManager.multiply(
          jacobianVal,
          PrecisionManager.divide(1, PrecisionManager.multiply(point.x, Math.log(base)))
        );
      }
      if (axis === 'y' || axis === 'both') {
        jacobianVal = PrecisionManager.multiply(
          jacobianVal,
          PrecisionManager.divide(1, PrecisionManager.multiply(point.y, Math.log(base)))
        );
      }
      return jacobianVal;
    };
    
    return { forward, inverse, jacobian };
  }
  
  createPolarTransform(center: { x: number; y: number }): Transform {
    const forward = (point: { x: number; y: number }) => {
      const dx = PrecisionManager.subtract(point.x, center.x);
      const dy = PrecisionManager.subtract(point.y, center.y);
      const r = PrecisionManager.sqrt(PrecisionManager.add(
        PrecisionManager.multiply(dx, dx),
        PrecisionManager.multiply(dy, dy)
      ));
      const theta = PrecisionManager.atan2(dy, dx);
      return { x: r, y: theta };
    };
    
    const inverse = (point: { x: number; y: number }) => ({
      x: PrecisionManager.add(
        center.x,
        PrecisionManager.multiply(point.x, PrecisionManager.cos(point.y))
      ),
      y: PrecisionManager.add(
        center.y,
        PrecisionManager.multiply(point.x, PrecisionManager.sin(point.y))
      )
    });
    
    const jacobian = (point: { x: number; y: number }) => point.x; // r
    
    return { forward, inverse, jacobian };
  }
  
  transformPoints(
    points: Array<{ x: number; y: number }>,
    transform: Transform
  ): Array<{ x: number; y: number }> {
    return points.map(point => transform.forward(point));
  }
  
  transformWithPrecision(
    point: { x: number; y: number },
    transform: Transform
  ): { x: number; y: number } {
    switch (this.precision) {
      case 'decimal': {
        const x = new Decimal(point.x);
        const y = new Decimal(point.y);
        // For decimal precision, we'd need to implement transform using Decimal
        // This is a simplified version
        const result = transform.forward({ x: x.toNumber(), y: y.toNumber() });
        return {
          x: new Decimal(result.x).toDecimalPlaces(this.decimalPrecision).toNumber(),
          y: new Decimal(result.y).toDecimalPlaces(this.decimalPrecision).toNumber()
        };
      }

      case 'float64': {
        return transform.forward(point);
      }

      case 'float32': {
        const result32 = transform.forward(point);
        return {
          x: Math.fround(result32.x),
          y: Math.fround(result32.y)
        };
      }
    }
  }
  
  validateTransform(transform: Transform): boolean {
    const proof = NumericalProofSystem.proveInvertible(transform);
    return proof.success;
  }
  
  setPrecision(precision: 'float32' | 'float64' | 'decimal', decimalPlaces?: number): void {
    this.precision = precision;
    if (decimalPlaces !== undefined) {
      this.decimalPrecision = decimalPlaces;
    }
    if (precision === 'decimal') {
      Decimal.set({ precision: decimalPlaces || 30 });
    }
  }
  
  computeDeterminant(matrix: number[][]): number {
    if (!matrix || matrix.length !== 2 || !matrix[0] || !matrix[1] || matrix[0].length !== 2 || matrix[1].length !== 2) {
      throw new Error('Only 2x2 matrices supported');
    }

    const a = matrix[0]!;
    const b = matrix[1]!;
    return a[0]! * b[1]! - a[1]! * b[0]!;
  }
}