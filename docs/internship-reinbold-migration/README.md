# Low Code Integration — Implementation Plan

## Purpose

This folder is a **forward-looking implementation plan** for adding the missing **Low Code reaction integration** to the current codebase.

- **Source of truth for architecture:** latest `develop`
- **Source of truth for required Low Code behavior:** commits on `internship-reinbold` from `6084f5bd` through `f5428f08` (reference only)
- **Do not** merge, cherry-pick, or rebase `internship-reinbold`
- **Do not** treat this doc set as a record of completed work — nothing in this plan has been applied to application source as part of producing these docs

Another developer should be able to implement Low Code from these documents **without inspecting the old branch**.

---

## Branches and Commit Range

| Item | Value |
|------|--------|
| Target / architecture baseline | `develop` (analyzed at `021a4ed2`) |
| Reference branch | `internship-reinbold` (tip `f5428f08`) |
| Range start | `6084f5bde2b71c586d5a48987c78838d88f5689c` — *Add npm and GitHub Actions to Dependabot config* |
| Range end | `f5428f08b9b2da6a4c24758cf88fb5f461846a0c` — *fix: sonarcloud issues* |

The full range contains 200+ commits. Most are unrelated general development. Only Low Code–relevant work is planned here. See [017-excluded-general-commits.md](./017-excluded-general-commits.md).

---

## What “Low Code” Means (Product Scope)

Low Code in this project is **not** the existing Monaco/LSP reaction code editor. Develop already has that.

Low Code adds:

1. **Fine-granular reaction edges** between concrete EObjects (classes/features) across different metamodels, edge type `fine-granular-reaction`
2. A **metadata-driven form editor** (`LowCodeReactionEditor` + `FieldRenderer`) fed by `GET /api/lowcode-metadata`
3. A **frontend store** for editable VSUM graph state (coarse + fine relations + identifier maps), persisted later via existing VSUM sync / workspace snapshot
4. **Reaction mode UX** (handles/edges visibility, ghost nodes, validators) so fine edges can be created while expanded UML is visible
5. **Save / undo / delete / confirm** flows for Low Code form state (store-first; backend sync remains the existing VSUM save path)

---

## Current `develop` Baseline (Already Present)

### Full-code reactions — DONE

| Capability | Current location |
|------------|------------------|
| Reaction edges (`type: 'reactions'`) | `FlowCanvas.tsx`, `flowCanvasEdgeFactory.ts`, `ReactionRelationship.tsx` |
| Create edge + upload skeleton `.reactions` | `FlowCanvas.tsx`, `flowCanvasReactionCode.ts`, `reactionFile.ts` |
| Monaco + LSP editor | `ReactionEditorModal.tsx`, `CodeEditorModal.tsx`, `ReactionsMonarchGrammar.ts` |
| Persist reaction file | `apiService.uploadFile(..., 'REACTION')`, `updateReactionFile`, `getFile` |
| VSUM sync of coarse relations | `MetaModelRelationRequest`, `workspaceSnapshotUtils.ts`, `flowCanvasSnapshot.ts`, `vsumSyncSave.ts` |
| Add-reaction mode | `CanvasPage` / toolbar → `addReactionMode` prop on `FlowCanvas` |
| Arrow-style reaction edges | `ReactionRelationship.tsx` (present; do not re-port early arrow work blindly) |

### Explicitly missing on `develop`

| Area | Status |
|------|--------|
| `src/store/` Zustand modules | Missing (no app Zustand usage; only transitive via reactflow) |
| `src/components/flow/lowcode/*` | Folder exists **empty** |
| `DragablePanel`, `FieldRenderer`, `GhostNode`, `LowCodeReactionEditor`, validators | Missing |
| Fine-granular types / utils | Missing |
| `getLowCodeReactionsMetadata()` / `/api/lowcode-metadata` | Missing |
| `fineGranularMetaModelRelationSet` on sync payload | Missing |
| `reaction.css` handle/edge visibility CSS variables | Missing |
| Direct deps: `zustand`, `ecore-ts`, MUI (`@mui/*`, `@emotion/*`) | Missing from `package.json` |

### Architecture patterns to follow on `develop`

| Concern | Pattern |
|---------|---------|
| Page orchestration | `CanvasPage.tsx` owns project load, toolbar modes, VSUM details fetch |
| Canvas orchestration | Fat `FlowCanvas.tsx` + extracted helpers `flowCanvas*.ts` |
| API | Singleton `apiService` in `src/services/api.ts` |
| Auth state | `AuthContext` only — do not invent a new MainContext |
| Coarse reaction editing | Keep `ReactionEditorModal` / Monaco path |
| UML generation | Keep `ecoreToUml.ts` / `umlGenerator.ts` — **do not** replace with old `UMLFromEcoreTS.ts` |
| Snapshot / save | Extend `workspaceSnapshotUtils.ts`, `flowCanvasSnapshot.ts`, `vsumSyncSave.ts` |
| Cross-tree events | Existing `window` CustomEvents pattern is OK where React Flow isolation requires it |
| Tests | Colocate under `src/__tests__/…` mirroring source |

---

## Gap Summary by Planned Doc

| Doc | Commit | Verdict on `develop` |
|-----|--------|----------------------|
| [001](./001-6084f5bde2-add-dependabot-config.md) | `6084f5bd` Dependabot | **Exclude** — not Low Code |
| [002](./002-866df6ee-added-reaction-code-window.md) | `866df6ee` Reaction code window | **Already superseded** by Monaco editor — no port |
| [003](./003-5d97a3c7-reaction-relations-are-arrows.md) | `5d97a3c7` Arrows | **Already present** — verify only |
| [004](./004-6f425dd6-fine-granular-reaction-open-file.md) | `6f425dd6` Infer coarse file for fine open | **Missing** — implement adapted |
| [005](./005-168b914d-minimal-reaction-editor-overlay.md) | `168b914d` Editor overlay draft | **Missing** — implement final evolved UI, not the draft |
| [006](./006-6bcd2f3c-lowcode-reaction-metadata.md) | `6bcd2f3c` Metadata API + FieldRenderer | **Missing** — core |
| [007](./007-177de990-ecore-info-on-nodes-edges.md) | `177de990` Ecore IDs on graph + store types | **Missing** — foundation |
| [008](./008-81616675-template-variables-node-ids.md) | `81616675` Template vars / ecore node ids | **Missing** |
| [009](./009-4ba1d3e0-frontend-saving-mechanism.md) | `4ba1d3e0` Store-first save | **Missing** |
| [010](./010-890b8d36-move-info-into-store.md) | `890b8d36` Store architecture pivot | **Missing** — architecture |
| [011](./011-9fdda458-remove-context-favor-zustand.md) | `9fdda458` Project store / drop MainContext | **Partial concept** — add Project store; do **not** remove AuthContext |
| [012](./012-ef7c8066-add-remove-fine-reactions.md) | `ef7c8066` Fine CRUD + payload shape | **Missing** |
| [013](./013-0b478fd9-allow-deleting-reactions.md) | `0b478fd9` Delete fine reactions | **Missing** |
| [014](./014-26128814-save-dialog-dragable-panel.md) | `26128814` Confirm save/delete | **Missing** |
| [015](./015-de94471f-merge-related-regression.md) | `de94471f` Normalize reaction file ids | **Adapt** — align with develop’s `0` vs `null` conventions carefully |
| [016](./016-f5428f08-sonarcloud-issues.md) | `f5428f08` Sonar cleanups | **Apply as coding standard** while implementing |
| [017](./017-excluded-general-commits.md) | Supporting + excluded | Prerequisites + out-of-scope list |

---

## Recommended Implementation Phases

Implement in this order. Each phase should leave the app buildable.

### Phase 0 — Dependencies and scaffolding

1. Add direct dependencies: `zustand`, and either:
   - `ecore-ts` (matches old branch `EObject` maps), **or**
   - a local minimal `EObject`-like type if you want to avoid the library (preferred if `ecore-ts` conflicts with current UML pipeline)
2. If keeping MUI-based Low Code UI: add `@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`
   - Alternative (more work, better visual consistency): reimplement Low Code panel/forms with existing develop styling (no MUI)
3. Keep files under `src/components/flow/lowcode/`
4. Add `src/styles/reaction.css` and import from `src/index.tsx`

**Do not copy** old `.vscode/settings.json` or Dependabot changes.

### Phase 1 — Types + API surface

Create:

- `src/types/LowCodeReactionFieldMetadata.ts`
- `src/types/LowCodeReactionMetadata.ts`
- `src/types/LowCodeReactionMetadataResponse.ts`
- `src/types/LowCodeReactionFieldVariables.ts`
- `src/types/EditableVsumDetails.ts`
- `src/types/FineGranularMetaModelRelation.ts`
- `src/types/FlowFineGranularMetaModelRelationData.ts`
- `src/types/FlowMetaModelRelationData.ts` (if still needed after aligning with `flowCanvasTypes` / `edgeTypes`)
- `src/types/EdgeEventHandlers.ts`

Extend:

- `src/services/api.ts`
  - `getLowCodeReactionsMetadata(): Promise<ApiResponse<LowCodeReactionMetadataResponse>>` → `GET /api/lowcode-metadata`
  - `MetaModelRelationRequest.fineGranularMetaModelRelationSet?: EditableFineGranularMetaModelRelation[]`
- `src/types/flow.ts` / `flowCanvasTypes.ts` / `edgeTypes.ts` — additive edge/node data fields only
- `workspaceSnapshotUtils.ts`, `flowCanvasSnapshot.ts` — include fine set when serializing relations

**Canonical persisted Low Code payload field name:** `lowCodeReactionRequestBase` (final end-state of old branch). Do **not** revive earlier `lowCodeReactionTemplate` + `lowCodeReactionTemplateParams` split.

### Phase 2 — Zustand stores

Create `src/store/`:

| File | Role |
|------|------|
| `Project.ts` | `activeId`, `mode: 'workspace' \| 'expanded' \| 'reactions'`, `reactionFiles`, `expandedMetaModels` |
| `VsumDetails.ts` | Per-VSUM store map + `VsumDetailsHelper` CRUD + `saveToStore()` + `getAsWorkspaceSnapshot()` |
| `ActiveVsumDetails.ts` | Helper bound to `useProjectStore.activeId` |
| `SelectedEdge.ts` | Currently selected fine edge for the editor panel |
| Error classes | `NoActiveVsumError`, `NoVsumDetailsStoreError`, `EditableVsumMetaModelRefConversionError` |
| `DeepClone.ts` (utils) | Store-safe cloning (`get()` returns deep clone) |

**Integrate at load time in `CanvasPage.tsx`:**

1. `useProjectStore.getState().setActiveId(vsumId)`
2. Map `apiService.getVsumDetails` → `EditableVsumDetails` (seed `fineGranularMetaModelRelationSet: []` until backend returns them)
3. `createVsumDetailsStore(vsumId, editableDetails)`
4. Build `identifiersToBackendMetaModelId` (and optionally `identifiersToEObject`) when ecore content is available

**Do not** remove `AuthContext`. Old `MainContext` removal does not apply 1:1 — develop never had that Low Code MainContext.

### Phase 3 — Utils (behavior without UI)

Port / rewrite against develop helpers:

| New util | Responsibility |
|----------|----------------|
| `FieldUtils.ts` | Field type predicates, defaults, `evaluateTemplate` / `evaluateTemplateWithExpressionSupport` |
| `LowCodeReactionUtils.ts` | `hasLowCodeReactionConfig`, `temporarilySaveLowCodeReactionConfig` |
| `FineGranularReactionUtils.ts` | create/delete/load fine edges, handle calc, ghost detection, CSS enable/disable helpers, click/delete handlers |
| `ReactionUtils.ts` | Coarse relation helpers that update the store (if not already covered by snapshot code) |
| `EcoreIdentifiers.ts` (new, preferred) | Extract **only** identifier separators / FQ id helpers from old `UMLFromEcoreTS.ts` — do not replace develop UML generation |

**Security note:** old `evaluateTemplateWithExpressionSupport` used `new Function` + template literals. Reimplement carefully; prefer a constrained template substitution if possible. If keeping `new Function`, document the trust boundary (metadata comes from backend).

### Phase 4 — UI components

| Component | Placement | Notes |
|-----------|-----------|-------|
| `GhostNode.tsx` | `flow/lowcode/` | Invisible node for mid-edge reaction handles |
| `LowCodeReactionEdgeValidator.tsx` | `flow/lowcode/` | Only allow cross-model fine connections in reactions mode |
| `LowCodeReactionEditor.tsx` | `flow/lowcode/` | Form editor; imperative `save` / `undo` / `delete` via `forwardRef` |
| `FieldRenderer.tsx` | `flow/` or `flow/lowcode/` | Renders one metadata field (string/bool/number/enum/array/map) |
| `DragablePanel.tsx` | `flow/` | Draggable/minimizable host panel with Save highlight + optional Delete |
| `EdgeValidator.tsx` | `flow/` | Thin shared validator wrapper if still needed |

Also add `src/styles/reaction.css` (CSS variables for handle/edge opacity).

### Phase 5 — Wire into `FlowCanvas` + `CanvasPage`

Minimum integration points on **current** files:

**`FlowCanvas.tsx`**

1. Register `ghost` in `nodeTypes` and `fine-granular-reaction` in `edgeTypes` (reuse `ReactionRelationship` renderer or a thin wrapper)
2. On connect from reaction handles → `createFineGranularReactionEdge(...)` (store + UI edge)
3. On fine edge click → `useSelectedEdgeStore.setSelectedEdge` + open `DragablePanel`
4. On fine edge delete → store removal + UI cleanup
5. On VSUM details / store ready → `createExistingFineGranularReactionEdge` for each stored fine relation
6. Sync `addReactionMode` with `useProjectStore.mode` (`'reactions'` vs `'workspace'`)
7. Call `enableReactionHandles` / `disableReactionHandles` (and edges) when mode changes
8. **Keep** coarse `reactions` double-click → existing `ReactionEditorModal` (Monaco). Fine edges open Low Code panel instead
9. Coarse-file inference for fine edges (commit 004 / `c599c0a6`): resolve `reactionFileId` from parent coarse relation / `reactionFiles` when missing

**`CanvasPage.tsx`**

1. Initialize project + VSUM details stores when a project loads
2. Optional dedicated Reactions/VSUM toggle (old branch used MainLayout mode switch; develop already has add-reaction toolbar — prefer extending that rather than inventing a second competing control)
3. Ensure workspace snapshot / save path includes `fineGranularMetaModelRelationSet`

### Phase 6 — Save / delete / confirm / dirty state

Implement behaviors from commits 009, 013, 014 and supporting fixes:

- Store-first save of `lowCodeReactionRequestBase`
- Dirty highlighting on Save (`setSaveHighlighted`)
- New fine reaction starts dirty if no config yet (`hasLowCodeReactionConfig`)
- Confirm dialogs when a reaction file already exists
- Delete fine relation; if last fine relation and no reaction file storage id, also remove parent coarse relation (old end-state behavior — confirm against current backend contract before copying blindly)
- Normalize reaction file ids consistently with develop (`normalizeReactionFileId` in `workspaceSnapshotUtils.ts` already exists — extend rather than fork)

### Phase 7 — Tests

Add tests mirroring develop style:

- Field utils / template evaluation
- Store CRUD for fine relations + snapshot serialization
- Fine edge factory / existing-edge hydration
- Low Code editor save/delete dirty behavior (component tests)
- API client method for metadata

Do **not** port old-branch tests that target deleted MainLayout/MainContext APIs.

---

## Dependency Graph (What Blocks What)

```text
[Phase 0 deps]
    → [Phase 1 types + API]
        → [Phase 2 stores]
            → [Phase 3 utils]
                → [Phase 4 UI]
                    → [Phase 5 FlowCanvas/CanvasPage wiring]
                        → [Phase 6 save/delete/confirm]
                            → [Phase 7 tests]
```

Supporting reference behaviors (not separate cherry-picks; fold into phases):

| Old commit | Fold into |
|------------|-----------|
| `9b30afd8` mode switch workspace/expanded/reactions | Phase 2 + 5 |
| `f2a2e9b9` / `8d4d69a8` handles + ghost nodes | Phase 4 + 5 |
| `8aaa829b` DragablePanel + extensive ecore info | Phase 3 IDs + Phase 4 panel (**not** full UML rewrite) |
| `9b81e85f` open editor on edge click + typed data | Phase 5 |
| `57504667` create reaction file on coarse edge create | **Already on develop** |
| `322a3f85` fine set in workspace snapshot | Phase 1 + 5 |
| `93a47f5c` render existing fine edges | Phase 5 |
| `255570a6` / `c599c0a6` / `814a4978` / `1aab5209` / `21b6f7a0` | Phase 5–6 polish |

---

## What Must NOT Be Copied From the Old Branch

1. **Entire `UMLFromEcoreTS.ts` UML generation rewrite** — conflicts with `ecoreToUml.ts` / `umlGenerator.ts`
2. **MainContext introduction/removal drama** — develop uses `AuthContext`; add Zustand beside it
3. **German UI copy** from earliest reaction modal commits
4. **localStorage `flow_diagram_state_v1` persistence** from `866df6ee` — develop has its own workspace/snapshot model
5. **Textarea-based `CodeEditorModal`** from `866df6ee` — develop’s Monaco/LSP stack is strictly better; keep it for coarse code editing
6. **Blind `reactionFileId: null` vs `0` flips** without updating `vsumSyncSave` fallback + tests that intentionally retry with `0`
7. **Dependabot / CI / auth / metamodel-import / unrelated UI** commits in the range
8. **Debug `console.log` noise** in old Low Code utils (strip during port)
9. **Old `MainLayout`-centric ownership** — prefer `CanvasPage` + `FlowCanvas` ownership on develop
10. **Early payload shape** (`template` + `params`) — use final `lowCodeReactionRequestBase`

---

## Target File Checklist (Create / Modify)

### Create

```text
src/store/Project.ts
src/store/VsumDetails.ts
src/store/ActiveVsumDetails.ts
src/store/SelectedEdge.ts
src/store/NoActiveVsumError.ts
src/store/NoVsumDetailsStoreError.ts
src/store/EditableVsumMetaModelRefConversionError.ts
src/types/LowCodeReactionFieldMetadata.ts
src/types/LowCodeReactionMetadata.ts
src/types/LowCodeReactionMetadataResponse.ts
src/types/LowCodeReactionFieldVariables.ts
src/types/EditableVsumDetails.ts
src/types/FineGranularMetaModelRelation.ts
src/types/FlowFineGranularMetaModelRelationData.ts
src/types/FlowMetaModelRelationData.ts
src/types/EdgeEventHandlers.ts
src/utils/DeepClone.ts
src/utils/FieldUtils.ts
src/utils/LowCodeReactionUtils.ts
src/utils/FineGranularReactionUtils.ts
src/utils/ReactionUtils.ts
src/utils/EcoreIdentifiers.ts
src/components/flow/lowcode/GhostNode.tsx
src/components/flow/lowcode/LowCodeReactionEditor.tsx
src/components/flow/lowcode/LowCodeReactionEdgeValidator.tsx
src/components/flow/FieldRenderer.tsx
src/components/flow/DragablePanel.tsx
src/components/flow/EdgeValidator.tsx          # only if still required
src/styles/reaction.css
```

### Modify (expected)

```text
package.json / package-lock.json
src/index.tsx                                 # import reaction.css
src/services/api.ts                           # metadata + sync payload
src/types/flow.ts / flowCanvasTypes.ts / edgeTypes.ts
src/types/vsum.ts                             # optional additive fields if API returns fine set
src/types/workspace.ts                        # if snapshot typing needs fine set
src/utils/workspaceSnapshotUtils.ts
src/utils/vsumSyncSave.ts                     # only if retry/normalize rules change
src/components/flow/flowCanvasSnapshot.ts
src/components/flow/FlowCanvas.tsx            # register types, connect/click/delete, panel
src/pages/CanvasPage.tsx                      # store init, mode sync
src/components/flow/EditableNode.tsx          # reaction handles + ecore ids (as needed)
src/components/flow/EcoreFileBox.tsx          # model identity for coarse↔fine mapping
src/components/flow/ReactionRelationship.tsx  # only if fine edge rendering needs tweaks
```

### Leave alone (unless a tiny hook is unavoidable)

```text
ReactionEditorModal.tsx / CodeEditorModal.tsx / ReactionsMonarchGrammar.ts
AuthContext.tsx
ecoreToUml.ts / umlGenerator.ts (except calling new EcoreIdentifiers helpers)
Dependabot / CI configs
```

---

## Canonical Data Shapes (End-State Spec)

### Metadata API

`GET /api/lowcode-metadata` →

```ts
type LowCodeReactionMetadataResponse = {
  reactionMetadataMap: { [reactionName: string]: LowCodeReactionMetadata };
};

type LowCodeReactionMetadata = {
  name: string | null;
  description: string | null;
  hide: boolean | null;
  fields: LowCodeReactionFieldMetadata[];
};
```

Field metadata includes type (`String` | `Boolean` | `Integer` | …), `required`, `array`, `map`, constraints (`min`/`max`/`pattern`/…), and display defaults. Full field shape: see [006](./006-6bcd2f3c-lowcode-reaction-metadata.md).

### Editable fine relation

```ts
type EditableFineGranularMetaModelRelation = {
  id: number | null; // null = new
  sourceId: string;  // EObject FQ id
  targetId: string;  // EObject FQ id
  reactionFileStorageId?: number;
  lowCodeReactionRequestBase?: { [key: string]: unknown };
};
```

### Fine edge React Flow data

```ts
type FlowFineGranularMetaModelRelationData = {
  ecore: {
    eReferenceId?: string;
    eObjectSourceId: string;
    eObjectTargetId: string;
    fromModel: string;
    toModel: string;
  };
  reactionFileId?: number;
};
```

### Sync request extension

```ts
interface MetaModelRelationRequest {
  sourceId: number;
  targetId: number;
  reactionFileId: number; // develop currently uses 0 sentinel — keep unless backend contract changes
  fineGranularMetaModelRelationSet?: EditableFineGranularMetaModelRelation[];
}
```

### Template variables

```ts
type LowCodeReactionFieldVariables = {
  sourceModelUri: string;
  sourceModelAlias: string;
  sourceUri: string;
  sourceAlias: string;
  targetModelUri: string;
  targetModelAlias: string;
  targetUri: string;
  targetAlias: string;
};
```

---

## Backend / Contract Assumptions

Confirm with backend before coding Phase 1–6 end-to-end:

1. `/api/lowcode-metadata` exists and returns the map shape above
2. VSUM sync accepts `fineGranularMetaModelRelationSet`
3. VSUM details GET returns fine relations (or they are only client-authored until first sync round-trip)
4. Whether `reactionFileId` null vs `0` is preferred (develop code + tests currently lean on `0` as “missing” in several paths)

If backend is not ready, still implement store-first UI with feature-flagged sync field.

---

## How to Use This Folder

1. Read this README for the overall plan and phase order
2. Open the per-commit doc for the slice you are implementing
3. Implement against **current develop files** listed there
4. Use old branch only if a doc is ambiguous — then update the doc

Per-commit docs follow a fixed template: functionality, develop gap, implement today, files, do-not-copy, dependencies.
