# 010 — `890b8d36` move information into store rather than reconstruct from flowgraph

| | |
|---|---|
| **Hash** | `890b8d367537b2fff4ba658a8f81bb6194847575` |
| **Category** | Architecture |

## Functionality introduced

Architectural pivot: VSUM graph truth lives in Zustand helpers, not reverse-engineered from React Flow on each action.

### Store modules

| Module | Responsibility |
|--------|----------------|
| `createVsumDetailsStore` / `getVsumDetailsStore` | Per-VSUM Zustand store map |
| `VsumDetailsHelper` | CRUD for metamodels/relations/fine relations; identifier maps; `saveToStore()`; `get()` deep clone; `getAsWorkspaceSnapshot()` |
| `ActiveVsumDetails` | Helper bound to `useProjectStore.activeId` |
| `useSelectedEdgeStore` | Selected fine edge for panel |
| Error classes | Missing store / missing active VSUM / conversion errors |
| `DeepClone` | Clone maps/objects safely for store reads |

### Rules of use

1. Mutate via helper methods on a working copy
2. Call `saveToStore()` to commit
3. `get()` returns a **deep clone** — callers must not assume identity with store state
4. React Flow edges are a **view** of store relations for fine-granular data

Also introduced typed edge event handlers / workspace file events used by Low Code wiring.

## Status on current `develop`

**Missing.** State is component-local (`FlowCanvas`, `CanvasPage`, hooks). No `src/store/`. `zustand` is not a direct dependency.

## Gap

Entire Low Code state backbone.

## What to implement today

1. Add `zustand` dependency
2. Create store + error + `DeepClone` files listed in README Phase 2
3. Implement helper methods needed by later phases (minimum):
   - `getMetaModelRelation`, `addMetaModelRelation`
   - `getFineGranularMetaModelRelation`, `removeFineGranularMetaModelRelation`
   - identifier map getters/setters
   - `getAsWorkspaceSnapshot()` producing develop-compatible `WorkspaceSnapshot` **plus** fine sets
4. Initialize from `CanvasPage` after `getVsumDetails`
5. Keep develop’s existing React Flow node/edge state for layout; sync fine relations from store → edges on load and after CRUD

### Adaptation vs old branch

Old commit also touched `MainLayout`, `VsumTabs`, `useUndoRedo`, etc. On develop:

- Prefer `CanvasPage` + `FlowCanvas` + existing `workspaceSnapshotUtils` / `flowCanvasSnapshot`
- Do not gut develop undo/redo unless Low Code specifically requires store-aware undo

## Files

| Action | File |
|--------|------|
| Create | `store/*` (7 files) |
| Create | `utils/DeepClone.ts` |
| Create | `types/EdgeEventHandlers.ts` |
| Modify | `pages/CanvasPage.tsx` |
| Modify | `components/flow/FlowCanvas.tsx` |
| Modify | `utils/workspaceSnapshotUtils.ts` / `flowCanvasSnapshot.ts` |

## Do not copy

- Wholesale MainLayout rewrite
- Removing develop patterns that still work for coarse reactions
- Reconstructing fine relations only from edge traversal after this pivot

## Dependencies

- Types from [007](./007-177de990-ecore-info-on-nodes-edges.md)
- Enables [009](./009-4ba1d3e0-frontend-saving-mechanism.md), [011](./011-9fdda458-remove-context-favor-zustand.md), [012](./012-ef7c8066-add-remove-fine-reactions.md)
- Snapshot inclusion also covered by supporting commit `322a3f85`
