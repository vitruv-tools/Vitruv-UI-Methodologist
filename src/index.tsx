import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/global.css';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { ToastProvider } from './components/ui/ToastProvider';

// Suppress benign ResizeObserver error that occurs with React Flow
// This error doesn't affect functionality - it just means resize observations
// couldn't all be delivered in a single animation frame
const resizeObserverError = (e: ErrorEvent) => {
  if (e.message === 'ResizeObserver loop completed with undelivered notifications.') {
    e.stopImmediatePropagation();
  }
};
globalThis.addEventListener('error', resizeObserverError);

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>
);

reportWebVitals();
