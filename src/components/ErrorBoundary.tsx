/**
 * Error Boundary & Recovery System
 * Handles crashes gracefully with fallback rendering
 */

import React, { ReactNode, ErrorInfo } from 'react';

export interface ErrorSnapshot {
  timestamp: Date;
  error: Error;
  componentStack: string | null;
  viewport: any;
  expressions: any[];
}

/**
 * Error context for sharing error state
 */
export const ErrorContext = React.createContext<{
  error: Error | null;
  snapshot: ErrorSnapshot | null;
  clearError: () => void;
  recoverFromError: () => Promise<boolean>;
}>({
  error: null,
  snapshot: null,
  clearError: () => {},
  recoverFromError: async () => false,
});

/**
 * Error boundary component
 */
export class ErrorBoundary extends React.Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null; errorInfo: ErrorInfo | null; snapshot: ErrorSnapshot | null }
> {
  private errorSnapshots: ErrorSnapshot[] = [];
  private maxSnapshots = 5;

  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      snapshot: null,
    };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to console
    console.error('Error boundary caught:', error, errorInfo);

    // Create snapshot for recovery
    const snapshot: ErrorSnapshot = {
      timestamp: new Date(),
      error,
      componentStack: errorInfo.componentStack ?? null,
      viewport: this.captureViewport(),
      expressions: this.captureExpressions(),
    };

    this.errorSnapshots.push(snapshot);
    if (this.errorSnapshots.length > this.maxSnapshots) {
      this.errorSnapshots.shift();
    }

    this.setState({
      errorInfo,
      snapshot,
    });

    // Try to log to error tracking service (Sentry, etc.)
    this.logToSentry(error, errorInfo, snapshot);
  }

  private captureViewport(): any {
    // This would be injected via context
    return null;
  }

  private captureExpressions(): any[] {
    // This would be injected via context
    return [];
  }

  private logToSentry(error: Error, _info: ErrorInfo, snapshot: ErrorSnapshot): void {
    // Only in production
    if (import.meta.env.PROD) {
      try {
        // Sentry.captureException(error, {
        //   contexts: { errorBoundary: { snapshot } }
        // });
        console.log('[Error] Would log to Sentry:', { error, snapshot });
      } catch (e) {
        console.error('Failed to log error:', e);
      }
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      snapshot: null,
    } as any);
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-red-50 p-8">
          <div className="max-w-md">
            <h1 className="text-2xl font-bold text-red-900 mb-4">Something went wrong</h1>
            <p className="text-red-800 mb-4">
              The graphing engine encountered an error and needs to recover.
            </p>

            {this.state.error && (
              <details className="mb-4 p-3 bg-red-100 rounded">
                <summary className="cursor-pointer font-semibold text-red-900">
                  Error details
                </summary>
                <pre className="mt-2 text-xs text-red-800 overflow-auto max-h-40">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="flex gap-2">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook for error recovery
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useErrorRecovery() {
  const [error, setError] = React.useState<Error | null>(null);
  const [isRecovering, setIsRecovering] = React.useState(false);

  const handleError = React.useCallback((err: Error) => {
    console.error('Caught error:', err);
    setError(err);
  }, []);

  const recover = React.useCallback(async (onRecover?: () => Promise<void>) => {
    setIsRecovering(true);
    try {
      await onRecover?.();
      setError(null);
      return true;
    } catch (e) {
      console.error('Recovery failed:', e);
      return false;
    } finally {
      setIsRecovering(false);
    }
  }, []);

  return { error, isRecovering, handleError, recover };
}

/**
 * Safe executor with error handling
 */
export async function safeExecute<T>(
  fn: () => T | Promise<T>,
  fallback: T,
  onError?: (err: Error) => void
): Promise<T> {
  try {
    return await Promise.resolve(fn());
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    onError?.(err);
    console.error('Safe execute failed:', err);
    return fallback;
  }
}

/**
 * Retry logic with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 100
): Promise<T> {
  let lastError: Error = new Error('Unknown error');

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Worker supervisor for background tasks
 */
export class WorkerSupervisor {
  private worker: Worker | null = null;
  private timeout: number = 5000;
  private taskTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(workerScript: string, timeout: number = 5000) {
    try {
      this.worker = new Worker(workerScript);
      this.timeout = timeout;
    } catch (e) {
      console.warn('Worker not available:', e);
    }
  }

  /**
   * Execute task with timeout
   */
  async execute<T>(task: any, timeout: number = this.timeout): Promise<T> {
    if (!this.worker) {
      throw new Error('Worker not available');
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Worker task timed out after ${timeout}ms`));
      }, timeout);

      const w = this.worker!;

      const listener = (event: MessageEvent) => {
        clearTimeout(timer);
        w.removeEventListener('message', listener);
        resolve(event.data);
      };

      const errorListener = (event: ErrorEvent) => {
        clearTimeout(timer);
        w.removeEventListener('error', errorListener);
        reject(new Error(event.message));
      };

      w.addEventListener('message', listener);
      w.addEventListener('error', errorListener);
      w.postMessage(task);
    });
  }

  /**
   * Terminate worker
   */
  terminate(): void {
    if (this.taskTimeout) {
      clearTimeout(this.taskTimeout);
    }
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

/**
 * State snapshot for recovery
 */
export interface StateSnapshot {
  expressions: any[];
  viewport: any;
  sliders: Record<string, number>;
  timestamp: Date;
}

export class StateRecovery {
  private snapshots: StateSnapshot[] = [];
  private maxSnapshots = 5;

  record(state: StateSnapshot): void {
    this.snapshots.push({ ...state, timestamp: new Date() });
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }
  }

  getLatest(): StateSnapshot | null {
    return this.snapshots[this.snapshots.length - 1] ?? null;
  }

  getPrevious(): StateSnapshot | null {
    return this.snapshots[this.snapshots.length - 2] ?? null;
  }

  getAllSnapshots(): StateSnapshot[] {
    return [...this.snapshots];
  }

  clear(): void {
    this.snapshots = [];
  }
}
