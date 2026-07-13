# UML Low-Code / Multi-Model Reactions — Persistence Analysis

This document describes what is implemented visually in the expanded UML view (`FloatingUMLPanel`), what is actually persisted to the backend today, and what still needs to be built (frontend integration and/or backend work) to support saving models and reactions across multiple metamodels.

---

## Executive summary

| Area | Visual UI | Persists to backend | Survives reload |
|------|-----------|---------------------|-----------------|
| Primary model UML edits (classes, same-model relationships) | Yes | **Partially** — local/session only for workspace save | Only if saved in-panel and same tab session |
| Additional models in UML sidebar | Yes | **No** | **No** |
| Class-level reaction lines + config popup | Yes | **No** | **No** |
| Reaction Editor (`.reactions` code) in UML | Yes | **Partially** — file upload/update works, but not linked to VSUM | Code file yes (if saved in editor); relation/config **no** |
| Main canvas reactions (FlowCanvas) | Yes | **Yes** — via `sync-changes` | **Yes** |
| LSP (autocomplete, diagnostics) | Yes | Needs separate LSP service | N/A |

**Bottom line:** The visual layer for UML multi-model reactions is largely in place. Persistence is not. The Reaction Editor already calls existing file APIs when you save code, but UML panel state (reactions, added models, config) is not wired into the VSUM workspace save/load model.

---

## What the backend already supports (used by FlowCanvas)

The **main FlowCanvas** already uses these APIs end-to-end.

### 1. VSUM workspace sync

`PUT /api/v1/vsums/{id}/sync-changes` with payload:

```json
{
  "metaModelIds": [1, 2, 3],
  "metaModelRelationRequests": [
    { "sourceId": 1, "targetId": 2, "reactionFileId": 42 }
  ]
}
```

Or `metaModelRelationRequests: null` when there are no relations.

- Loaded from `GET /api/v1/vsums/{id}/details` → `metaModels` + `metaModelsRelation`.
- Frontend: `syncVsumWorkspaceChanges` in `src/utils/vsumSyncSave.ts`.
- Snapshot builder: `buildWorkspaceSnapshotFrom` in `src/components/flow/FlowCanvas.tsx`.
- Dirty detection: `workspaceSnapshotsEqual` in `src/utils/workspaceSnapshotUtils.ts`.

### 2. Reaction file storage

| Operation | API | Frontend |
|-----------|-----|----------|
| Create | `POST /api/upload/type=REACTION` | `apiService.uploadFile` |
| Read | `GET /api/files/{id}` | `apiService.getFile` |
| Update | `POST /api/upload/{id}/update-reaction` | `apiService.updateReactionFile` |

Shared helpers: `src/utils/reactionFile.ts` (`persistReactionCode`, `fetchReactionCode`, `resolveReactionFileId`).

### 3. Ecore file storage

| Operation | API | Frontend |
|-----------|-----|----------|
| Create | `POST /api/upload/type=ECORE` | `apiService.uploadFile` |
| Update | `POST /api/upload/{id}/update-ecore` | `apiService.updateEcoreFile` |

Used by `saveMetaModelEcore` (`src/utils/saveMetaModelEcore.ts`) for **library** saves (`saveTarget: 'library'`), not for workspace UML panel saves.

### 4. LSP (optional)

`CodeEditorModal` connects to WebSocket:

```
/lsp?userId={userId}&vsumId={vsumId}
```

Without LSP, editing still works (Monaco + reactions grammar). Autocomplete and diagnostics require a running language server that understands the VSUM context.

---

## What the UML low-code UI does today

### A. Primary model save (UML panel “Save” button)

In `UMLDiagram`, when `saveTarget === 'workspace'` (configured from `CanvasPage.buildUmlSaveContext`), save does **not** call the API:

```ts
// src/components/canvas/UMLDiagram.tsx — handleSave
saveContext.saveTarget === 'workspace'
  ? {
      ecoreContent: umlToEcore(getModel(), originalEcore),
      ecoreFileId: saveContext.ecoreFileId,
    }
  : await saveMetaModelEcore({ ... });
```

That only updates:

1. Local panel state (`umlPanels` in `CanvasPage`)
2. In-memory FlowCanvas node via `flowCanvasRef.updateEcoreFileData(fileName, content)` — **no** `updateEcoreFile` API call

So **ecore semantic edits are not written to the server** when saving from the UML panel in workspace mode.

Also, `getModel()` only includes the **primary** model:

```ts
const getModel = (): UMLModel => ({
  classes: classesRef.current,
  relationships: relationshipsRef.current,
});
```

Additional models rendered via `additionalModels` are **display-only** for save purposes.

### B. Additional models (“Add Meta Models” sidebar)

`FloatingUMLPanel` keeps `loadedModels` in React state only.

When adding a model:

- Fetches ecore via `fetchEcoreFile` (works — uses existing file API)
- Does **not** add the model to VSUM `metaModelIds`
- Does **not** add an ecore box on FlowCanvas
- Is **not** stored in `CanvasUmlPanelState` / tab session (`src/types/canvasTab.ts`)

Extra models disappear on full reload.

### C. Reaction edges in UML

`reactionEdges` in `UMLDiagram` is pure in-memory state:

- Created on purple-dot drag connect (`addReactionConnection`)
- `ReactionConfig` (aliases, URLs, root types, bidirectional, name) is local only
- Not included in `isDirty()` (only `umlSemanticSnapshot(getModel())` is compared)
- Not included in workspace snapshot
- Not loaded from `metaModelsRelation` on project open

Types: `src/types/reactions.ts` (`ReactionEdge`, `ReactionConfig`).

### D. Reaction Editor in UML (double-click reaction line)

**This part does hit the backend** when you click Save in the editor:

```ts
const reactionFileId = await persistReactionCode(code, reactionEditorState.reactionFileId);
setReactionEdges(prev => prev.map(edge =>
  edge.id === reactionId ? { ...edge, code, reactionFileId } : edge,
));
```

So:

- The `.reactions` **file** can be stored on the server
- The **relation** (`sourceId`, `targetId`, `reactionFileId`) is **never sent** to `sync-changes`
- On reload, you will not see the reaction line or config, even if the file exists on the server

**Compare with FlowCanvas:** on new reaction edge it often uploads a stub file immediately (`uploadReactionFile`) and ties relations into workspace snapshot on main **Save changes**.

Shared UI: `ReactionEditorModal` (`src/components/flow/ReactionEditorModal.tsx`), starter code from `buildInitialReactionCodeFromConfig` (`src/utils/reactionCode.ts`).

### E. Main canvas “Save changes”

`CanvasPage.handleSaveChanges` calls `syncVsumWorkspaceChanges` with snapshot from **FlowCanvas only**:

```ts
const snapshot = flowCanvasRef.current?.getWorkspaceSnapshot() ?? emptyWorkspaceSnapshot();
const payload = prepareSnapshotForSyncSave(snapshot);
await syncVsumWorkspaceChanges(activeProjectId, payload);
```

It knows nothing about:

- UML panel `reactionEdges`
- UML sidebar `loadedModels`
- UML panel ecore edits (unless they were copied into a FlowCanvas node via panel save)

---

## Does the Reaction Editor need backend?

**Partially — and most file APIs already exist.**

| Feature | Needs backend? | Status |
|---------|----------------|--------|
| Open editor, edit text | No | Works offline |
| Syntax highlighting (Monaco grammar) | No | Works |
| Save `.reactions` file | **Yes** | APIs exist; UML editor uses them |
| Reload saved code | **Yes** | `getFile(reactionFileId)` |
| LSP autocomplete/diagnostics | **Yes** | Separate LSP service; needs `vsumId` |
| Link reaction to project | **Yes** | `sync-changes` relation entry — **not wired from UML** |
| Class-level config (aliases, root types) | **Depends** | Not in current `MetaModelRelation` DTO |

**Practical answer:** You can use the editor without new backend endpoints for file CRUD, but you cannot have a complete workflow until you:

1. Link `reactionFileId` into VSUM relations via `sync-changes`, and
2. Decide where class-level `ReactionConfig` is stored (in the `.reactions` file and/or extended relation DTO).

---

## Schema mismatch to resolve

### Current backend relation (metamodel-level)

```ts
// src/services/api.ts
interface MetaModelRelationRequest {
  sourceId: number;   // library metamodel sourceId
  targetId: number;
  reactionFileId: number;  // 0 when no file
}
```

Loaded as `VsumMetaModelRelation` in `src/types/vsum.ts` (`sourceId`, `targetId`, `reactionFileId`, optional `reactionFileStorageId`).

### UML feature (class-level)

```ts
// src/types/reactions.ts
interface ReactionEdge {
  id: string;
  sourceModelId: number;
  sourceClassId: string;
  sourceClassName: string;
  targetModelId: number;
  targetClassId: string;
  targetClassName: string;
  config: ReactionConfig;
  code?: string;
  reactionFileId?: number;
}
```

### Design questions

1. **One relation per model pair** (current FlowCanvas style) vs **many relations per model pair** (multiple class pairs A→B, A→C, etc.)
2. **Where does `ReactionConfig` live?**
   - **Option A (simplest):** encode in `.reactions` file; backend only stores `sourceId`, `targetId`, `reactionFileId`
   - **Option B:** extend backend relation entity with class IDs + config JSON
3. **ID mapping:** backend uses `sourceId` = library metamodel `sourceId` (`VsumMetaModelRef.sourceId`), not drawer id or VSUM instance id. UML `ReactionEdge.sourceModelId` must map to the correct library `sourceId` before `sync-changes`.

`prepareSnapshotForSyncSave` also filters relations: both `sourceId` and `targetId` must appear in `metaModelIds`, or the relation is dropped on save.

---

## Full implementation checklist

### Phase 1 — Make “save model after editing” actually persist

**Frontend**

1. **Workspace ecore persistence** — When UML panel saves (`saveTarget: 'workspace'`), call `apiService.updateEcoreFile(ecoreFileId, file)` (same pattern as `overwriteEcoreInPlace` in `saveMetaModelEcore.ts`), not only `updateEcoreFileData`.
2. **Dirty tracking** — Extend `isDirty()` to include reaction edges and loaded additional models, or show a separate “unsaved reactions” state.
3. **Optional: save additional model ecores** — If users can edit classes in added models, each model needs its own save path (`ecoreFileId` per `ReactionsModel`).

**Backend**

- Confirm `update-ecore` works for VSUM-linked ecore file IDs (likely already supported).
- No new endpoint required if in-place update is supported.

**Key files**

- `src/components/canvas/UMLDiagram.tsx` — `handleSave`, `isDirty`, `getModel`
- `src/pages/CanvasPage.tsx` — `handleUmlPanelSaved`, `buildUmlSaveContext`
- `src/utils/saveMetaModelEcore.ts` — reference implementation for ecore API calls

---

### Phase 2 — Persist multi-model membership

When the user adds models in the UML sidebar, those models must end up in VSUM `metaModelIds` on save.

**Frontend**

1. On add/remove model in `FloatingUMLPanel`, track the intended workspace model set.
2. On project save, merge FlowCanvas `metaModelIds` with UML `loadedModels` source IDs.
3. Either add ecore nodes on FlowCanvas when adding to UML, or extend the snapshot builder to include models only referenced in the UML panel.

**Backend**

- `sync-changes` already accepts `metaModelIds` — verify backend allows adding/removing models from a VSUM this way.

**Key files**

- `src/components/canvas/FloatingUMLPanel.tsx` — `loadedModels`, `handleAddModel`
- `src/components/flow/FlowCanvas.tsx` — `buildWorkspaceSnapshotFrom`
- `src/utils/workspaceSnapshotUtils.ts` — `prepareSnapshotForSyncSave`

---

### Phase 3 — Persist reactions from UML canvas

**Frontend**

1. **Export UML reactions → `MetaModelRelationRequest[]`**

   Map each `ReactionEdge` to:

   ```ts
   {
     sourceId: edge.sourceModelId,  // must be library sourceId
     targetId: edge.targetModelId,
     reactionFileId: edge.reactionFileId ?? 0,
   }
   ```

2. **Merge into workspace snapshot** on main “Save changes” (or add a dedicated “Save project” action on the UML panel).
3. **Upload reaction file on connect** (optional, matches FlowCanvas): create stub `.reactions` when edge is created, not only when the editor is saved.
4. **Load path on open** — When UML panel opens in Reactions mode:
   - Read `details.metaModelsRelation`
   - Reconstruct `ReactionEdge[]` (at least at model-pair level)
   - Class-level detail may require parsing `.reactions` or new backend fields
5. **Persist `ReactionConfig`** — Either embed in `.reactions` and parse on load, or extend the relation DTO.

**Backend**

- Confirm whether **multiple relations with the same `sourceId`/`targetId`** are allowed.
- If not, extend schema (e.g. `sourceClass`, `targetClass`, `configJson`, or a dedicated low-code reactions resource).
- Confirm `reactionFileId: 0` behavior when files are missing (`vsumSyncSave` retries with `0` on “reaction files not found”).

**Key files**

- `src/components/canvas/UMLDiagram.tsx` — `reactionEdges`, `openReactionEditor`, `handleSaveReactionCode`
- `src/types/reactions.ts`
- `src/utils/reactionFile.ts`, `src/utils/reactionCode.ts`
- `src/pages/CanvasPage.tsx` — `handleSaveChanges`, `loadVsum` / `hydrateCanvasWorkspace`

---

### Phase 4 — Reaction Editor completeness

**Already works (if file APIs are up):**

- Create / update / fetch `.reactions` files via `persistReactionCode` / `fetchReactionCode`

**Still needed for full experience:**

1. Link file to relation in `sync-changes` (`reactionFileId` on the relation row).
2. LSP server aware of VSUM models (`vsumId` query param).
3. Keep `ReactionConfig` and `.reactions` file content in sync when the user edits the config popup after writing code.

**Key files**

- `src/components/flow/ReactionEditorModal.tsx`
- `src/components/flow/CodeEditorModal.tsx`
- `src/components/flow/FlowCanvas.tsx` — reference for full save/load loop

---

### Phase 5 — Session/tab persistence (frontend-only interim)

Extend `CanvasUmlPanelState` (`src/types/canvasTab.ts`) to store:

- `loadedModels`
- `reactionEdges`
- `reactionsMode`

So tab switching does not lose work before server persistence is complete. This does **not** replace backend persistence.

---

## Recommended order of work

1. **Fix workspace ecore save** — primary model edits call `update-ecore` on the server.
2. **Wire UML `reactionEdges` → `sync-changes`** — minimal: model-pair + `reactionFileId`.
3. **Wire added models → `metaModelIds`** on save.
4. **Load relations into UML** on panel open.
5. **Decide class-level reaction schema** with backend (one file per class-pair vs extended relation DTO).
6. **LSP** — only if autocomplete beyond syntax highlighting is required.

---

## Reference: key files

| File | Role |
|------|------|
| `src/components/canvas/UMLDiagram.tsx` | UML canvas, `reactionEdges`, save, reaction editor |
| `src/components/canvas/FloatingUMLPanel.tsx` | Reactions/VSUM toggle, multi-model sidebar |
| `src/components/canvas/ReactionConfigPopup.tsx` | Reaction metadata form |
| `src/components/flow/FlowCanvas.tsx` | Main canvas, workspace snapshot, reaction edges (persisted path) |
| `src/components/flow/ReactionEditorModal.tsx` | Shared Reaction Editor shell |
| `src/components/flow/CodeEditorModal.tsx` | Monaco + LSP |
| `src/pages/CanvasPage.tsx` | VSUM load/save, UML panel orchestration |
| `src/types/reactions.ts` | `ReactionEdge`, `ReactionConfig` |
| `src/types/vsum.ts` | `VsumMetaModelRelation`, `VsumDetails` |
| `src/types/workspace.ts` | `WorkspaceSnapshot` |
| `src/utils/reactionFile.ts` | Reaction file fetch/persist |
| `src/utils/reactionCode.ts` | Starter `.reactions` from config |
| `src/utils/vsumSyncSave.ts` | `sync-changes` with retry |
| `src/utils/workspaceSnapshotUtils.ts` | Snapshot compare, load mapping |
| `src/services/api.ts` | API client |

---

## Comparison: FlowCanvas vs UML panel (persistence)

| Step | FlowCanvas | UML panel (current) |
|------|------------|---------------------|
| Create reaction edge | Adds edge to `edges`; may upload stub file | Adds to `reactionEdges` + visual `relationships`; no upload |
| Edit reaction code | `ReactionEditorModal` → `persistReactionCode` | Same |
| Save project | `getWorkspaceSnapshot` → `sync-changes` | Not connected |
| Load project | `vitruv.loadMetaModelRelations` event | Not connected |
| Add second model | Ecore node on canvas → in `metaModelIds` | Sidebar state only |
| Save primary ecore | Via library save or in-memory node update | In-memory only (`workspace` target) |

---

*Generated from implementation review of the low-code multi-metamodel reactions feature in the expanded UML view.*
