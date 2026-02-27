import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DeterministicIDGenerator } from '../engine/determinism';

export interface Expression {
  id: string;
  text: string;
  color: string;
  visible: boolean;
  error?: string;
}

export interface ExpressionsStore {
  expressions: Expression[];
  addExpression: (text: string) => void;
  updateExpression: (id: string, updates: Partial<Expression>) => void;
  removeExpression: (id: string) => void;
  reorderExpressions: (fromIndex: number, toIndex: number) => void;
  clearExpressions: () => void;
}

export const useExpressionsStore = create<ExpressionsStore>()(
  persist(
    (set) => ({
      expressions: [],
      
      addExpression: (text: string) => 
        set((state) => {
          // Check if this exact expression already exists
          const existingIndex = state.expressions.findIndex(e => e.text === text);
          if (existingIndex !== -1) {
            // Don't re-add the same expression
            return state;
          }
          
          return {
            expressions: [
              ...state.expressions,
              {
                // Use text+length as unique key for deterministic ID
                // This ensures same expression always gets same ID across reruns
                id: DeterministicIDGenerator.generateExpressionID(text, state.expressions.length),
                text,
                color: getNextColor(state.expressions.length),
                visible: true
              }
            ]
          };
        }),
      
      updateExpression: (id: string, updates: Partial<Expression>) =>
        set((state) => ({
          expressions: state.expressions.map(expr =>
            expr.id === id ? { ...expr, ...updates } : expr
          )
        })),
      
      removeExpression: (id: string) =>
        set((state) => ({
          expressions: state.expressions.filter(expr => expr.id !== id)
        })),
      
      reorderExpressions: (fromIndex: number, toIndex: number) =>
        set((state) => {
          const newExpressions = [...state.expressions];
          const [removed] = newExpressions.splice(fromIndex, 1);
          if (!removed) return { expressions: state.expressions };
          newExpressions.splice(toIndex, 0, removed);
          return { expressions: newExpressions };
        }),
      
      clearExpressions: () => set({ expressions: [] })
    }),
    {
      name: 'graphing-expressions',
      version: 1
    }
  )
);

const colors = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

function getNextColor(index: number = 0): string {
  const idx = (index ?? 0) as number;
  return (colors[idx % colors.length] ?? colors[0])!;
}