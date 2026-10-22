import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/global.css';
import './styles/theme.css';
import './styles/reaction.css';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { ToastProvider } from './components/ui/ToastProvider';

// Comprehensive ResizeObserver error suppression
// This error is benign and occurs when resize observations can't all be delivered in one frame
// Common with React Flow, Monaco Editor, and other dynamic UI components

// Method 1: Patch ResizeObserver to catch errors at the source
const OriginalResizeObserver = globalThis.ResizeObserver;
globalThis.ResizeObserver = class extends OriginalResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    super((entries, observer) => {
      requestAnimationFrame(() => {
        callback(entries, observer);
      });
    });
  }
};

// Method 2: Suppress via error event
const resizeObserverError = (e: ErrorEvent) => {
  if (
    (typeof e.message === 'string' && e.message.includes('ResizeObserver loop')) ||
    e.error?.message?.includes('ResizeObserver loop')
  ) {
    e.stopImmediatePropagation();
    e.preventDefault();
    return false;
  }
};

globalThis.addEventListener('error', resizeObserverError);

// Method 3: Suppress via console.error override
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  const message = args[0]?.toString() || '';
  if (message.includes('ResizeObserver loop')) {
    return;
  }
  originalConsoleError.apply(console, args);
};

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
