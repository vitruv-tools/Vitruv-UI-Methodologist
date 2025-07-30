# Vitruvius Modeler - Project Architecture

## Overview

This document describes the organized folder structure and architecture of the Vitruvius Modeler React application. The project has been restructured to follow React best practices with a clear separation of concerns.

## Folder Structure

```
src/
├── components/           # React components organized by feature
│   ├── flow/            # Flow-related components
│   │   ├── EditableNode.tsx
│   │   └── FlowCanvas.tsx
│   ├── layout/          # Layout components
│   │   ├── Header.tsx
│   │   ├── MainLayout.tsx
│   │   └── Sidebar.tsx
│   ├── ui/              # Reusable UI components
│   │   └── Button.tsx
│   └── index.ts         # Component exports
├── hooks/               # Custom React hooks
│   ├── useFlowState.ts
│   ├── useDragAndDrop.ts
│   └── index.ts
├── services/            # API and external service integrations
│   └── api.ts
├── types/               # TypeScript type definitions
│   ├── flow.ts
│   └── index.ts
├── utils/               # Utility functions
│   ├── flowUtils.ts
│   └── index.ts
├── constants/           # Application constants
│   └── index.ts
├── styles/              # Global styles
│   └── global.css
├── App.tsx              # Main application component
└── index.tsx            # Application entry point
```

## Component Architecture

### Layout Components

#### `MainLayout`
- **Purpose**: Main layout wrapper that organizes the overall application structure
- **Features**: Combines Sidebar, Header, and FlowCanvas
- **Props**: `onDeploy`, `onSave`, `onLoad`, `onNew`

#### `Header`
- **Purpose**: Application header with navigation and action buttons
- **Features**: Title display, Save/Load/New buttons
- **Props**: `onSave`, `onLoad`, `onNew`, `title`

#### `Sidebar`
- **Purpose**: Left sidebar with draggable node types
- **Features**: Drag and drop functionality for flow nodes
- **Props**: None (self-contained)

### Flow Components

#### `FlowCanvas`
- **Purpose**: Main React Flow canvas with all flow functionality
- **Features**: Node management, edge connections, drag and drop
- **Props**: `onDeploy`

#### `EditableNode`
- **Purpose**: Custom node component with inline editing
- **Features**: Double-click to edit, keyboard shortcuts
- **Props**: React Flow NodeProps

### UI Components

#### `Button`
- **Purpose**: Reusable button component with variants
- **Features**: Multiple variants (primary, secondary, success, danger), sizes
- **Props**: `children`, `onClick`, `variant`, `size`, `disabled`, `className`

## Custom Hooks

### `useFlowState`
- **Purpose**: Manages React Flow state (nodes, edges)
- **Features**: Node/edge CRUD operations, ID generation
- **Returns**: Flow state and operations

### `useDragAndDrop`
- **Purpose**: Handles drag and drop functionality
- **Features**: Node creation from dropped items
- **Returns**: `onDrop`, `onDragOver` handlers

## Services

### `ApiService`
- **Purpose**: Centralized API communication
- **Features**: CRUD operations for flows, deployment
- **Methods**: `deployFlow`, `saveFlow`, `loadFlow`, `listFlows`, `deleteFlow`

## Type Definitions

### Flow Types
- `FlowNode`: Extended Node with custom data structure
- `FlowEdge`: Extended Edge for future customization
- `FlowData`: Complete flow data structure
- `NodeType`: Union type for node types
- `DragItem`: Drag and drop item structure

## Utilities

### `flowUtils`
- **Purpose**: Flow data manipulation utilities
- **Features**: Export/import, validation, ID generation
- **Functions**: `exportFlowData`, `importFlowData`, `validateFlowData`, `generateFlowId`

## Constants

### Application Constants
- `API_CONFIG`: API configuration (base URL, timeout)
- `FLOW_CONFIG`: Flow-specific configuration (node types, labels)
- `UI_CONFIG`: UI configuration (dimensions, colors)

## Styling

### Global Styles
- **File**: `src/styles/global.css`
- **Purpose**: Application-wide styles and utility classes
- **Features**: CSS reset, utility classes, custom scrollbars, React Flow customization

## Best Practices Implemented

### 1. Separation of Concerns
- Components are organized by feature and responsibility
- Business logic is separated into custom hooks
- API calls are centralized in services

### 2. Type Safety
- Comprehensive TypeScript definitions
- Proper interface definitions for all components
- Type-safe API communication

### 3. Reusability
- Modular component design
- Custom hooks for shared logic
- Utility functions for common operations

### 4. Maintainability
- Clear folder structure
- Consistent naming conventions
- Comprehensive documentation

### 5. Performance
- Custom hooks for optimized state management
- Proper React.memo usage where needed
- Efficient re-rendering patterns

## Usage Examples

### Using Components
```tsx
import { MainLayout, Button } from './components';

function App() {
  return (
    <MainLayout
      onDeploy={handleDeploy}
      onSave={handleSave}
      onLoad={handleLoad}
      onNew={handleNew}
    />
  );
}
```

### Using Hooks
```tsx
import { useFlowState } from './hooks';

function MyComponent() {
  const { nodes, edges, addNode, updateNodeLabel } = useFlowState();
  // Use flow state...
}
```

### Using Services
```tsx
import { ApiService } from './services/api';

async function deployFlow(flowData) {
  try {
    const result = await ApiService.deployFlow(flowData);
    // Handle result...
  } catch (error) {
    // Handle error...
  }
}
```

## Future Enhancements

1. **State Management**: Consider Redux or Zustand for complex state
2. **Testing**: Add unit tests for components and utilities
3. **Error Boundaries**: Implement error boundaries for better error handling
4. **Accessibility**: Add ARIA labels and keyboard navigation
5. **Internationalization**: Add i18n support for multiple languages
6. **Theming**: Implement theme system for dark/light modes
7. **Performance**: Add React.memo and useMemo optimizations
8. **Documentation**: Add Storybook for component documentation

## Development Guidelines

1. **Component Creation**: Follow the established folder structure
2. **TypeScript**: Always define proper types for props and state
3. **Styling**: Use the global CSS classes and constants
4. **Testing**: Write tests for new components and utilities
5. **Documentation**: Update this file when adding new features
6. **Code Style**: Follow the existing code style and patterns 