# 012 — `ef7c8066` add and remove (fine) reactions to store

| | |
|---|---|
| **Hash** | `ef7c8066b2be2a99b8772b577201f37e37d48180` |
| **Category** | Core feature (fine CRUD) |

## Functionality introduced

Store + UI edge CRUD for fine-granular reactions:

- `FlowFineGranularMetaModelRelationData` + type guard
- Helper APIs on `VsumDetailsHelper` for get/remove fine relations
- `createFineGranularReactionEdge(...)` — creates UI edge **and** pushes `{ id: null, sourceId, targetId }` into store, then `saveToStore()`
- Payload finalized as single object: `lowCodeReactionRequestBase`
- Workspace/API relation requests include `fineGranularMetaModelRelationSet`

Supporting follow-ups to fold in:

- `93a47f5c` — `createExistingFineGranularReactionEdge` when loading
- `322a3f85` — snapshot includes fine set
- `255570a6` — handle recalculation for fine edges

## Status on current `develop`

**Missing.** Coarse-only relations in snapshots:

```ts
// develop today
interface MetaModelRelationRequest {
  sourceId: number;
  targetId: number;
  reactionFileId: number; // 0 sentinel used in several paths
}
```

## Gap

Fine relation lifecycle + sync field.

## What to implement today

1. Create `types/FlowFineGranularMetaModelRelationData.ts` (+ `isFlowFineGranularMetaModelRelationData`)
2. Implement create/remove/load helpers in `FineGranularReactionUtils.ts` and store methods
3. Extend `MetaModelRelationRequest` with optional `fineGranularMetaModelRelationSet`
4. Update `workspaceSnapshotUtils.ts` and `flowCanvasSnapshot.ts` to serialize fine sets from store (prefer store as source of truth; do not only scrape edges)
5. In `FlowCanvas` `onConnect` / guarded connect: if connection uses reaction handles between different models → fine edge path
6. Hydrate existing fine edges after store init (`createExistingFineGranularReactionEdge`)
7. Register edge type `fine-granular-reaction`

### Connection rules

- Source/target must resolve to EObject ids
- Different metamodels only (validator)
- Ensure parent coarse `EditableVsumMetaModelRelation` exists (create if missing) before adding fine child

## Files

| Action | File |
|--------|------|
| Create | `types/FlowFineGranularMetaModelRelationData.ts` |
| Modify | `store/VsumDetails.ts`, `types/EditableVsumDetails.ts` |
| Modify | `services/api.ts` (`MetaModelRelationRequest`) |
| Modify | `workspaceSnapshotUtils.ts`, `flowCanvasSnapshot.ts`, tests |
| Modify | `FlowCanvas.tsx`, `FineGranularReactionUtils.ts`, `ReactionUtils.ts` |

## Do not copy

- Old intermediate template/params payload
- Breaking develop’s `reactionFileId: 0` retry behavior in `vsumSyncSave.ts` without updating tests/contract ([015](./015-de94471f-merge-related-regression.md))

## Dependencies

- [010](./010-890b8d36-move-info-into-store.md), [011](./011-9fdda458-remove-context-favor-zustand.md)
- Ghost nodes + validators ([005](./005-168b914d-minimal-reaction-editor-overlay.md) phase / supporting commits)
- Enables [013](./013-0b478fd9-allow-deleting-reactions.md)
