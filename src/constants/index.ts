// API Configuration
export const API_CONFIG = {
  BASE_URL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080/api',
  TIMEOUT: 10000,
} as const;

// Flow Configuration
export const FLOW_CONFIG = {
  NODE_TYPES: {
    SEQUENCE: 'sequence',
    OBJECT: 'object',
  },
  DEFAULT_LABELS: {
    SEQUENCE: 'Sequence Table',
    OBJECT: 'Object Table',
  },
} as const;

// UI Configuration
export const UI_CONFIG = {
  SIDEBAR_WIDTH: 180,
  HEADER_HEIGHT: 60,
  COLORS: {
    PRIMARY: '#0091ea',
    SECONDARY: '#6c757d',
    SUCCESS: '#28a745',
    DANGER: '#dc3545',
    WARNING: '#ffc107',
    INFO: '#17a2b8',
    LIGHT: '#f8f9fa',
    DARK: '#343a40',
  },
} as const; 