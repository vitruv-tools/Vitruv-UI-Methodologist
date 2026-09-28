# 015 — `de94471f` merge related regression

| | |
|---|---|
| **Hash** | `de94471fd9f2ff1bf4837dfab8ede47f2d99e289` |
| **Category** | Bugfix |

## Functionality introduced

After merges, reaction file ids were incorrectly treated as `0` meaning “present”. Fix:

- Normalize missing ids to `null` / `undefined` in Low Code paths
- Fine `reactionFileStorageId` becomes `undefined` when invalid
- Dirty comparison / save validation no longer treats missing as `0`

Old touchpoint emphasized `VsumTabs.tsx` normalization helpers.

## Status on current `develop`

**Different convention already in place.**

Develop utilities intentionally use `0` in several coarse-reaction paths:

- `MetaModelRelationRequest.reactionFileId: number` with comment “Use 0 when there's no reaction file”
- `vsumSyncSave.ts` retries with `reactionFileId: 0` when files are missing
- `workspaceSnapshotUtils.normalizeReactionFileId` already exists
- Tests assert `0` fallback behavior

## Gap

Not “port null everywhere.” Need a **consistent dual-layer policy**:

| Layer | Policy |
|-------|--------|
| UI / Zustand editable model | Prefer `null` / `undefined` for missing file ids |
| Wire format to current backend sync | May still send `0` until backend accepts null |
| Fine edge optional `reactionFileId` | Optional number; omit when unknown |

## What to implement today

1. Extend develop’s `normalizeReactionFileId` rather than inventing a second helper
2. When mapping API → `EditableVsumDetails`, convert `0` → `null`/`undefined`
3. When mapping store → `MetaModelRelationRequest`, convert missing → `0` **if** backend contract unchanged
4. Update tests if the contract changes
5. Apply same normalization to fine `reactionFileStorageId`

## Files

| Action | File |
|--------|------|
| Modify | `utils/workspaceSnapshotUtils.ts` |
| Modify | `utils/vsumSyncSave.ts` (only if contract changes) |
| Modify | store mapping in `CanvasPage` / `VsumDetailsHelper.getAsWorkspaceSnapshot` |
| Modify | related unit tests |

## Do not copy

- Old `VsumTabs`-only fix without updating develop snapshot/sync utils
- Breaking the existing `0` retry path without coordinated test + backend changes

## Dependencies

- [012](./012-ef7c8066-add-remove-fine-reactions.md) snapshot field
- Any load/save mapping introduced in [010](./010-890b8d36-move-info-into-store.md)
