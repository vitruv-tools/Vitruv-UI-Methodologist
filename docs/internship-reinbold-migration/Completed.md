# Phase 0 — Completed

**Date:** 2026-08-12
**Reference:** [README.md](./README.md) § Phase 0 — Dependencies and scaffolding

---

## What Was Done

Phase 0 establishes the dependency and file scaffolding required by all subsequent Low Code implementation phases. No application logic was added — only the foundation for Phases 1–7.

### 1. Direct dependencies added to `package.json`


| Package               | Version    | Purpose                                                                                                               |
| --------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------- |
| `zustand`             | `^5.0.5`   | Lightweight state management for Low Code stores (`Project`, `VsumDetails`, `SelectedEdge`, etc.)                     |
| `ecore-ts`            | `^0.14.0`  | TypeScript Ecore meta-model library; provides `EObject` type for identifier maps and fine-granular reaction edge data |
| `@mui/material`       | `^7.3.7`   | Material UI component library for the Low Code form editor UI                                                         |
| `@mui/icons-material` | `^7.3.7`   | Material UI icon set used by `DragablePanel` and `LowCodeReactionEditor`                                              |
| `@emotion/react`      | `^11.14.0` | CSS-in-JS runtime required by MUI v7                                                                                  |
| `@emotion/styled`     | `^11.14.0` | Styled component API required by MUI v7                                                                               |


**Decision:** `ecore-ts` **vs custom type** — We chose to keep `ecore-ts` rather than define a local `EObject`-like type. Rationale:

- The package is already installed without conflict (the current UML pipeline in `ecoreToUml.ts` / `umlGenerator.ts` does custom XML parsing and never imports `ecore-ts`; the two approaches are independent)
- Usage is limited to store files (`EditableVsumDetails.ts`, `VsumDetails.ts`) — easy to swap later if needed
- Provides future-proofing for deeper Ecore model manipulation

**Decision: MUI vs re-implementing** — We chose to keep the MUI-based Low Code UI. Rationale:

- The old branch's Low Code editor (`LowCodeReactionEditor`, `FieldRenderer`, `DragablePanel`) was built with MUI
- Re-implementing all form fields, icons, and panel chrome in raw React inline styles would be high effort for no user-visible benefit
- MUI is scoped to Low Code components only and does not affect the rest of the develop UI



### 2. CSS variable stylesheet created

**File:** `src/styles/reaction.css`

Contains CSS custom property rules that control the visibility of fine-granular reaction handles and edges on the React Flow canvas. Default state is hidden (`pointer-events: none; opacity: 0`). When the user enters reactions mode, `FineGranularReactionUtils.ts` toggles these variables to make handles and edges interactive.

Handles are scoped by:

- Position: `left` / `right`
- Type: `source` / `target`
- ID prefix: `reaction`

Edges are scoped by the `fine-granular-reaction` edge type class.

### 3. CSS import wired into application entry point

**File:** `src/index.tsx`

Added `import './styles/reaction.css'` so the variable-based visibility rules are loaded at application startup. Placed between `global.css` and `index.css` imports.

### 4. Low Code component directory verified

**Directory:** `src/components/flow/lowcode/`

The directory exists and is empty, ready for Phase 4 component implementations:

- `GhostNode.tsx` — invisible node for mid-edge reaction handles
- `LowCodeReactionEdgeValidator.tsx` — cross-model connection validator
- `LowCodeReactionEditor.tsx` — metadata-driven form editor

Supporting components at `src/components/flow/` level (also Phase 4):

- `DragablePanel.tsx` — draggable/minimizable host panel
- `FieldRenderer.tsx` — renders one metadata field
- `EdgeValidator.tsx` — shared validator wrapper

---



## How It Was Done

1. Edited `package.json` to add the 6 new dependencies in the `dependencies` block
2. Ran `npm install` — all packages resolved successfully (added 6 packages)
3. Created `src/styles/reaction.css` with CSS custom property rules for handle/edge visibility
4. Added `import './styles/reaction.css'` to `src/index.tsx`
5. Verified `src/components/flow/lowcode/` directory exists (empty, as expected for Phase 0)
6. Ran `npx tsc --noEmit` — no new TypeScript errors introduced (pre-existing test errors in `__tests__/` are unrelated)
7. Verified all 6 dependency modules resolve correctly:
  - `zustand` — CommonJS + ESM, resolves OK
  - `@mui/material` — resolves OK
  - `@mui/icons-material` — resolves OK
  - `@emotion/react` — resolves OK
  - `@emotion/styled` — resolves OK
  - `ecore-ts` — ESM-only package (no `main` field, only `module: dist/ecore-ts.js`); type declarations at `dist/main.d.ts` resolve correctly for TypeScript; CRA/webpack handles ESM at bundle time

---



## What Was NOT Done (Intentionally)

Per the README's "Do not copy" list:

- **No** `.vscode/settings.json` **changes** copied from old branch
- **No Dependabot configuration** changes
- **No application logic** added — Phase 0 is scaffolding only
- **No store, type, util, or component files** created — those belong to Phases 1–4
- **No modifications to** `FlowCanvas.tsx` **or** `CanvasPage.tsx` — those belong to Phase 5

---



## Files Modified


| File                | Change                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `package.json`      | Added 6 dependencies: `zustand`, `ecore-ts`, `@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled` |
| `package-lock.json` | Auto-updated by `npm install`                                                                                            |
| `src/index.tsx`     | Added `import './styles/reaction.css'`                                                                                   |




## Files Created


| File                                              | Content                                                       |
| ------------------------------------------------- | ------------------------------------------------------------- |
| `src/styles/reaction.css`                         | CSS custom property rules for reaction handle/edge visibility |
| `docs/internship-reinbold-migration/Completed.md` | This document                                                 |


---



## Verification Checklist

- [x] `npm install` succeeds with no errors
- [x] `npx tsc --noEmit` produces no new errors (only pre-existing test errors)
- [x] All 6 new packages resolve at runtime
- [x] `ecore-ts` type declarations (`dist/main.d.ts`) are present and include `EObject` class export
- [x] `reaction.css` is imported and will be loaded at app startup
- [x] `src/components/flow/lowcode/` directory exists for Phase 4

---



## Next Phase

**Phase 1 — Types + API surface**

---
---

# Phase 1 — Completed

**Date:** 2026-08-12
**Reference:** [README.md](./README.md) § Phase 1 — Types + API surface

---

## What Was Done

Phase 1 establishes all Low Code type definitions and extends the API surface to support fine-granular reactions. Nine new type files were created and the barrel `index.ts` was updated to re-export them. The API service, existing flow types, and snapshot utilities were extended.

### 1. Low Code metadata types (4 files)

| File | Type exported |
|------|---------------|
| `src/types/LowCodeReactionFieldMetadata.ts` | `LowCodeReactionFieldMetadata` — full field descriptor (name, type, constraints, display defaults) matching the backend `/api/lowcode-metadata` response |
| `src/types/LowCodeReactionMetadata.ts` | `LowCodeReactionMetadata` — one reaction template entry (name, description, hide flag, field array) |
| `src/types/LowCodeReactionMetadataResponse.ts` | `LowCodeReactionMetadataResponse` — top-level response wrapper (`reactionMetadataMap` keyed by reaction name) |
| `src/types/LowCodeReactionFieldVariables.ts` | `LowCodeReactionFieldVariables` — template variable context for default-value interpolation (source/target model/element URIs and aliases) |

### 2. Fine-granular and editable types (5 files)

| File | Type(s) exported |
|------|------------------|
| `src/types/FineGranularMetaModelRelation.ts` | `EditableFineGranularMetaModelRelation` — persisted fine relation (`id`, `sourceId`, `targetId`, `reactionFileStorageId`, `lowCodeReactionRequestBase`) |
| `src/types/FlowFineGranularMetaModelRelationData.ts` | `FlowFineGranularMetaModelRelationData` — React Flow edge data for fine-granular reaction edges (`ecore.eObjectSourceId/TargetId`, `fromModel`, `toModel`) |
| `src/types/FlowMetaModelRelationData.ts` | `FlowMetaModelRelationData` — React Flow edge data for coarse-grained reaction edges |
| `src/types/EditableVsumDetails.ts` | `EditableVsumDetails`, `EditableVsumMetaModelRef`, `EditableVsumMetaModelRelation` — mutable VSUM details for Zustand store with `fineGranularMetaModelRelationSet` |
| `src/types/EdgeEventHandlers.ts` | `OnEdgeClickParams`, `OnEdgeDeleteParams`, `OnEdgeDoubleClickParams` — typed callback parameter shapes |

### 3. Extended `src/types/flow.ts`

Added additive fields to support the expanded canvas mode and fine-granular edges:

| Addition | Purpose |
|----------|---------|
| `FlowNodeECoreData` type | Ecore identity data for expanded EObject nodes (`model`, `eObjectId`, attribute/reference/operation IDs) |
| `FlowNode.data.ecore?` | Optional Ecore data on any flow node |
| `FlowNode.data.isBoundingBox?` | Identifies bounding-box grouping nodes |
| `FlowNode.data.group?` | Group key for bounding-box membership |
| `UMLNode` type | Flow node with `backendMetaModelId` in data |
| `FlowEdgeData` type | Explicit edge data type (`relationshipType`, `sourceMultiplicity`, `targetMultiplicity`, `labelX`, `labelY`) |
| `FlowEdge` | Changed from `Edge` to `Edge<FlowEdgeData>` |
| `FlowEcoreEdge` | Edge with both `FlowEdgeData` and `FlowFineGranularMetaModelRelationData` |

### 4. Extended `src/services/api.ts`

| Change | Detail |
|--------|--------|
| New method `getLowCodeReactionsMetadata()` | `GET /api/lowcode-metadata` → returns `LowCodeReactionMetadataResponse` |
| Extended `MetaModelRelationRequest` | Added optional `fineGranularMetaModelRelationSet?: EditableFineGranularMetaModelRelation[]` |

### 5. Extended snapshot utilities

| File | Change |
|------|--------|
| `src/utils/workspaceSnapshotUtils.ts` | `cloneWorkspaceSnapshot` deep-clones `fineGranularMetaModelRelationSet`. `prepareSnapshotForSyncSave` preserves the fine set when present. |
| `src/components/flow/flowCanvasSnapshot.ts` | `buildWorkspaceSnapshot` collects fine-granular reaction edges (`type: 'fine-granular-reaction'`), groups them by parent coarse relation key, and attaches them as `fineGranularMetaModelRelationSet` on the matching `MetaModelRelationRequest`. |

### 6. Updated barrel export

`src/types/index.ts` re-exports all 9 new type modules for convenient single-import access.

---

## Key Decisions

**Canonical payload field name:** `lowCodeReactionRequestBase` — as specified in the README. The earlier `lowCodeReactionTemplate` + `lowCodeReactionTemplateParams` split from earlier old-branch commits was not revived.

**`FlowEdge` now generic:** Changed from bare `Edge` to `Edge<FlowEdgeData>` to enable typed access to edge data throughout the codebase. `FlowEcoreEdge` layers fine-granular data on top.

**Fine-edge snapshot grouping:** Fine-granular edges on the canvas use `ecore.fromModel` / `ecore.toModel` (meta-model source IDs as strings) as the grouping key, matching them to coarse relation entries by `sourceId->targetId`.

---

## Files Created

| File | Content |
|------|---------|
| `src/types/LowCodeReactionFieldMetadata.ts` | Field metadata type |
| `src/types/LowCodeReactionMetadata.ts` | Reaction metadata type |
| `src/types/LowCodeReactionMetadataResponse.ts` | API response wrapper type |
| `src/types/LowCodeReactionFieldVariables.ts` | Template variables type |
| `src/types/FineGranularMetaModelRelation.ts` | Editable fine relation type |
| `src/types/FlowFineGranularMetaModelRelationData.ts` | React Flow edge data type |
| `src/types/FlowMetaModelRelationData.ts` | Coarse edge data type |
| `src/types/EditableVsumDetails.ts` | Editable VSUM details types |
| `src/types/EdgeEventHandlers.ts` | Edge event callback param types |

## Files Modified

| File | Change |
|------|--------|
| `src/types/flow.ts` | Added `FlowNodeECoreData`, `UMLNode`, `FlowEdgeData`, `FlowEcoreEdge`; extended `FlowNode.data` |
| `src/types/index.ts` | Added barrel re-exports for all 9 new type modules |
| `src/services/api.ts` | Added `getLowCodeReactionsMetadata()` method; extended `MetaModelRelationRequest` |
| `src/utils/workspaceSnapshotUtils.ts` | Deep-clone and preserve fine set in snapshot clone/save |
| `src/components/flow/flowCanvasSnapshot.ts` | Collect fine-granular edges and attach to parent coarse relations |

---

## Verification Checklist

- [x] `npx tsc --noEmit` produces no new errors in any modified or created file
- [x] All type exports resolve correctly through barrel `src/types/index.ts`
- [x] `getLowCodeReactionsMetadata()` follows existing `authenticatedRequest` pattern
- [x] `MetaModelRelationRequest.fineGranularMetaModelRelationSet` is optional (backward compatible)
- [x] Snapshot utilities correctly deep-clone and serialize fine-granular data
- [x] `FlowEdge` type change is additive (existing `Edge` usages remain compatible)
- [x] Linter reports no errors in any modified file

---

## Next Phase

**Phase 3 — Utils (behavior without UI)**: Port/rewrite FieldUtils, LowCodeReactionUtils, FineGranularReactionUtils, ReactionUtils, EcoreIdentifiers.

---
---

# Phase 2 — Completed

**Date:** 2026-08-12
**Reference:** [README.md](./README.md) § Phase 2 — Zustand stores

---

## What Was Done

Phase 2 creates the entire Zustand store backbone for the Low Code integration. Seven store/error files plus one utility file were created. The store is initialized at VSUM load time in `CanvasPage.tsx`.

### 1. DeepClone utility

**File:** `src/utils/DeepClone.ts`

Store-safe cloning for `Map`, `Set`, `Date`, arrays, and plain objects. Used by `VsumDetailsHelper.get()` and `saveToStore()` to ensure callers never hold a reference to store-internal state.

### 2. Error classes (3 files)

| File | Class | Thrown when |
|------|-------|------------|
| `src/store/NoActiveVsumError.ts` | `NoActiveVsumError` | `ActiveVsumDetails` instantiated with no `activeId` in project store |
| `src/store/NoVsumDetailsStoreError.ts` | `NoVsumDetailsStoreError` | `getVsumDetailsStore(id)` called before `createVsumDetailsStore(id, …)` |
| `src/store/EditableVsumMetaModelRefConversionError.ts` | `EditableVsumMetaModelRefConversionError` | Converting backend refs to editable form fails validation |

### 3. Project store

**File:** `src/store/Project.ts`

| Field | Type | Purpose |
|-------|------|---------|
| `activeId` | `number \| null` | Currently loaded VSUM id |
| `mode` | `'workspace' \| 'expanded' \| 'reactions'` | Three-way canvas mode for Low Code |
| `reactionFiles` | `Set<ReactionFile>` | Known reaction files (`{ fromModel, toModel, id }`) |
| `expandedMetaModels` | `Set<number> \| null` | Meta-model source IDs currently expanded on canvas |

`setActiveId()` resets `mode` to `'workspace'` and clears `reactionFiles` and `expandedMetaModels` to prevent stale cross-project state.

### 4. VsumDetails store

**File:** `src/store/VsumDetails.ts`

Per-VSUM store registry backed by `zustand/vanilla` (`createStore`). Key concepts:

- **Registry:** `createVsumDetailsStore(vsumId, initial)` / `getVsumDetailsStore(vsumId)` / `hasVsumDetailsStore(vsumId)` / `deleteVsumDetailsStore(vsumId)`
- **VsumDetailsHelper** — CRUD on a deep-cloned working copy:
  - `getMetaModelRelation(query)` / `addMetaModelRelation(rel)` / `removeMetaModelRelation(src, tgt)`
  - `getFineGranularMetaModelRelation(…)` / `addFineGranularMetaModelRelation(…)` / `removeFineGranularMetaModelRelation(…)` / `getAllFineGranularMetaModelRelations()`
  - `setIdentifiersToBackendMetaModelId(map)` / `getBackendMetaModelId(identifier)`
  - `getAsWorkspaceSnapshot()` — produces develop-compatible `WorkspaceSnapshot` including fine sets
  - `saveToStore()` — commits the working copy back to the Zustand store

### 5. ActiveVsumDetails helper

**File:** `src/store/ActiveVsumDetails.ts`

Convenience `VsumDetailsHelper` subclass that reads `useProjectStore.activeId` on construction. Also exports `getActiveVsumDetailsStore()` and `hasActiveVsumDetailsStore()`.

### 6. SelectedEdge store

**File:** `src/store/SelectedEdge.ts`

Simple store holding the currently selected `FlowEcoreEdge | null`. Set by `FlowCanvas` on edge click, consumed by the Low Code editor panel.

### 7. CanvasPage integration

**File:** `src/pages/CanvasPage.tsx`

In `loadVsum`, after `getVsumDetails` returns:

1. Calls `useProjectStore.getState().setActiveId(vsumId)` — resets mode and clears stale state
2. Maps `VsumDetails` → `EditableVsumDetails`:
   - Meta-models are shallow-cloned
   - Relations are mapped with `fineGranularMetaModelRelationSet: []` (seeded empty until backend support)
   - `reactionFileId` / `reactionFileStorageId` are normalized to `null` when absent
3. Calls `createVsumDetailsStore(vsumId, editableDetails)` — registers the per-VSUM store

---

## Key Decisions

**Per-VSUM store map vs global store:** Each VSUM gets its own Zustand store instance. This avoids state conflicts when switching between projects/tabs. The `storeMap` is a plain `Map<number, StoreApi>` module singleton.

**Deep clone on read and write:** `VsumDetailsHelper.get()` returns a deep clone; `saveToStore()` deep-clones before writing. This prevents accidental reference sharing between helper working copies and the store.

**`setActiveId` auto-reset:** Changing the active VSUM resets mode to `'workspace'` and clears reaction files / expanded models. This matches the old branch behavior and prevents stale Low Code state from bleeding across projects.

**Fine set seeded empty:** `fineGranularMetaModelRelationSet: []` is seeded on load. The backend does not yet return fine relations — they are client-authored and stored until the next VSUM sync round-trip.

---

## Files Created

| File | Content |
|------|---------|
| `src/utils/DeepClone.ts` | `deepClone()`, `deepCloneArray()` |
| `src/store/NoActiveVsumError.ts` | Error class |
| `src/store/NoVsumDetailsStoreError.ts` | Error class |
| `src/store/EditableVsumMetaModelRefConversionError.ts` | Error class |
| `src/store/Project.ts` | `useProjectStore` (Zustand) |
| `src/store/VsumDetails.ts` | Per-VSUM store registry + `VsumDetailsHelper` |
| `src/store/ActiveVsumDetails.ts` | `ActiveVsumDetails` helper + convenience functions |
| `src/store/SelectedEdge.ts` | `useSelectedEdgeStore` (Zustand) |

## Files Modified

| File | Change |
|------|--------|
| `src/pages/CanvasPage.tsx` | Added imports for stores/types; added store initialization block in `loadVsum` |

---

## Verification Checklist

- [x] `npx tsc --noEmit` produces no new errors in any store or utility file
- [x] No linter errors in any created or modified file
- [x] `useProjectStore.setActiveId()` resets mode and clears reaction state
- [x] `VsumDetailsHelper` CRUD methods mutate working copy, not store directly
- [x] `saveToStore()` deep-clones before writing to Zustand
- [x] `createVsumDetailsStore` is called after `getVsumDetails` in `loadVsum`
- [x] Fine-granular relation set is seeded as empty array on load
- [x] AuthContext is untouched (per README: "Do not remove AuthContext")