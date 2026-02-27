import React, { useState } from 'react';
import { useExpressionsStore } from '../store/expressions.store';

export const ExpressionEditor: React.FC = () => {
  const [input, setInput] = useState('');
  const { expressions, addExpression, removeExpression, updateExpression } = useExpressionsStore();
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      addExpression(input.trim());
      setInput('');
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSubmit(e);
    }
  };
  
  return (
    <section className="bg-white rounded-lg shadow-lg p-6" aria-labelledby="expr-title">
      <h3 id="expr-title" className="text-lg font-bold text-gray-800 mb-4">
        📝 Expressions
      </h3>
      
      <form onSubmit={handleSubmit} className="mb-6" id="expr-form">
        <div className="flex flex-col gap-2">
          <label htmlFor="expr-input" className="text-sm font-medium text-gray-700">
            Enter a mathematical expression
          </label>
          <div className="flex gap-2">
            <input
              id="expr-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., sin(x), x^2 + a*x, sqrt(abs(x))"
              className="flex-1 px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              aria-label="Mathematical expression input"
              aria-describedby="expr-help"
              autoComplete="off"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition"
              aria-label="Add expression to graph"
            >
              Add
            </button>
          </div>
          <p id="expr-help" className="text-xs text-gray-600">
            Supports: sin, cos, tan, sqrt, abs, log, exp, and standard operators (+, −, ×, ÷, ^)
          </p>
        </div>
      </form>
      
      <div className="space-y-2">
        {expressions.length > 0 && (
          <p className="text-xs font-medium text-gray-600 mb-3">
            {expressions.length} expression{expressions.length !== 1 ? 's' : ''} plotted
          </p>
        )}
        
        {expressions.map((expr, idx) => (
          <div
            key={expr.id}
            className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition"
            role="listitem"
          >
            <button
              onClick={() => updateExpression(expr.id, { visible: !expr.visible })}
              className="flex-shrink-0 w-6 h-6 rounded border-2 border-gray-300 hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition flex items-center justify-center"
              style={{
                backgroundColor: expr.visible ? expr.color : 'white',
                borderColor: expr.color,
              }}
              aria-label={expr.visible ? `Hide expression ${idx + 1}: ${expr.text}` : `Show expression ${idx + 1}: ${expr.text}`}
              title={expr.visible ? 'Hide' : 'Show'}
            >
              {expr.visible && (
                <span className="text-white text-xs font-bold">✓</span>
              )}
            </button>
            
            <code className="flex-1 text-sm font-mono text-gray-800 break-all">
              {expr.text}
            </code>
            
            <button
              onClick={() => removeExpression(expr.id)}
              className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 rounded transition"
              aria-label={`Delete expression: ${expr.text}`}
              title="Remove expression"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        ))}
        
        {expressions.length === 0 && (
          <div className="text-center text-gray-500 py-6 bg-gray-50 rounded-lg">
            <p className="text-sm">No expressions yet.</p>
            <p className="text-xs mt-1">Enter an expression above to start graphing!</p>
          </div>
        )}
      </div>
    </section>
  );
};