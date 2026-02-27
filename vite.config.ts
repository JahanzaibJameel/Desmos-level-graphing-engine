import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@engine': path.resolve(__dirname, './src/engine'),
      '@canvas': path.resolve(__dirname, './src/canvas'),
      '@store': path.resolve(__dirname, './src/store'),
      '@ui': path.resolve(__dirname, './src/ui'),
      '@workers': path.resolve(__dirname, './src/workers')
    }
  },
  define: {
    'import.meta.vitest': 'undefined',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/snapshots/',
        '**/*.stories.*'
      ]
    }
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
          manualChunks(id) {
            if (!id) return undefined;
            if (id.includes('node_modules')) {
              // Split heavy math libraries into separate chunks to avoid a single large math bundle
              if (id.includes('mathjs')) return 'mathjs';
              if (id.includes('nerdamer')) return 'nerdamer';
              if (id.includes('decimal.js')) return 'decimaljs';
              if (id.includes('zustand')) return 'state';
              if (id.includes('react') || id.includes('react-dom')) return 'vendor';
              // Fallback for other node_modules
              return 'vendor-others';
            }
            return undefined;
          }
        }
    }
  }
})  