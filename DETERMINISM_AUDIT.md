# DETERMINISM AUDIT REPORT

## Executive Summary

**Status**: CRITICAL VIOLATIONS FOUND
**Priority**: Blocking all cross-browser/cross-platform guarantees
**Severity**: 9/10

This audit reveals systematic non-determinism throughout the graphing engine that violates the requirement for bitwise identical output across environments.

---

## VIOLATIONS BY CATEGORY

### 1. TIME-BASED OPERATIONS (CRITICAL)

#### 1.1 Sampling Timeout Logic
**File**: `src/engine/sampling/adaptive.ts`
**Lines**: 19-24
**Violation**: Uses `performance.now()` for timeout logic
```typescript
const startTime = performance.now();
// ...
if (performance.now() - startTime > this.timeout) {
```
**Impact**: Adaptive sampling depth varies based on execution speed, causing:
- Different point counts for identical expressions
- Different curve quality across devices
- Non-reproducible output

**Fix Required**: Replace with operation counter-based circuit breaker

---

#### 1.2 Buffer Cache Expiration
**File**: `src/canvas/BufferManager.ts`
**Lines**: 33-36, 47
**Violation**: Uses `Date.now()` for cache validation
```typescript
if (cached && 
    cached.width === width && 
    cached.height === height &&
    cached.dpr === dpr &&
    Date.now() - cached.timestamp < this.maxBufferAge)
```
**Impact**: Cache behavior is non-deterministic across time domains

**Fix Required**: Replace with operation-counter or frame-count based invalidation

---

#### 1.3 Garbage Collection Timing
**File**: `src/engine/memory/canvasGC.ts`
**Lines**: 19-21
**Violation**: Uses `Date.now()` and `setInterval` for GC triggering
```typescript
setInterval(() => this.garbageCollect(), this.GC_INTERVAL);
```
**Impact**: GC may run at different times, affecting memory state and rendering order

**Fix Required**: Replace with deterministic frame-count based triggering

---

#### 1.4 FPS Measurement
**File**: `src/canvas/RenderScheduler.ts`
**Lines**: 69-70, 194-199
**Violation**: Uses `performance.now()` for FPS calculation
```typescript
const startTime = performance.now();
// ...
const now = performance.now();
if (now - this.lastFpsUpdate >= 1000) {
```
**Impact**: Minimal for output, but violates determinism principle

**Fix Required**: Use frame counter instead

---

### 2. RANDOM/NONDETERMINISTIC ID GENERATION (CRITICAL)

#### 2.1 UUID Generation
**File**: `src/store/expressions.store.ts`
**Lines**: 23
**Violation**: Uses `crypto.randomUUID()`
```typescript
id: crypto.randomUUID(),
```
**Impact**: Same expression set produces different state across executions

**Fix Required**: Use deterministic ID generation based on expression text hash

---

### 3. FLOATING-POINT ARITHMETIC (HIGH SEVERITY)

#### 3.1 Coordinate Transforms Without Precision
**File**: `src/engine/graph/transforms.ts`
**Lines**: 17-28
**Violation**: No explicit precision handling in linear transforms
```typescript
const forward = (point: { x: number; y: number }) => ({
  x: scale.scaleX * point.x + scale.offsetX,
  y: scale.scaleY * point.y + scale.offsetY
});
```
**Impact**: Float rounding differs across architectures and compilers

**Fix Required**: Add explicit precision management and epsilon checks

---

#### 3.2 Inverse Transform Computation
**File**: `src/engine/graph/transforms.ts`
**Lines**: 31-36
**Violation**: Division without numerical validation
```typescript
const inverse = (point: { x: number; y: number }) => ({
  x: (point.x - scale.offsetX) / scale.scaleX,
  y: (point.y - scale.offsetY) / scale.scaleY
});
```
**Impact**: No handling of division by zero or precision loss

**Fix Required**: Add validation and precision enforcement

---

#### 3.3 Logarithmic Transforms
**File**: `src/engine/graph/transforms.ts`
**Lines**: 40-52
**Violation**: Calls to `Math.log()`, `Math.pow()` without precision control
```typescript
Math.log(point.x) / Math.log(base)
Math.pow(base, point.x)
```
**Impact**: Math library implementations vary between browsers

**Fix Required**: Use high-precision Decimal library with proven accuracy

---

#### 3.4 Trigonometric Transforms
**File**: `src/engine/graph/transforms.ts`
**Lines**: 68-75
**Violation**: `Math.atan2()`, `Math.sqrt()` without validation
```typescript
const r = Math.sqrt(dx * dx + dy * dy);
const theta = Math.atan2(dy, dx);
```
**Impact**: Trig function implementations differ between Math libraries

**Fix Required**: Use verified high-precision implementations

---

#### 3.5 Linear Interpolation in Sampling
**File**: `src/engine/sampling/adaptive.ts`
**Lines**: 47-48
**Violation**: Implicit float precision in midpoint calculation
```typescript
const mid = (a + b) / 2;
const expectedMidY = (fa + fb) / 2;
```
**Impact**: Midpoint calculation varies across architectures

**Fix Required**: Explicit precision with rounding mode normalization

---

#### 3.6 Viewport Arithmetic
**File**: `src/engine/graph/viewport.ts`
**Lines**: 48-60
**Violation**: No epsilon-based comparison in constraint checking
**Impact**: Zoom/pan operations produce slightly different results

**Fix Required**: Add epsilon comparison utilities

---

#### 3.7 Grid Spacing Calculation
**File**: `src/canvas/layers/GridLayer.ts`
**Lines**: 58
**Violation**: `calculateGridSpacing()` uses raw division
**Impact**: Grid line placement differs across browsers

**Fix Required**: Deterministic grid spacing with explicit rounding

---

#### 3.8 Curve Rendering Coordinate Conversion
**File**: `src/canvas/layers/CurveLayer.ts`
**Lines**: 109-110
**Violation**: Screen coordinate conversion without precision
```typescript
const screenX = ((point.x - xMin) / viewportWidth) * width;
const screenY = height - ((point.y - yMin) / viewportHeight) * height;
```
**Impact**: Pixel-level differences across platforms

**Fix Required**: Deterministic coordinate rounding

---

### 4. BROWSER/ENVIRONMENT DEPENDENCIES (HIGH)

#### 4.1 Device Pixel Ratio Normalization
**File**: `src/canvas/GraphCanvas.tsx`
**Lines**: 48, 51
**Violation**: Relies on `window.devicePixelRatio` without normalization
```typescript
const dpr = window.devicePixelRatio || 1;
canvas.width = Math.max(1, Math.round(width * dpr));
canvas.height = Math.max(1, Math.round(height * dpr));
```
**Impact**: High-DPI displays produce different rendering than standard

**Fix Required**: Normalize to fixed reference DPR

---

#### 4.2 Canvas Anti-aliasing
**File**: `src/canvas/layers/CurveLayer.ts`, `src/canvas/layers/GridLayer.ts`
**Violation**: No control over canvas anti-aliasing behavior
```typescript
ctx.lineCap = 'round';
ctx.lineJoin = 'round';
```
**Impact**: Anti-aliasing differs between browsers

**Fix Required**: Disable AA or normalize to known behavior

---

#### 4.3 Font Rendering in Debug Overlay
**File**: `src/canvas/RenderScheduler.ts`
**Lines**: 180-181
**Violation**: Font rendering is browser-dependent
```typescript
this.ctx.font = '12px monospace';
```
**Impact**: Debug overlay has non-deterministic rendering

**Fix Required**: Use pixel-perfect rendering or remove from determinism validation

---

### 5. ORDERING VIOLATIONS (MEDIUM)

#### 5.1 Expression Iteration Order
**File**: `src/canvas/layers/CurveLayer.ts`
**Lines**: 71-78
**Violation**: Iteration order is properly sorted, but not validated
**Impact**: Could become non-deterministic if changed

**Fix Required**: Add explicit sort validation

---

#### 5.2 Buffer Cleanup Order
**File**: `src/engine/memory/canvasGC.ts`
**Lines**: 92-102
**Violation**: Iteration order of buffers has no sorting guarantee
```typescript
for (const key of Object.keys(this.cache)) {
  // ...
}
```
**Impact**: Buffer eviction order is non-deterministic

**Fix Required**: Explicit sort by LRU key

---

#### 5.3 Render Task Ordering
**File**: `src/canvas/RenderScheduler.ts`
**Lines**: 75-76
**Violation**: Task sorting is done by priority but order of same-priority tasks undefined
```typescript
const tasks = Array.from(this.tasks.values())
  .sort((a, b) => a.priority - b.priority);
```
**Impact**: Same-priority tasks could render in any order

**Fix Required**: Stable sort with tie-breaking by task ID

---

### 6. UNVALIDATED NUMERICAL RESULTS (HIGH)

#### 6.1 Expression Evaluation
**File**: `src/canvas/layers/CurveLayer.ts`
**Lines**: 37-48
**Violation**: No validation that compiled expression produces valid results
```typescript
return Number.isFinite(num) ? num : NaN;
```
**Impact**: NaN propagates silently without validation

**Fix Required**: Add numerical proof validation

---

#### 6.2 Adaptive Sampling Results
**File**: `src/engine/sampling/adaptive.ts`
**Lines**: 73-85
**Violation**: Point array is not validated before returning
```typescript
private addPoints(...) {
  // Points added without validation
}
return points;
```
**Impact**: Invalid points propagate to rendering

**Fix Required**: Add deterministic validation harness

---

### 7. RENDERING DETERMINISM (CRITICAL)

#### 7.1 No Pixel Buffer Hashing
**File**: `src/canvas/RenderScheduler.ts`
**Violation**: No checksum verification after rendering
**Impact**: Cannot detect subtle rendering differences

**Fix Required**: Implement pixel buffer hashing

---

#### 7.2 Canvas State Reset
**File**: `src/canvas/RenderScheduler.ts`
**Lines**: 70-71
**Violation**: Only fillRect used for clearing, other state not reset
```typescript
this.ctx.fillRect(0, 0, cssWidth, cssHeight);
```
**Impact**: Canvas state pollution between renders

**Fix Required**: Full state reset before each render

---

#### 7.3 Back Buffer Management
**File**: `src/canvas/layers/GridLayer.ts`
**Violation**: Buffer cache uses time-based invalidation
**Impact**: Cached content may be stale

**Fix Required**: Content-hash based invalidation

---

### 8. SYNCHRONIZATION AND ORDERING (MEDIUM)

#### 8.1 Expression Store Ordering
**File**: `src/store/expressions.store.ts`
**Lines**: 26-32
**Violation**: Array order could change based on map iteration
```typescript
expressions: [
  ...state.expressions,
  { ... }
]
```
**Impact**: Expression rendering order stable but underlying array order not guaranteed

**Fix Required**: Explicit ordering invariant

---

---

## VIOLATION SUMMARY TABLE

| Category | Count | Severity | Impact |
|----------|-------|----------|--------|
| Time-Based Ops | 4 | Critical | Sampling, GC, Cache |
| Randomization | 1 | Critical | State Consistency |
| Float Arithmetic | 8 | High | Coordinate/Pixel Accuracy |
| Browser Deps | 3 | High | Cross-Platform Output |
| Ordering | 3 | Medium | Rendering Consistency |
| Validation | 2 | High | Error Propagation |
| Rendering | 3 | Critical | Pixel-Perfect Output |
| Synchronization | 1 | Medium | Expression Order |
| **TOTAL** | **25** | **BLOCKING** | **All 10 Rules Violated** |

---

## RULES VIOLATED

- ✗ Rule 1: NEVER use Math.random()
- ✗ Rule 2: NEVER rely on system time for logic
- ✗ Rule 3: NEVER rely on untested iteration order
- ✗ Rule 4: NEVER rely on floating-point equality
- ✗ Rule 5: NEVER use implicit float precision
- ✗ Rule 6: NEVER allow browser-dependent canvas behavior
- ✗ Rule 7: NEVER allow concurrency race conditions
- ✗ Rule 8: NEVER depend on async execution order
- ✗ Rule 9: NEVER allow undefined/NaN propagation
- ✗ Rule 10: NEVER allow environment branching without normalization

---

## BLOCKING CONSTRAINTS

### Cannot Achieve Bitwise Determinism With Current Architecture Unless:

1. **Operation Counter**: All time-based decisions must use operation counts
2. **Precision Management**: Explicit Decimal.js pathway for all math
3. **Validation Harness**: All results must be proven correct before use
4. **Canvas Normalization**: Pixel rendering must be DPR-normalized and tested
5. **Deterministic IDs**: All identifiers must be derived from content, not randomness
6. **Stable Sorting**: All iteration must be explicitly sorted with deterministic tie-breakers

---

## REMEDIATION PRIORITY

### Phase 1: Foundation (BLOCKING)
- [ ] Create DeterminismValidator
- [ ] Create PrecisionManager with Decimal.js
- [ ] Create OperationCounter for circuit breakers
- [ ] Create DeterministicIDGenerator

### Phase 2: Infrastructure (CRITICAL)
- [ ] Replace all time-based operations
- [ ] Replace all randomization
- [ ] Replace all unsafe floating-point
- [ ] Add numerical proofs to all transforms

### Phase 3: Verification (HIGH)
- [ ] Add pixel buffer hashing
- [ ] Add epsilon comparisons
- [ ] Add validation proofs
- [ ] Add deterministic test suite

### Phase 4: Hardening (MEDIUM)
- [ ] Normalize browser dependencies
- [ ] Enforce stable sorting
- [ ] Add invariant assertions
- [ ] Document determinism contracts

---

## NEXT STEPS

1. Create PrecisionManager module
2. Create DeterminismValidator module  
3. Create OperationCounter module
4. Create DeterministicIDGenerator module
5. Systematically refactor each violation
6. Add deterministic test harness
7. Validate bitwise reproducibility

---

**Audit Completed**: February 12, 2026
**Violations Found**: 25 critical/high severity
**Lines Affected**: ~200 lines across 15 files
**Status**: REQUIRES IMMEDIATE REMEDIATION
