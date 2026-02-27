import { useCallback } from 'react';
import { useExpressionsStore, Expression } from '../store/expressions.store';
import { validateExpression } from '../services/expressionService';

export function useExpressions() {
  const expressions = useExpressionsStore((s) => s.expressions);

  const addExpression = useCallback((text: string) => {
    if (!validateExpression(text)) {
      // mark invalid - the store will accept text but we avoid adding invalid inputs
      console.warn('Attempted to add invalid expression:', text);
      return;
    }
    useExpressionsStore.getState().addExpression(text);
  }, []);

  const updateExpression = useCallback((id: string, updates: Partial<Expression>) => {
    useExpressionsStore.getState().updateExpression(id, updates);
  }, []);

  const removeExpression = useCallback((id: string) => {
    useExpressionsStore.getState().removeExpression(id);
  }, []);

  const clearExpressions = useCallback(() => {
    useExpressionsStore.getState().clearExpressions();
  }, []);

  return {
    expressions,
    addExpression,
    updateExpression,
    removeExpression,
    clearExpressions
  } as const;
}
