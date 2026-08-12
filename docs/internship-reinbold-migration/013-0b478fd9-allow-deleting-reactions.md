# 013 — `0b478fd9` allow deleting reactions

| | |
|---|---|
| **Hash** | `0b478fd991514eb45cd8abf1da7645fffd3dedab` |
| **Category** | Feature |

## Functionality introduced

Delete fine-granular reactions from UI and store:

- `DragablePanel` Delete action
- `LowCodeReactionEditor` imperative `delete`
- `deleteFineGranularReactionEdgeFromVsumDetails(edge)`
- Remove React Flow edge + clear `selectedEdge`
- Optional `reactionFileId` on fine edge data for file-aware confirms

End-state refinement in [014](./014-26128814-save-dialog-dragable-panel.md): deleting the last fine child without a reaction file storage id may also remove the parent coarse relation.

## Status on current `develop`

**Missing** for fine relations. Coarse reaction delete exists via Monaco editor delete → `removeEdge` (and related sync). That path must keep working.

## Gap

Fine-edge delete lifecycle + store cleanup.

## What to implement today

1. Implement `deleteFineGranularReactionEdgeFromVsumDetails`
2. Wire panel + editor delete buttons
3. On success: remove edge from `useFlowState`, `setSelectedEdge(null)`, close panel
4. Confirm before delete when a reaction file exists ([014](./014-26128814-save-dialog-dragable-panel.md))
5. Ensure next VSUM sync snapshot no longer contains the deleted fine relation

## Files

| Action | File |
|--------|------|
| Modify | `FineGranularReactionUtils.ts`, `VsumDetails.ts` |
| Modify | `DragablePanel.tsx`, `LowCodeReactionEditor.tsx` |
| Modify | `FlowCanvas.tsx` (keyboard delete / edge remove hooks if applicable) |

## Do not copy

- Deleting coarse Monaco-managed reaction files unintentionally when only a fine mapping is removed — follow end-state orphan rules carefully and confirm with backend
- Removing develop’s existing coarse delete path

## Dependencies

- [012](./012-ef7c8066-add-remove-fine-reactions.md)
- [014](./014-26128814-save-dialog-dragable-panel.md) for confirms
