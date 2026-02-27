import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Error boundary for production
if (import.meta.env.PROD) {
  const errorHandler = (error: Error) => {
    console.error('Uncaught error:', error);
    // Could send to Sentry here
  };
  
  window.addEventListener('error', (event) => {
    errorHandler((event as ErrorEvent).error);
  });
  
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = (event as PromiseRejectionEvent).reason;
    if (reason instanceof Error) {
      errorHandler(reason);
    } else {
      errorHandler(new Error(String(reason)));
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)