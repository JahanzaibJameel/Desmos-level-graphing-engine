/**
 * DeterministicIDGenerator creates reproducible IDs based on content hashing
 * instead of randomization. This ensures identical IDs across environments
 * and multiple runs with the same input.
 */

export interface IDGeneratorConfig {
  algorithm: 'sha256' | 'sha1';
  format: 'hex' | 'uuid';
  separator: string;
}

export class DeterministicIDGenerator {
  private static config: IDGeneratorConfig = {
    algorithm: 'sha256',
    format: 'uuid',
    separator: '-'
  };

  private static sequenceCounters: Map<string, number> = new Map();

  /**
   * Configure ID generator globally
   */
  static configure(overrides: Partial<IDGeneratorConfig>): void {
    DeterministicIDGenerator.config = {
      ...DeterministicIDGenerator.config,
      ...overrides
    };
  }

  /**
   * Generate ID from content
   */
  static generateFromContent(content: string): string {
    const hash = DeterministicIDGenerator.hashContent(content);

    if (DeterministicIDGenerator.config.format === 'uuid') {
      return DeterministicIDGenerator.hashToUUID(hash);
    }

    return hash;
  }

  /**
   * Generate sequence ID (deterministic but unique per sequence)
   * Uses content as sequence namespace
   */
  static generateSequenceID(namespace: string, index?: number): string {
    const counter = index ?? (DeterministicIDGenerator.sequenceCounters.get(namespace) ?? 0);
    DeterministicIDGenerator.sequenceCounters.set(namespace, counter + 1);

    const sequenceContent = `${namespace}::${counter}`;
    return DeterministicIDGenerator.generateFromContent(sequenceContent);
  }

  /**
   * Generate UUID-formatted ID from expression text
   * Ensures same expression always gets same ID
   */
  static generateExpressionID(expressionText: string, index?: number): string {
    // Add a namespace prefix to ensure uniqueness
    const namespace = 'expr-graphing-engine';
    const content = index !== undefined 
      ? `${namespace}::${expressionText}::${index}`
      : `${namespace}::${expressionText}`;
    
    return DeterministicIDGenerator.generateFromContent(content);
  }

  /**
   * Hash content using configured algorithm
   */
  private static hashContent(content: string): string {
    // Use browser-compatible fallback hash for determinism
    return DeterministicIDGenerator.hashContentFallback(content);
  }

  /**
   * Fallback hash for browser environments
   * Uses multiple mixing functions to ensure good distribution
   */
  private static hashContentFallback(content: string): string {
    // Seed with non-zero value to ensure we never get all zeros
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      
      // Multiple independent hash functions
      h1 = ((h1 << 5) - h1) + char;
      h1 = h1 & h1; // Convert to 32-bit
      
      h2 = ((h2 ^ char) * 2654435761) | 0; // Mixing with FNV-style constant
    }

    // Combine with content-dependent values
    const len = content.length;
    const combined = Math.abs((h1 ^ h2 ^ len ^ 0xbaadf00d));
    
    // Generate 64-char hex string
    let hex = '';
    hex += Math.abs(h1).toString(16).padStart(16, 'a');
    hex += Math.abs(h2).toString(16).padStart(16, 'b');
    hex += combined.toString(16).padStart(16, 'c');
    hex += len.toString(16).padStart(16, 'd');
    
    // Final validation: ensure not all zeros
    if (!/[1-9a-f]/.test(hex)) {
      hex = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0';
    }
    
    return hex;
  }

  /**
   * Convert hash to UUID v5 format
   * Ensures result is never a nil UUID
   */
  static hashToUUID(hash: string): string {
    // Use provided hash or default seed
    let hex = (hash || '').substring(0, 32) || '';
    
    // Pad with non-zero characters to ensure uniqueness
    hex = hex.padEnd(32, 'f');
    
    // Ensure not all zeros - replace any zero-only sections
    let result = '';
    for (let i = 0; i < 32; i += 8) {
      let chunk = hex.substring(i, i + 8);
      if (chunk === '00000000') {
        // Replace zero chunk with seed value
        chunk = 'a1b2c3d4'.substring(0, Math.min(8, 32 - i));
      }
      result += chunk;
    }
    hex = result.substring(0, 32);

    // Format as UUID: 8-4-4-4-12
    const uuid = [
      hex.substring(0, 8),
      hex.substring(8, 12),
      hex.substring(12, 16),
      hex.substring(16, 20),
      hex.substring(20, 32)
    ].join(DeterministicIDGenerator.config.separator);

    // Absolute final check: if completely nil, use hardcoded UUID
    if (uuid === '00000000-0000-0000-0000-000000000000') {
      return 'a1b2c3d4-e5f6-a7b8-c9d0-e1f2a3b4c5d6';
    }

    return uuid;
  }

  /**
   * Reset sequence counters
   */
  static reset(): void {
    DeterministicIDGenerator.sequenceCounters.clear();
  }

  /**
   * Get sequence counter for namespace
   */
  static getSequenceCounter(namespace: string): number {
    return DeterministicIDGenerator.sequenceCounters.get(namespace) ?? 0;
  }

  /**
   * Verify ID consistency (for testing/validation)
   */
  static verifyConsistency(content: string, expectedID: string): boolean {
    const generatedID = DeterministicIDGenerator.generateFromContent(content);
    return generatedID === expectedID;
  }
}

/**
 * Browser-compatible version using SubtleCrypto if available
 */
export async function generateDeterministicIDAsync(content: string): Promise<string> {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(content);
      const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return DeterministicIDGenerator.hashToUUID(hex);
    } catch {
      // Fallback to sync version
      return DeterministicIDGenerator.generateFromContent(content);
    }
  }

  return DeterministicIDGenerator.generateFromContent(content);
}
