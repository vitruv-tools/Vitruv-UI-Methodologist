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

## Semantic Overlap

The **Semantic overlap** view (`/semantic-overlap`, sidebar entry after the Model Library) compares two
Model Library metamodels and proposes which classes, attributes and references most likely describe the
same concept. It runs entirely in the browser and offers two **approaches** (`approaches/registry.ts`):

- **Kessentini et al. 2014 (paper)**: search-based metamodel matching after Kessentini et al. (2014),
  *Search-based metamodel matching with structural and syntactic measures* (JSS 97), with the extensions
  listed below. It is frozen: golden tests (`paperGolden.test.ts`) guarantee identical results.
- **Improved** (default): an independent copy of the paper pipeline in `improved/` with nine switchable,
  non-learned improvements (see below). With every improvement off it equals the paper approach
  (`improved/equivalence.test.ts`).

### Flow

1. `SemanticOverlapView` lets the user pick two metamodels; `useSemanticOverlapRun` fetches both ecore
   files via `apiService.getFile` and parses them on the main thread (`readMetamodelGraph`, needs
   `DOMParser`).
2. The plain graphs go to a Web Worker (`src/workers/semanticOverlap.worker.ts`) together with the chosen
   approach. The worker loads the resources the approach needs (the WordNet synonym table, and for the
   improved approach the WordNet hypernym table, fetched as a separate asset) and calls the approach's
   pure `run`. Progress is posted back; cancelling terminates
   the worker (also on unmount and after a 5-minute limit).
3. The `OverlapResult` is kept in the zustand store `src/store/SemanticOverlap.ts` and shown as a React
   Flow link diagram, a canvas heatmap and a correspondence list that share selection, threshold and
   expanded rows. It can be exported as JSON or CSV.

### Modules (`src/utils/semanticOverlap/`)

| Folder / file | Responsibility |
|---|---|
| `ecore/readMetamodelGraph.ts` | ecore XML → serialisable `MetamodelGraph`; input limits (5 MB, 2,000 classes) |
| `lexical/` | camel-case tokeniser, morphy-style lemmatiser, `LexicalSource` over the bundled Open English WordNet table (`src/assets/wordnet/`, see its README) |
| `measures/` | `SimilarityMeasure` registry; structural (Eq. 8: NAT, NAC, WMC, DIT, NOC), cosine (Eq. 1–2) and edit-distance (Eq. 3) measures from the paper, plus two additional measures: `name-tokens` (word-by-word name comparison with WordNet synonyms, weight 0.75) and `neighbourhood` (names of supertypes and reference targets, classes only, weight 0.4); profiles and precomputed similarity matrices |
| `search/` | `MatchingProblem` (fitness Eq. 7 with a null score for unmatched elements), genetic algorithm, simulated annealing, the hybrid `hybrid-ga-sa` strategy and a strategy registry; seeded `mulberry32` RNG |
| `runOverlapAnalysis.ts` | pipeline: class level, hierarchy completion (unmatched super-/subtypes join the correspondence of their most similar source), then attributes/references inside each class correspondence; grouping of shared targets into one correspondence |
| `overlapResult.ts` | result format (`schemaVersion: 1`), JSON parse/validate, CSV export |
| `linkDiagramLayout.ts` | result → React Flow nodes and edges |
| `approaches/` | `Approach` contract (id, version, label, defaults, validation, required resources, `run`), the paper and improved approaches and the registry with `DEFAULT_APPROACH` |
| `correspondenceKind.ts` | labels for `same` and class ↔ instance correspondences |
| `improved/` | the improved approach: copied runner, measures, matching problem and settings plus the improvements below |

### Improvements of the improved approach (`improved/`)

Each improvement is switched in `settings.improvements[<id>]`; parameters live in `settings.params`.
The default combination (`DEFAULT_COMBINATION`) was chosen by an ablation over the benchmark suite.

| Id | What it does | Code |
|---|---|---|
| `adaptive-weights` | scales each measure's weight by the Harmony of its matrix, so measures without signal do not dilute the combined score | `measures/harmony.ts` |
| `hypernyms` | Wu-Palmer similarity of name words over WordNet noun hypernyms | `lexical/hypernymSource.ts`, `measures/hypernymMeasure.ts` |
| `compounds` | splits compounds (`Brakesystem` → brake, system), expands a small abbreviation list, matches acronyms | `lexical/compounds.ts`, `lexical/abbreviations.ts` |
| `idf` | weights name tokens by inverse document frequency over both metamodels | `lexical/idf.ts` |
| `roles` | compares the role of classes (root container, contained part, abstract base, identifier, …) | `measures/roleMeasure.ts` |
| `datatypes` | compares the mix of attribute data types (text, number, boolean, enum, other) | `measures/datatypeMeasure.ts` |
| `type-object` | rule-based detection of the type-object pattern (item → type with definitions and values) and its counterpart (a base class with concrete subclasses); proposes class ↔ instance correspondences, picking the definition and value class by data type (integers and decimals apart where the metamodel distinguishes them) | `typeObject/detectTypeObject.ts` |
| `flooding` | similarity flooding (Melnik et al. 2002) over containment, reference and inheritance edges | `flooding/similarityFlooding.ts` |
| `hierarchy-both` | hierarchy completion also on the source side | `hierarchy/completeHierarchyBothSides.ts` |

Class ↔ instance correspondences (`kind: 'instance'`, `instance: { side, role }`) say that an element of
one metamodel corresponds to an *instance* of a class of the other, e.g. `BrakeDisk` ↔ an `ItemType`
object. The views draw them dashed and label them; the result lists the detected `typeObjectPatterns`.

### Extension points

- **Similarity measures**: register a `SimilarityMeasure` (per level) and give it a weight in
  `settings.measures` — e.g. an AI/embedding-based measure. The search and the views stay unchanged.
- **Search strategies**: register a `SearchStrategy` and select it via `settings.strategy`.
- **Approaches**: add an `Approach` to the registry; the view, worker and export pick it up.
- **Lexical source**: anything implementing `LexicalSource` can replace WordNet.
- **Persistence / reaction generation**: `OverlapResult` is a versioned, self-contained JSON document;
  `ElementRef`s identify elements by metamodel side, kind and qualified name, so results can be stored
  and turned into reactions later without re-running the analysis.

### Benchmark

The benchmark suite (`src/__tests__/utils/semanticOverlap/benchmark/suite.ts`) has four scenarios: the
paper's Fig. 1 excerpt (committed), Ecore → UML 2.0 (ModelCVS, downloaded with
`node scripts/fetch-overlap-benchmark.mjs`), and Brake → BOM / BOM → Brake. The Brake Specification Model
is local only and never committed (`node scripts/fetch-overlap-benchmark.mjs --brake <path>`); tests that
need it are skipped without it, e.g. in CI. References may mark correspondences as class ↔ instance; a
proposed correspondence only counts if its elements and its kind match. See
`src/__tests__/fixtures/semanticOverlap/benchmark/README.md`.

- `OVERLAP_BENCHMARK=1 npx vitest run src/__tests__/utils/semanticOverlap/benchmark --reporter=verbose`
  prints precision, recall and F-measure per scenario and approach (seeds 1–10).
- `OVERLAP_ABLATION=1 OVERLAP_REPORT_DIR=<dir> npx vitest run src/__tests__/utils/semanticOverlap/benchmark/ablation.test.ts --reporter=verbose`
  evaluates every improvement alone, then selects the combination (an improvement is kept only if
  removing it lowers the average F-measure by at least 0.02 and adding the others does not help), and
  writes a JSON report.

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