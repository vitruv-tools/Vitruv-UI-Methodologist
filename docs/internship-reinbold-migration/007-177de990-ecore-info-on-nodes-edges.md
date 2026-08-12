# 007 — `177de990` ensure sufficient ecore information is attached to nodes and edges

| | |
|---|---|
| **Hash** | `177de990cebb0d1ebb23abcdaca0fb5bc1f1343d` |
| **Category** | Foundation (data model + store seed) |

## Functionality introduced

Attaches rich Ecore identity to graph elements and introduces editable VSUM types/store seeds so fine-granular reactions can point at concrete EObjects.

Key concepts:

- Node/edge payloads carry EObject ids, attribute/reference/operation id lists, model identity
- `EditableVsumDetails` + fine-granular relation types
- Zustand `VsumDetails` store beginnings + identifier maps:
  - `identifiersToEObject?: Map<string, EObject>`
  - `identifiersToBackendMetaModelId?: Map<string, number>`
- Helpers to read/write relations and maps

### Canonical editable shapes

```ts
type EditableVsumMetaModelRelation = {
  id: number | null;
  sourceId: number;
  targetId: number;
  reactionFileStorageId?: number | null;
  fineGranularMetaModelRelationSet: EditableFineGranularMetaModelRelation[];
};

type EditableFineGranularMetaModelRelation = {
  id: number | null;
  sourceId: string; // EObject FQ id
  targetId: string;
  reactionFileStorageId?: number;
  lowCodeReactionRequestBase?: { [key: string]: unknown }; // final name; see 012
};

type EditableVsumDetails = EditableVsum & {
  metaModels: EditableVsumMetaModelRef[];
  metaModelsRelation?: EditableVsumMetaModelRelation[];
  identifiersToEObject?: Map<string, EObject>;
  identifiersToBackendMetaModelId?: Map<string, number>;
};
```

## Status on current `develop`

**Mostly missing.**

Develop has:

- `VsumDetails` / `VsumMetaModelRelation` **interfaces** (API DTOs) without fine set
- UML expand via `EditableNode` + `UMLViewerModal` / canvas expand — **not** fine-reaction graph wiring
- Custom ecore parsing (`ecoreParser`, `ecoreToUml`) — **not** `ecore-ts` maps

Develop does **not** have `src/store/`, `EditableVsumDetails`, or EObject id maps on flow nodes for Low Code.

## Gap

Need additive graph identity + editable VSUM model without replacing develop UML generation.

## What to implement today

1. Create `src/types/EditableVsumDetails.ts` and `FineGranularMetaModelRelation.ts`
2. Extend flow node/edge typing **additively** (`FlowNodeECoreData`-like fields on existing node data, or parallel optional `data.ecore` used by Low Code)
3. When expanding / rendering UML class nodes for reaction mode, ensure each connectable handle can resolve to an EObject FQ id (`getProperEObjectIdFromHandle` lives with [008](./008-81616675-template-variables-node-ids.md))
4. Seed `identifiersToBackendMetaModelId` from loaded metamodels (nsURI / model key → backend numeric id)
5. Extract identifier separator helpers into `src/utils/EcoreIdentifiers.ts` (include `/` package separator from fix `21b6f7a0`)
6. Start `VsumDetails` store types/helpers (completed in [010](./010-890b8d36-move-info-into-store.md))

**Critical adaptation:** Do **not** replace `ecoreToUml.ts` / `umlGenerator.ts` with old `UMLFromEcoreTS.ts`. Only port identity helpers and attach ids where develop’s expand/UML nodes are produced.

## Files

| Action | File |
|--------|------|
| Create | `types/EditableVsumDetails.ts` |
| Create | `types/FineGranularMetaModelRelation.ts` |
| Create | `types/FlowMetaModelRelationData.ts` (if needed) |
| Create | `utils/EcoreIdentifiers.ts` |
| Modify | `types/flow.ts`, `EditableNode.tsx`, `EcoreFileBox.tsx` |
| Modify | UML/expand path that creates class nodes (`FlowCanvas` / UML helpers) |
| Create/Modify | `store/VsumDetails.ts` (foundation) |

## Do not copy

- Full `UMLFromEcoreTS.ts` rewrite
- Forcing `ecore-ts` into the entire UML pipeline if a local type suffices
- Old `MainLayout` / `VsumTabs` ownership — use `CanvasPage` + snapshot utils on develop

## Dependencies

- Supporting ecore identity work (`8aaa829b`) conceptually
- Ghost/handles (`8d4d69a8`, `f2a2e9b9`) for usable fine connections
- Continues in [008](./008-81616675-template-variables-node-ids.md), [010](./010-890b8d36-move-info-into-store.md)
