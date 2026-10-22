# 009 — `4ba1d3e0` add frontend only saving mechanism

| | |
|---|---|
| **Hash** | `4ba1d3e00c9baf83abae08bfdf5ee3ff4db33676` |
| **Category** | Feature (store-first persist) |

## Functionality introduced

Low Code form save writes into the VSUM details store **immediately**, without a dedicated Low Code backend save endpoint:

- `temporarilySaveLowCodeReactionConfig(fieldValues, edge)`
- `hasLowCodeReactionConfig(edge)`
- Editor exposes imperative `save` / `undo` via `forwardRef`
- `DragablePanel` can trigger save
- Dirty state drives Save highlighting (later `814a4978`, `1aab5209`)

### Save algorithm (end-state)

```ts
temporarilySaveLowCodeReactionConfig(fieldValues, edge):
  active = new ActiveVsumDetails()
  sourceModelBackendId = map.get(edge.data.ecore.fromModel)
  targetModelBackendId = map.get(edge.data.ecore.toModel)
  metaModelRelation = active.getMetaModelRelation({ sourceId, targetId })
  fine = relation.fineGranularMetaModelRelationSet.find(
    r => r.sourceId === eObjectSourceId && r.targetId === eObjectTargetId
  )
  fine.lowCodeReactionRequestBase = fieldValues
  active.saveToStore()
```

Backend persistence happens later when the user saves the VSUM / workspace snapshot (see [012](./012-ef7c8066-add-remove-fine-reactions.md) + develop `syncVsumChanges`).

## Status on current `develop`

**Missing.** Develop persists coarse reaction **files** via upload/update APIs; there is no Low Code form→store path.

## Gap

Store-first Low Code save + dirty/undo UX.

## What to implement today

1. Create `utils/LowCodeReactionUtils.ts` with the two functions above (final payload key `lowCodeReactionRequestBase`)
2. Wire `LowCodeReactionEditor` ref API: `save`, `undo` (restore last loaded values), later `delete`
3. `DragablePanel` Save button → `editorRef.current.save()`; highlight when dirty
4. New fine edges without config start dirty (`!hasLowCodeReactionConfig`)
5. Do **not** call a non-existent Low Code save REST endpoint

## Files

| Action | File |
|--------|------|
| Create | `utils/LowCodeReactionUtils.ts` |
| Modify | `lowcode/LowCodeReactionEditor.tsx` |
| Modify | `DragablePanel.tsx` |
| Requires | `ActiveVsumDetails` / store from [010](./010-890b8d36-move-info-into-store.md) |

## Do not copy

- Early template+params field names
- `console.log` debug spam
- Saving by reconstructing state from React Flow edges (explicitly abandoned in [010](./010-890b8d36-move-info-into-store.md))

## Dependencies

- [007](./007-177de990-ecore-info-on-nodes-edges.md), [008](./008-81616675-template-variables-node-ids.md)
- [010](./010-890b8d36-move-info-into-store.md) strongly recommended first or in the same PR slice
- Polish: `814a4978`, `1aab5209`
