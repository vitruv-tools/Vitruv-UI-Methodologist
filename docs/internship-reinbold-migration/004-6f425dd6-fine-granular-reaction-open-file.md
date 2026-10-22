# 004 — `6f425dd6` Fine-granular reaction should open coarse-granular reaction file

| | |
|---|---|
| **Hash** | `6f425dd6977cdd4f0f5d5c305215e6f5d89affd0` |
| **Category** | Feature (coarse↔fine linkage) |

## Functionality introduced

When opening an editor from a context that lacks `reactionFileId` on the edge:

- Lift/accumulate `reactionFiles: Set<{ fromModel, toModel, id }>`
- Infer the coarse reaction file by matching metamodel pair (`fromModel` / `toModel`)
- Pass inferred id into the editor open path

Old wiring lived in `MainLayout.tsx` + `FlowCanvas.tsx`. Later refined by `c599c0a6` (infer on fine edge double-click from store).

## Status on current `develop`

**Missing** as a dedicated fine-granular flow. Develop:

- Stores `reactionFileId` on coarse reaction edges
- Opens Monaco via that id
- Has **no** fine-granular edges and **no** `reactionFiles` registry / inference helper

## Gap

Need inference so fine-granular UI can locate the parent coarse `.reactions` file when the fine edge payload omits `reactionFileId`.

## What to implement today

1. Add `ReactionFile` type + storage on `useProjectStore` (`reactionFiles`, `addReactionFile`, `setReactionFiles`) — see [011](./011-9fdda458-remove-context-favor-zustand.md)
2. When coarse relations load / coarse edges are created, register `{ fromModel, toModel, id }`
3. Implement `tryInferReactionFiledIdForFineGranularReactionEdge(edge)` (keep old name or rename typo → `…FileId…`) in `FineGranularReactionUtils.ts`:
   - Prefer `edge.data.reactionFileId`
   - Else look up parent coarse relation in `ActiveVsumDetails` / `reactionFiles` by model pair
4. Use inference when:
   - Opening Low Code confirm dialogs that care about existing files ([014](./014-26128814-save-dialog-dragable-panel.md))
   - Any path that still opens coarse file content from a fine edge

**Ownership on develop:** `CanvasPage` / `FlowCanvas` / `useFlowCanvasEvents` — **not** old `MainLayout`.

## Files to create/modify

| Action | File |
|--------|------|
| Create | `src/store/Project.ts` (or extend once store exists) |
| Create | helper in `src/utils/FineGranularReactionUtils.ts` |
| Modify | `FlowCanvas.tsx` / `useFlowCanvasEvents.ts` when registering loaded relations |
| Modify | `CanvasPage.tsx` if reaction file registry should reset on project switch |

## Do not copy

- Old `MainLayout` prop-drilling of `reactionFiles`
- Opening Monaco for every fine edge by default — Low Code panel is the fine-edge editor; inference is for file identity / confirms

## Dependencies

- Phase 2 Project store
- Fine edge data shape from [007](./007-177de990-ecore-info-on-nodes-edges.md) / [012](./012-ef7c8066-add-remove-fine-reactions.md)
- Supporting fix `c599c0a6` behavior should be included here or in Phase 6
