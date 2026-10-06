# 008 — `81616675` better template variable insertion, better node ids (ecore id based)

| | |
|---|---|
| **Hash** | `816166751de23ee48b9c779fb0514fe6ba6164ee` |
| **Category** | Feature (templates + stable ids) |

## Functionality introduced

1. Prefer **Ecore unique identifiers** as UML/flow node ids (stable across reloads) instead of ephemeral counters
2. `LowCodeReactionFieldVariables` for template defaults
3. `evaluateTemplate` / `evaluateTemplateWithExpressionSupport` in `FieldUtils`
4. `getProperEObjectIdFromHandle` for handle → EObject mapping
5. Skip inappropriate handle recalculation for fine-granular edges where needed

### Variables

```ts
type LowCodeReactionFieldVariables = {
  sourceModelUri: string;
  sourceModelAlias: string;
  sourceUri: string;
  sourceAlias: string;
  targetModelUri: string;
  targetModelAlias: string;
  targetUri: string;
  targetAlias: string;
};
```

Populate these from the selected fine edge’s `data.ecore` + identifier maps when opening the editor / computing field defaults.

## Status on current `develop`

**Missing** Low Code variables + template evaluation.

Node ids for develop UML/expand may still be layout-oriented; Low Code needs stable EObject-based ids for fine edges to round-trip through the store.

## Gap

Template defaults + stable identity for fine relations.

## What to implement today

1. Create `types/LowCodeReactionFieldVariables.ts`
2. Complete `FieldUtils.ts`:
   - `getFieldDefaultValue(field, variables)`
   - `evaluateTemplate`
   - `evaluateTemplateWithExpressionSupport` **or** a safer constrained replacer (preferred)
3. Implement `getProperEObjectIdFromHandle` in `FineGranularReactionUtils.ts` / `EcoreIdentifiers.ts`
4. When creating UML/class nodes used in reaction mode, set ids from Ecore FQ ids where possible
5. In `LowCodeReactionEditor`, build `variables` from selected edge before rendering defaults

### Security

Old code evaluated templates via `new Function` + backtick interpolation. If retained:

- Only evaluate backend-provided metadata strings
- Never evaluate raw user textarea as code
- Prefer allowlisted `{{var}}` substitution if product allows

## Files

| Action | File |
|--------|------|
| Create | `types/LowCodeReactionFieldVariables.ts` |
| Modify | `utils/FieldUtils.ts` |
| Modify | `utils/FineGranularReactionUtils.ts` / `EcoreIdentifiers.ts` |
| Modify | UML node creation path + `LowCodeReactionEditor.tsx` |

## Do not copy

- Replacing develop’s entire UML id scheme globally if it breaks layout persistence — scope stable ids to reaction/expanded nodes that participate in fine edges
- Blind `new Function` without review

## Dependencies

- [006](./006-6bcd2f3c-lowcode-reaction-metadata.md), [007](./007-177de990-ecore-info-on-nodes-edges.md)
- Fix `21b6f7a0` (`/` in identifier separators) must be included in `EcoreIdentifiers`
