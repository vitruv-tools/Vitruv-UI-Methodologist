# 005 — `168b914d` add minimal reaction editor ui overlay draft

| | |
|---|---|
| **Hash** | `168b914d750db19bebb842b97e106a7e4ca1d41c` |
| **Category** | Feature (UI shell; draft) |

## Functionality introduced

First floating reaction editor overlay:

- New `ReactionEditor.tsx` (hardcoded type/direction selects)
- Drag / minimize / close
- React Flow `Panel` positioning
- Added `@mui/icons-material`

Later evolution (do **not** implement the draft as-is):

- Became content inside `DragablePanel`
- Renamed/moved to `lowcode/LowCodeReactionEditor.tsx`
- Hardcoded selects replaced by metadata-driven forms ([006](./006-6bcd2f3c-lowcode-reaction-metadata.md))

## Status on current `develop`

**Missing.** Empty `src/components/flow/lowcode/` folder only. No `DragablePanel`, no Low Code editor overlay.

Develop already has Monaco `ReactionEditorModal` for full-code editing — different product surface.

## Gap

Need the final Low Code panel shell (draggable host + editor host), not the hardcoded draft.

## What to implement today

Implement the **end-state** UI shell (fold in `8aaa829b` DragablePanel behavior):

1. `src/components/flow/DragablePanel.tsx`
   - Draggable, minimizable, closable
   - Props for Save highlight, optional Delete, title
   - Hosts children (the Low Code editor)
2. `src/components/flow/lowcode/LowCodeReactionEditor.tsx`
   - `forwardRef` with imperative `save` / `undo` / `delete`
   - Template select + dynamic fields (wired in [006](./006-6bcd2f3c-lowcode-reaction-metadata.md))
3. Optional: match develop visual language instead of MUI if product prefers consistency (more work). If using MUI, add deps in Phase 0.

Wire visibility in Phase 5: show panel when `useSelectedEdgeStore.selectedEdge` is a fine-granular edge.

## Files

| Action | File |
|--------|------|
| Create | `DragablePanel.tsx` |
| Create | `lowcode/LowCodeReactionEditor.tsx` |
| Modify | `package.json` (MUI/icons if chosen) |
| Modify | `FlowCanvas.tsx` (render panel) |

## Do not copy

- Hardcoded `REACTION_TYPES` / `REACTION_DIRECTIONS` draft
- Old top-level `ReactionEditor.tsx` filename if develop already uses `ReactionEditorModal` for Monaco — keep Low Code under `lowcode/LowCodeReactionEditor.tsx` to avoid confusion
- Treating this draft as the finished editor

## Dependencies

- [006](./006-6bcd2f3c-lowcode-reaction-metadata.md) for real fields
- [010](./010-890b8d36-move-info-into-store.md) `SelectedEdge` store for open/close
- Supporting: DragablePanel from `8aaa829b`
