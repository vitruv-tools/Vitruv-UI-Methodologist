# 002 — `866df6ee` added reaction code window

| | |
|---|---|
| **Hash** | `866df6eeabdac9e673b193ec6b88ad46ab159330` |
| **Category** | Early reaction editing (superseded) |

## Functionality introduced

First reaction-editing UX on the old branch:

- Double-click reaction edge → modal editor
- Save code onto edge `data.code`
- Delete relation
- `updateEdgeCode` in `useFlowState`
- localStorage diagram persistence (`flow_diagram_state_v1`)
- Plain textarea UI (German copy)

Files created/touched then: `CodeEditorModal.tsx`, `FlowCanvas.tsx`, `UMLRelationship.tsx`, `useFlowState.ts`.

## Status on current `develop`

**Present and strictly better.** Develop already has:

- `ReactionEditorModal.tsx` → `CodeEditorModal.tsx` with Monaco + LSP
- `ReactionsMonarchGrammar.ts`
- `flowCanvasReactionCode.ts` skeleton generation
- `utils/reactionFile.ts` fetch/persist
- Edge double-click / toolbar open paths in `FlowCanvas.tsx`
- Workspace snapshot persistence (not the old localStorage key)

## Gap

No Low Code–specific gap. This commit is the ancestor of **full-code** editing, not the form-based Low Code editor.

## What to implement today

**Do not port this commit.**

When wiring Low Code later:

- Keep Monaco path for **coarse** `reactions` edges
- Route **fine-granular** edges to `LowCodeReactionEditor` instead
- Do not revive textarea modal or `flow_diagram_state_v1`

## Do not copy

- Textarea-based editor
- German UI strings
- localStorage diagram dump from this commit
- Any regression of Monaco/LSP

## Dependencies

None for Low Code. Coarse reaction editing is a prerequisite that develop already satisfies.
