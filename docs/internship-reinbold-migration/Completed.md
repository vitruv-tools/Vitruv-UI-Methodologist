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

# Phase 0.5 — Note

Phases are documented in reverse chronological order below (newest first).

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

---
---

# Phase 3 — Completed

**Date:** 2026-08-12
**Reference:** [README.md](./README.md) § Phase 3 — Utils (behavior without UI)

---

## What Was Done

Phase 3 implements all five utility modules that provide Low Code behavior logic without any UI. These modules sit between the Zustand stores (Phase 2) and the UI components (Phase 4).

### 1. EcoreIdentifiers.ts

**File:** `src/utils/EcoreIdentifiers.ts`

Extracted identifier/separator helpers from the old branch's `UMLFromEcoreTS.ts`. Does **not** replace develop's `ecoreToUml.ts` or `umlGenerator.ts`.

| Export | Purpose |
|--------|---------|
| `PACKAGE_SEPARATOR`, `FRAGMENT_SEPARATOR`, `FEATURE_SEPARATOR` | Constants for `/`, `#`, `.` separators (includes fix `21b6f7a0` `/` support) |
| `buildEObjectId(nsUri, className)` | Build FQ id like `"http://example.org/model#Person"` |
| `buildEObjectFeatureId(nsUri, className, featureName)` | Build FQ feature id |
| `parseEObjectId(fqId)` | Split FQ id into `{ modelNsUri, elementPath }` |
| `extractModelFromEObjectId(fqId)` | Get model nsURI part |
| `extractElementFromEObjectId(fqId)` | Get element path part |
| `extractClassFromElementPath(elementPath)` | Strip feature suffix |
| `deriveModelAlias(nsUri)` | Short alias from nsURI (last segment) |
| `deriveElementAlias(fqId)` | Short alias from FQ id |
| `getProperEObjectIdFromHandle(handleId)` | Parse `reaction-{source|target}-{eObjectId}` handle convention |
| `extractNsUriFromEcore(ecoreContent)` | Regex nsURI extraction from raw XML |

### 2. FieldUtils.ts

**File:** `src/utils/FieldUtils.ts`

Field type predicates, template evaluation, default value resolution, and validation.

| Category | Key exports |
|----------|-------------|
| Type predicates | `isStringField`, `isBooleanField`, `isIntegerField`, `isDecimalField`, `isNumericField`, `isCharacterField`, `isEnumField`, `isArrayField`, `isMapField`, `isHidden` |
| Template evaluation | `evaluateTemplate` (safe `{{var}}` substitution), `evaluateTemplateWithExpressionSupport` (also handles `${var}` for backward compat) |
| Defaults | `getFieldDefaultValue(field, variables?)`, `buildInitialFieldValues(fields, variables?)` |
| Validation | `validateNumericConstraints`, `validateStringConstraints`, `validateFieldValue` |

**Security:** Template evaluation uses constrained regex substitution, NOT `new Function`. Only allowlisted variable names from `LowCodeReactionFieldVariables` are resolved. Unknown placeholders are left as-is.

### 3. LowCodeReactionUtils.ts

**File:** `src/utils/LowCodeReactionUtils.ts`

Store-first Low Code form persistence. No backend endpoint — data lives in the VsumDetails store until VSUM sync.

| Export | Purpose |
|--------|---------|
| `hasLowCodeReactionConfig(edge)` | Check if a fine edge has stored Low Code form data |
| `temporarilySaveLowCodeReactionConfig(fieldValues, edge)` | Save form values to store (creates parent coarse relation if needed) |
| `getLowCodeReactionConfig(edge)` | Retrieve stored form values for a fine edge |

### 4. FineGranularReactionUtils.ts

**File:** `src/utils/FineGranularReactionUtils.ts`

The largest utility — covers fine edge lifecycle, ghost nodes, CSS visibility, and event handlers.

| Category | Key exports |
|----------|-------------|
| Type guards | `isFlowFineGranularMetaModelRelationData`, `isFineGranularReactionEdge` |
| Edge creation | `createFineGranularReactionEdge` (new edge + store push), `createExistingFineGranularReactionEdge` (loaded edge, no store push) |
| Edge deletion | `deleteFineGranularReactionEdgeFromVsumDetails` (store removal + selected edge clear) |
| Edge loading | `loadFineGranularEdgesFromStore(nodeResolver, idToModel)` |
| Ghost nodes | `isGhostNode`, `ghostNodeId`, `detectRequiredGhostNodes`, `createGhostNode` |
| CSS helpers | `enableReactionHandles`, `disableReactionHandles`, `enableReactionEdges`, `disableReactionEdges` |
| Handle IDs | `reactionSourceHandleId`, `reactionTargetHandleId` |
| Event handlers | `onFineGranularEdgeClick`, `onFineGranularEdgeDelete` |

### 5. ReactionUtils.ts

**File:** `src/utils/ReactionUtils.ts`

Coarse-grained relation helpers and reaction file inference.

| Export | Purpose |
|--------|---------|
| `registerReactionFilesFromRelations(relations, idToModel)` | Populate `useProjectStore.reactionFiles` from loaded coarse relations |
| `tryInferReactionFileIdForFineGranularReactionEdge(edge)` | 3-tier lookup: edge data → store relation → project file registry |
| `ensureCoarseRelation(fromModel, toModel)` | Create parent coarse relation if needed, returns backend ids |
| `buildBackendIdToModelMap(identifiersToBackendId)` | Reverse map: backend numeric id → model nsURI |

---

## Key Decisions

**Constrained template substitution over `new Function`:** The old branch used `new Function` with backtick interpolation for template defaults. This was replaced with a safe regex-based `{{var}}` / `${var}` substitution. Only variable names from the allowlisted `LowCodeReactionFieldVariables` type are resolved. This eliminates the code injection risk while maintaining full backward compatibility with backend metadata.

**EcoreIdentifiers scoped to identity only:** The utility extracts only identifier/separator helpers from the old `UMLFromEcoreTS.ts`. It does not touch develop's UML generation pipeline (`ecoreToUml.ts`, `umlGenerator.ts`, `ecoreParser.ts`).

**Three-tier reaction file inference:** `tryInferReactionFileIdForFineGranularReactionEdge` checks edge data first, then the VsumDetails store, then the project-level reaction file registry. This matches the end-state of the old branch after commits `6f425dd6` and `c599c0a6`.

**Ghost nodes as invisible anchors:** Ghost nodes are created with `opacity: 0` and `pointerEvents: 'none'`. They serve as mid-edge routing anchors between bounding boxes for cleaner visual connections.

---

## Files Created

| File | Content |
|------|---------|
| `src/utils/EcoreIdentifiers.ts` | FQ id helpers, separator constants, handle parsing, nsURI extraction |
| `src/utils/FieldUtils.ts` | Field predicates, template evaluation, defaults, validation |
| `src/utils/LowCodeReactionUtils.ts` | Store-first Low Code form persistence |
| `src/utils/FineGranularReactionUtils.ts` | Fine edge lifecycle, ghost nodes, CSS helpers, event handlers |
| `src/utils/ReactionUtils.ts` | Coarse relation helpers, reaction file inference |

## Files Modified

None — Phase 3 is entirely new utility files.

---

## Verification Checklist

- [x] `npx tsc --noEmit` produces no new errors in any utility file
- [x] No linter errors in any created file
- [x] Template evaluation uses safe regex substitution, not `new Function`
- [x] `EcoreIdentifiers.ts` includes `/` package separator (fix `21b6f7a0`)
- [x] `getProperEObjectIdFromHandle` parses `reaction-{source|target}-{id}` convention
- [x] Fine edge creation pushes to store; existing edge loading does not
- [x] CSS helpers toggle the same variables defined in `reaction.css`
- [x] Reaction file inference follows 3-tier lookup (edge → store → registry)
- [x] All utils import from Phase 1 types and Phase 2 stores correctly

---

## Next Phase

**Phase 5 — Wire into FlowCanvas + CanvasPage**: Register node/edge types, connect handlers, mode sync.

---
---

# Phase 4 — Completed

**Date:** 2026-08-12
**Reference:** [README.md](./README.md) § Phase 4 — UI components

---

## What Was Done

Phase 4 creates all six UI components required by the Low Code integration. These are the visual building blocks wired together in Phase 5.

### 1. GhostNode.tsx

**File:** `src/components/flow/lowcode/GhostNode.tsx`

Invisible 1×1px React Flow node with source/target handles. Used as a mid-edge routing anchor between meta-model bounding boxes for fine-granular reaction edges. Memoized for performance.

### 2. LowCodeReactionEdgeValidator.tsx

**File:** `src/components/flow/lowcode/LowCodeReactionEdgeValidator.tsx`

Connection validation for fine-granular reaction edges. Rules:

1. Must be in reactions mode (`useProjectStore.mode === 'reactions'`)
2. Both handles must resolve to EObject FQ ids via `getProperEObjectIdFromHandle`
3. Source and target must belong to different meta-models
4. Self-connections are not allowed

Also exports `isReactionHandleConnection` to detect reaction handle connections.

### 3. FieldRenderer.tsx

**File:** `src/components/flow/FieldRenderer.tsx`

Renders a single metadata field using MUI components:

| Field type | UI control |
|------------|------------|
| Boolean | `Checkbox` |
| Enum (`allowableValues`) | `Select` dropdown |
| Integer/Long/Short | Number `TextField` with step=1 |
| Float/Double | Decimal `TextField` with step=any |
| String | `TextField` |
| Character | Single-char `TextField` (maxLength=1) |
| array / map | Multiline `TextField` (JSON) |

Integrates validation from `FieldUtils.validateFieldValue`.

### 4. DragablePanel.tsx

**File:** `src/components/flow/DragablePanel.tsx`

Draggable, minimizable host panel floating above the React Flow canvas via `<Panel>`. Features:

- Drag-to-move via title bar
- Minimize/expand toggle
- Save button with pulse animation when `saveHighlighted`
- Optional Delete button (red)
- Close button
- Scrollable content area (max-height 500px)

### 5. LowCodeReactionEditor.tsx

**File:** `src/components/flow/lowcode/LowCodeReactionEditor.tsx`

The core metadata-driven form editor. Key behaviors:

- Fetches reaction templates from `/api/lowcode-metadata` on mount
- Template selector (`<Select>`) filters out `hide: true` templates
- Dynamic field rendering via `FieldRenderer` for visible fields
- Restores saved form values from store on open
- Builds `LowCodeReactionFieldVariables` from the selected edge's ecore data
- Connection info displayed as subtitle

Imperative API via `forwardRef`:
- `save()` — writes `fieldValues` to VsumDetails store via `temporarilySaveLowCodeReactionConfig`
- `undo()` — reverts to last saved values
- `delete()` — delegates to `onDeleteRequest` callback
- `isDirty()` — compares current values to last saved

### 6. EdgeValidator.tsx

**File:** `src/components/flow/EdgeValidator.tsx`

Thin shared validator wrapper for use as React Flow's `isValidConnection`. Delegates reaction-handle connections to `LowCodeReactionEdgeValidator`; passes through all non-reaction connections.

---

## Key Decisions

**MUI for Low Code components:** Per Phase 0 decision, the Low Code editor uses MUI (`@mui/material`, `@mui/icons-material`). These are scoped to the Low Code panel and do not affect the rest of the develop UI.

**`forwardRef` imperative API:** The editor exposes `save`/`undo`/`delete`/`isDirty` via ref so `DragablePanel` and parent components can trigger these without prop drilling form state.

**Store-first save, no backend endpoint:** `save()` writes to the VsumDetails Zustand store immediately. Backend persistence happens during VSUM sync (Phase 6).

**Template metadata fetched on mount:** Each time the editor opens, it fetches fresh metadata from `/api/lowcode-metadata`. Values are cached in component state for the duration of the editor session.

---

## Files Created

| File | Content |
|------|---------|
| `src/components/flow/lowcode/GhostNode.tsx` | Invisible routing anchor node |
| `src/components/flow/lowcode/LowCodeReactionEdgeValidator.tsx` | Fine-granular connection validation |
| `src/components/flow/lowcode/LowCodeReactionEditor.tsx` | Metadata-driven form editor |
| `src/components/flow/FieldRenderer.tsx` | Single metadata field renderer |
| `src/components/flow/DragablePanel.tsx` | Draggable/minimizable host panel |
| `src/components/flow/EdgeValidator.tsx` | Shared connection validator wrapper |

## Files Modified

None — Phase 4 is entirely new component files.

---

## Verification Checklist

- [x] `npx tsc --noEmit` produces no new errors in any component file
- [x] No linter errors in any created file
- [x] `GhostNode` is memoized and invisible (opacity: 0)
- [x] `LowCodeReactionEdgeValidator` checks mode, EObject id resolution, and cross-model requirement
- [x] `FieldRenderer` covers all 8 field types from metadata spec
- [x] `DragablePanel` supports drag, minimize, save highlight, and optional delete
- [x] `LowCodeReactionEditor` fetches metadata, renders template selector + dynamic fields, exposes imperative API
- [x] `EdgeValidator` delegates reaction connections without breaking existing UML/coarse validation

---
---

# Phase 5 — Completed

**Date:** 2026-08-12
**Reference:** [README.md](./README.md) § Phase 5 — Wire into FlowCanvas + CanvasPage

---

## What Was Done

Phase 5 wires all Phase 1–4 artifacts into the two main application files (`FlowCanvas.tsx` and `CanvasPage.tsx`), making the Low Code integration functional end-to-end on the frontend.

### FlowCanvas.tsx modifications

#### 1. Node/edge type registration

Registered `ghost` (GhostNode) in `nodeTypes` and `fine-granular-reaction` (reusing `ReactionRelationship` renderer) in `edgeTypes`.

#### 2. Fine-granular connection handling

Modified `guardedOnConnect` to detect reaction-handle connections via `isReactionHandleConnection`. When a reaction connection is made:
- Validates via `validateFineGranularConnection` (mode check, cross-model, EObject id resolution)
- Extracts source/target EObject ids from handles via `getProperEObjectIdFromHandle`
- Resolves model identifiers from node ecore data
- Creates the fine edge via `createFineGranularReactionEdge` (store + UI edge)
- Falls through to normal `onConnect` for non-reaction connections

#### 3. Edge double-click routing

Modified `handleEdgeDoubleClick` to route based on edge type:
- **Fine-granular reaction edges** → select in `useSelectedEdgeStore` + open `DragablePanel` with `LowCodeReactionEditor`
- **Coarse reaction edges** → existing Monaco `ReactionEditorModal` (unchanged)

#### 4. Mode sync + CSS toggle

Added `useEffect` that syncs `addReactionMode` with `useProjectStore.mode`:
- `addReactionMode=true` → `setMode('reactions')` + `enableReactionHandles()` + `enableReactionEdges()`
- `addReactionMode=false` → `setMode('workspace')` + `disableReactionHandles()` + `disableReactionEdges()`

#### 5. Low Code editor panel

Added state: `lowCodeEditorOpen`, `lowCodeEditorRef`, `selectedEdge` (from `useSelectedEdgeStore`).

Renders `DragablePanel` + `LowCodeReactionEditor` when both `lowCodeEditorOpen` and `selectedEdge` are truthy. Panel actions:
- **Close** → clear selected edge + close panel
- **Save** → delegates to editor's imperative `save()`
- **Delete** → removes fine edge from store via `deleteFineGranularReactionEdgeFromVsumDetails`, removes React Flow edge, clears selection
- **Save highlighted** → pulses when edge has no Low Code config yet (`!hasLowCodeReactionConfig`)

Auto-closes when `selectedEdge` is cleared.

### CanvasPage.tsx

**No additional modifications needed.** Phase 2 already added:
- Store initialization (`setActiveId`, `createVsumDetailsStore`) in `loadVsum`
- The existing `addReactionMode` toggle and sidebar button continue to work

Phase 1 already wired:
- `buildWorkspaceSnapshot` includes `fineGranularMetaModelRelationSet`
- `prepareSnapshotForSyncSave` preserves fine sets
- Save path (`handleSaveChanges`) already flows through these functions

### Frontend-only storage (marked for future)

All Low Code reaction data is stored **frontend-only** in the Zustand VsumDetails store. Backend persistence of fine-granular relations is deferred:

- `fineGranularMetaModelRelationSet` is included in `MetaModelRelationRequest` payloads but backend support is not yet confirmed
- `lowCodeReactionRequestBase` form data lives in the store until VSUM sync
- `getLowCodeReactionsMetadata()` API endpoint is wired but may need backend implementation
- **TODO [Future]:** Confirm backend `/api/lowcode-metadata` exists and returns expected shape
- **TODO [Future]:** Confirm VSUM sync accepts `fineGranularMetaModelRelationSet`
- **TODO [Future]:** Confirm whether VSUM details GET returns fine relations or they are client-only until sync

---

## Key Decisions

**Reuse `ReactionRelationship` for fine edges:** The `fine-granular-reaction` edge type reuses the existing `ReactionRelationship` renderer rather than creating a new edge component. This gives fine edges the same visual style as coarse reaction edges.

**Store sync in FlowCanvas, not CanvasPage:** The `addReactionMode → useProjectStore.mode` sync lives in FlowCanvas because that's where the mode has behavioral effect (CSS toggles, connection validation). CanvasPage just toggles the boolean.

**Frontend-only storage:** Per user instruction, all Low Code data is stored in the frontend Zustand store. The save path includes fine-granular data in the request payload, but actual backend persistence is deferred and marked with TODO comments.

---

## Files Modified

| File | Changes |
|------|---------|
| `src/components/flow/FlowCanvas.tsx` | Added 12 imports (GhostNode, LowCode components, stores, utils). Registered `ghost` + `fine-granular-reaction` types. Modified `guardedOnConnect` for fine edge creation. Modified `handleEdgeDoubleClick` for edge type routing (with coarse-file inference). Added mode sync effect. Added Low Code editor panel state + rendering. Added fine-edge hydration from store in `loadDiagramData`. |

## Files Not Modified (already complete from prior phases)

| File | Status |
|------|--------|
| `src/pages/CanvasPage.tsx` | Store init already wired (Phase 2); snapshot already includes fine sets (Phase 1) |

---

## Verification Checklist

- [x] `npx tsc --noEmit` produces no new errors
- [x] No linter errors in modified files
- [x] `ghost` node type registered in `nodeTypes`
- [x] `fine-granular-reaction` edge type registered in `edgeTypes`
- [x] Reaction-handle connections create fine edges (store + UI)
- [x] Fine edge double-click opens Low Code editor; coarse edge double-click opens Monaco
- [x] `addReactionMode` syncs with `useProjectStore.mode` and CSS variables
- [x] `DragablePanel` renders with save/delete/close when fine edge is selected
- [x] Save path includes `fineGranularMetaModelRelationSet` in payloads
- [x] All Low Code data stored frontend-only; backend endpoints marked as TODO
- [x] Fine edges hydrated from store on `loadDiagramData` (item 5)
- [x] Coarse-file inference via `tryInferReactionFileIdForFineGranularReactionEdge` on double-click (item 9)

---

## Next Phase

**Phase 6 — Save / delete / confirm / dirty state**: Store-first save, dirty highlighting, confirm dialogs, orphan cleanup.