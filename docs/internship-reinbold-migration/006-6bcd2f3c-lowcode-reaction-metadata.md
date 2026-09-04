# 006 — `6bcd2f3c` low-code reaction metadata retrieval and dynamic UI draft

| | |
|---|---|
| **Hash** | `6bcd2f3c9b219badfa3e769cbfc54df976eee956` |
| **Category** | Core Low Code feature |

## Functionality introduced

Establishes the metadata → form pipeline:

1. `apiService.getLowCodeReactionsMetadata()` → `GET /api/lowcode-metadata`
2. Types for metadata / fields / response map
3. `FieldRenderer` — renders controls from field metadata
4. Editor consumes metadata instead of hardcoded reaction types

### API

```ts
async getLowCodeReactionsMetadata()
  : Promise<ApiResponse<LowCodeReactionMetadataResponse>> {
  return this.authenticatedRequest(`/api/lowcode-metadata`);
}
```

### Response / metadata shapes

```ts
type LowCodeReactionMetadataResponse = {
  reactionMetadataMap: { [reactionName: string]: LowCodeReactionMetadata };
};

type LowCodeReactionMetadata = {
  name: string | null;
  description: string | null;
  hide: boolean | null;
  fields: LowCodeReactionFieldMetadata[];
};
```

### Field metadata (implement exactly)

```ts
type LowCodeReactionFieldMetadata = {
  name: string;
  type:
    | "String" | "Boolean" | "Integer" | "Long"
    | "Float" | "Double" | "Short" | "Character";
  required: boolean | null;
  array: boolean | null;
  map: boolean | null;
  mapKeyType: string | null;
  mapValueType: string | null;
  allowableValues: string[] | null;
  sizeMin: number | null;
  sizeMax: number | null;
  lengthMin: number | null;
  lengthMax: number | null;
  min: number | null;
  max: number | null;
  decimalMin: string | null;
  decimalMinInclusive: boolean | null;
  decimalMax: string | null;
  decimalMaxInclusive: boolean | null;
  pattern: string | null;
  patternFlags: string[] | null;
  displayName: string | null;
  displayDescription: string | null;
  displayHide: boolean | null;
  displayDefaultStringValue: string | null;
  displayDefaultIntValue: number | null;
  displayDefaultBooleanValue: boolean | null;
  displayDefaultDoubleValue: number | null;
};
```

### FieldRenderer behavior

| Kind | UI |
|------|----|
| Boolean | Checkbox |
| Enum (`allowableValues`) | Select |
| Integer/Long/Short | Number input (+ slider if min/max useful) |
| Float/Double | Decimal number input |
| String | TextField |
| `array` / `map` | JSON textarea (old approach) or structured editor |

Hide fields with `displayHide === true`. Honor `required` in save validation.

## Status on current `develop`

**Completely missing** (types, API method, FieldRenderer, metadata-driven editor).

## Gap

Full metadata pipeline.

## What to implement today

1. Create the four Low Code type files under `src/types/`
2. Add `getLowCodeReactionsMetadata` to `src/services/api.ts` using existing `authenticatedRequest` / `ApiResponse` patterns
3. Create `FieldRenderer.tsx`
4. Create `FieldUtils.ts` predicates + `getFieldDefaultValue` (template evaluation lands fully in [008](./008-81616675-template-variables-node-ids.md))
5. In `LowCodeReactionEditor`: fetch metadata on mount/open; build template `<Select>` from `reactionMetadataMap` (skip `hide`); render `FieldRenderer` per field; keep local form state until save ([009](./009-4ba1d3e0-frontend-saving-mechanism.md))

## Files

| Action | File |
|--------|------|
| Create | `types/LowCodeReaction*.ts` (4 files) |
| Create | `components/flow/FieldRenderer.tsx` |
| Create | `utils/FieldUtils.ts` |
| Modify | `services/api.ts` |
| Modify | `lowcode/LowCodeReactionEditor.tsx` |

## Do not copy

- `.vscode/settings.json` tweaks from this commit
- Old `UmlEdgeDetails.tsx` deletions/changes unrelated to develop’s UML panels
- Assuming metadata is static — always fetch from API (cache in editor state if needed)

## Dependencies

- [005](./005-168b914d-minimal-reaction-editor-overlay.md) editor shell
- Backend `/api/lowcode-metadata`
- [008](./008-81616675-template-variables-node-ids.md) for default string templates
- [016](./016-f5428f08-sonarcloud-issues.md) numeric parsing style (`Number.parseFloat`, `Number.isNaN`)
