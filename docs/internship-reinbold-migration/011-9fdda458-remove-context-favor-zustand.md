# 011 — `9fdda458` remove main context in favor of zustand

| | |
|---|---|
| **Hash** | `9fdda458e834d1d8071fec9b445a70b814d4a2d3` |
| **Category** | Architecture |

## Functionality introduced

On the old branch:

- Deleted `MainContext.tsx`
- Moved `mode`, `reactionFiles`, active id, setters into `useProjectStore`

### Project store shape

```ts
type ProjectStore = {
  activeId: number | null;
  mode: 'workspace' | 'expanded' | 'reactions';
  reactionFiles: Set<ReactionFile>; // { fromModel, toModel, id }
  expandedMetaModels: Set<number> | null;
  setMode: (mode: ProjectStore['mode']) => void;
  setReactionFiles: (files: ProjectStore['reactionFiles']) => void;
  addReactionFile: (file: ReactionFile) => void;
  setActiveId: (id: number | null) => void;
  setExpandedMetaModels: (ids: Set<number> | null) => void;
};
```

`setActiveId` resets mode to `'workspace'` and clears reaction file / expanded sets.

## Status on current `develop`

**Concept missing; AuthContext must stay.**

Develop has:

- `AuthContext` only (authentication)
- `addReactionMode` boolean on `CanvasPage` → `FlowCanvas` (not a three-way mode enum)
- No `MainContext` to delete

## Gap

Need Project store for Low Code mode + reaction file registry. Do **not** remove AuthContext.

## What to implement today

1. Create `src/store/Project.ts` as above
2. On project load: `setActiveId(vsumId)`
3. Sync develop’s `addReactionMode` with `mode`:
   - entering add-reaction / reactions UI → `setMode('reactions')` + enable handles/edges CSS
   - leaving → `setMode('workspace')` (or `'expanded'` when a metamodel is expanded, if you adopt three-way mode)
4. Prefer **one** UX control (existing toolbar / canvas toggle) rather than adding a conflicting second toggle
5. Use `reactionFiles` for inference in [004](./004-6f425dd6-fine-granular-reaction-open-file.md)

## Files

| Action | File |
|--------|------|
| Create | `store/Project.ts` |
| Modify | `pages/CanvasPage.tsx` |
| Modify | `components/flow/FlowCanvas.tsx` |
| Modify | optional toolbar / `CanvasModeToggle`-adjacent UI |

## Do not copy

- Deleting `AuthContext`
- Reintroducing `MainContext`
- Blindly porting old `MainLayout` mode UI if develop already has add-reaction entry points

## Dependencies

- [010](./010-890b8d36-move-info-into-store.md)
- Supporting mode commit `9b30afd8`
- CSS enable/disable helpers from fine utils + `reaction.css`
