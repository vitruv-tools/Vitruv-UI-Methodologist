# 014 — `26128814` add save dialog to dragable panel and to reaction editor

| | |
|---|---|
| **Hash** | `2612881422699936806c9bd52435d901e1134aa4` |
| **Category** | Feature (UX + store hardening) |

## Functionality introduced

1. Confirm dialogs for save/delete when a reaction file already exists (`tryInferReactionFiledId…`)
2. Hardening in `VsumDetailsHelper`:
   - Overwrite/replace store state safely
   - Orphan parent cleanup when last fine relation removed and no file storage id
   - Workspace snapshot mapping fixes
3. Save path may set `regenerate: true` inside field values when confirming overwrite of generated content (verify against backend expectations before copying blindly)

## Status on current `develop`

**Missing** Low Code confirms. Develop has other confirm dialogs (unsaved changes, etc.) that can be reused stylistically (`ConfirmDialog` patterns if present).

## Gap

User-facing confirmations + orphan cleanup rules for fine relations.

## What to implement today

1. Add Save/Delete confirmation dialogs to `DragablePanel` / `LowCodeReactionEditor`
2. Gate confirms on inferred/existing `reactionFileId`
3. Implement orphan parent cleanup in store helper — **feature-flag or behind review** until backend contract is confirmed
4. Reuse develop dialog components/styles where possible instead of a one-off MUI dialog if avoiding MUI

## Files

| Action | File |
|--------|------|
| Modify | `LowCodeReactionEditor.tsx`, `DragablePanel.tsx` |
| Modify | `store/VsumDetails.ts` |
| Modify | `FineGranularReactionUtils.ts` (infer id) |

## Do not copy

- Unverified `regenerate: true` semantics without backend confirmation
- Duplicate conflicting confirm systems

## Dependencies

- [009](./009-4ba1d3e0-frontend-saving-mechanism.md), [013](./013-0b478fd9-allow-deleting-reactions.md)
- Inference from [004](./004-6f425dd6-fine-granular-reaction-open-file.md) / `c599c0a6`
- Dirty highlight `814a4978`
