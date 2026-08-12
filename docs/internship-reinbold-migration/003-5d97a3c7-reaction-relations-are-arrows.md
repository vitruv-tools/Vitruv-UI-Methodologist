# 003 — `5d97a3c7` reaction relations are arrows now

| | |
|---|---|
| **Hash** | `5d97a3c7d9ce48383e2ab24a3ef84239a925ef63` |
| **Category** | Visual enhancement |

## Functionality introduced

Adds SVG `markerEnd` arrowheads on reaction edges in `ReactionRelationship.tsx` (normal + selected variants).

## Status on current `develop`

**Already present.** `ReactionRelationship.tsx` on develop already renders directed reaction edges with arrow styling / selection behavior (later refactors superseded this exact patch).

## Gap

None required for Low Code.

## What to implement today

**Verify only** when adding `fine-granular-reaction` edges:

1. Register fine edges to reuse `ReactionRelationship` (or a thin wrapper)
2. Ensure arrow markers still work when multiple fine edges share metamodel pairs
3. If fine edges need distinct styling, extend via CSS class `react-flow__edge-fine-granular-reaction` (see `reaction.css` in README Phase 4) rather than rewriting arrow logic

## Files to touch (only if verification fails)

- `src/components/flow/ReactionRelationship.tsx`
- `src/components/flow/FlowCanvas.tsx` (`edgeTypes` map)

## Do not copy

The exact old marker ID scheme if develop already has a working one.

## Dependencies

None.
