# Phase 0 — Completed

**Date:** 2026-08-12
**Reference:** [README.md](./README.md) § Phase 0 — Dependencies and scaffolding

---

## What Was Done

Phase 0 establishes the dependency and file scaffolding required by all subsequent Low Code implementation phases. No application logic was added — only the foundation for Phases 1–7.

### 1. Direct dependencies added to `package.json`


| Package               | Version    | Purpose                                                                                                               |
| --------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------- |
| `zustand`             | `^5.0.5`   | Lightweight state management for Low Code stores (`Project`, `VsumDetails`, `SelectedEdge`, etc.)                     |
| `ecore-ts`            | `^0.14.0`  | TypeScript Ecore meta-model library; provides `EObject` type for identifier maps and fine-granular reaction edge data |
| `@mui/material`       | `^7.3.7`   | Material UI component library for the Low Code form editor UI                                                         |
| `@mui/icons-material` | `^7.3.7`   | Material UI icon set used by `DragablePanel` and `LowCodeReactionEditor`                                              |
| `@emotion/react`      | `^11.14.0` | CSS-in-JS runtime required by MUI v7                                                                                  |
| `@emotion/styled`     | `^11.14.0` | Styled component API required by MUI v7                                                                               |


**Decision:** `ecore-ts` **vs custom type** — We chose to keep `ecore-ts` rather than define a local `EObject`-like type. Rationale:

- The package is already installed without conflict (the current UML pipeline in `ecoreToUml.ts` / `umlGenerator.ts` does custom XML parsing and never imports `ecore-ts`; the two approaches are independent)
- Usage is limited to store files (`EditableVsumDetails.ts`, `VsumDetails.ts`) — easy to swap later if needed
- Provides future-proofing for deeper Ecore model manipulation

**Decision: MUI vs re-implementing** — We chose to keep the MUI-based Low Code UI. Rationale:

- The old branch's Low Code editor (`LowCodeReactionEditor`, `FieldRenderer`, `DragablePanel`) was built with MUI
- Re-implementing all form fields, icons, and panel chrome in raw React inline styles would be high effort for no user-visible benefit
- MUI is scoped to Low Code components only and does not affect the rest of the develop UI



### 2. CSS variable stylesheet created

**File:** `src/styles/reaction.css`

Contains CSS custom property rules that control the visibility of fine-granular reaction handles and edges on the React Flow canvas. Default state is hidden (`pointer-events: none; opacity: 0`). When the user enters reactions mode, `FineGranularReactionUtils.ts` toggles these variables to make handles and edges interactive.

Handles are scoped by:

- Position: `left` / `right`
- Type: `source` / `target`
- ID prefix: `reaction`

Edges are scoped by the `fine-granular-reaction` edge type class.

### 3. CSS import wired into application entry point

**File:** `src/index.tsx`

Added `import './styles/reaction.css'` so the variable-based visibility rules are loaded at application startup. Placed between `global.css` and `index.css` imports.

### 4. Low Code component directory verified

**Directory:** `src/components/flow/lowcode/`

The directory exists and is empty, ready for Phase 4 component implementations:

- `GhostNode.tsx` — invisible node for mid-edge reaction handles
- `LowCodeReactionEdgeValidator.tsx` — cross-model connection validator
- `LowCodeReactionEditor.tsx` — metadata-driven form editor

Supporting components at `src/components/flow/` level (also Phase 4):

- `DragablePanel.tsx` — draggable/minimizable host panel
- `FieldRenderer.tsx` — renders one metadata field
- `EdgeValidator.tsx` — shared validator wrapper

---



## How It Was Done

1. Edited `package.json` to add the 6 new dependencies in the `dependencies` block
2. Ran `npm install` — all packages resolved successfully (added 6 packages)
3. Created `src/styles/reaction.css` with CSS custom property rules for handle/edge visibility
4. Added `import './styles/reaction.css'` to `src/index.tsx`
5. Verified `src/components/flow/lowcode/` directory exists (empty, as expected for Phase 0)
6. Ran `npx tsc --noEmit` — no new TypeScript errors introduced (pre-existing test errors in `__tests__/` are unrelated)
7. Verified all 6 dependency modules resolve correctly:
  - `zustand` — CommonJS + ESM, resolves OK
  - `@mui/material` — resolves OK
  - `@mui/icons-material` — resolves OK
  - `@emotion/react` — resolves OK
  - `@emotion/styled` — resolves OK
  - `ecore-ts` — ESM-only package (no `main` field, only `module: dist/ecore-ts.js`); type declarations at `dist/main.d.ts` resolve correctly for TypeScript; CRA/webpack handles ESM at bundle time

---



## What Was NOT Done (Intentionally)

Per the README's "Do not copy" list:

- **No** `.vscode/settings.json` **changes** copied from old branch
- **No Dependabot configuration** changes
- **No application logic** added — Phase 0 is scaffolding only
- **No store, type, util, or component files** created — those belong to Phases 1–4
- **No modifications to** `FlowCanvas.tsx` **or** `CanvasPage.tsx` — those belong to Phase 5

---



## Files Modified


| File                | Change                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `package.json`      | Added 6 dependencies: `zustand`, `ecore-ts`, `@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled` |
| `package-lock.json` | Auto-updated by `npm install`                                                                                            |
| `src/index.tsx`     | Added `import './styles/reaction.css'`                                                                                   |




## Files Created


| File                                              | Content                                                       |
| ------------------------------------------------- | ------------------------------------------------------------- |
| `src/styles/reaction.css`                         | CSS custom property rules for reaction handle/edge visibility |
| `docs/internship-reinbold-migration/Completed.md` | This document                                                 |


---



## Verification Checklist

- [x] `npm install` succeeds with no errors
- [x] `npx tsc --noEmit` produces no new errors (only pre-existing test errors)
- [x] All 6 new packages resolve at runtime
- [x] `ecore-ts` type declarations (`dist/main.d.ts`) are present and include `EObject` class export
- [x] `reaction.css` is imported and will be loaded at app startup
- [x] `src/components/flow/lowcode/` directory exists for Phase 4

---



## Next Phase

**Phase 1 — Types + API surface**: Create Low Code type definitions (`LowCodeReactionFieldMetadata`, `EditableVsumDetails`, etc.) and extend `src/services/api.ts` with the metadata endpoint.