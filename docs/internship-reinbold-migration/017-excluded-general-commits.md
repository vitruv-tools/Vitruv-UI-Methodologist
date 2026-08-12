# 017 — Supporting commits and excluded general work

This document covers (1) Low Code **supporting** commits that are not in the numbered 001–016 feature docs but must be folded into the plan, and (2) the large set of **excluded** non–Low Code commits inside `6084f5bd^..f5428f08`.

---

## A. Supporting commits to fold into implementation

Do **not** cherry-pick these. Implement their behavior inside the phases in [README.md](./README.md).

| Hash | Message / role | Fold into |
|------|----------------|-----------|
| `f2a2e9b9` | Prettier reaction handles + edge validator ideas | Phase 4–5 handles/CSS/validator |
| `9b30afd8` | Switch workspace / expanded / **reactions** modes | Phase 2 Project store + Phase 5 CanvasPage |
| `8aaa829b` | `DragablePanel`, richer ecore info via ecore-ts | Phase 0/3/4 — **panel yes**, full UML rewrite **no** |
| `8d4d69a8` | Ghost nodes + incomplete-edge handles | Phase 4 `GhostNode` + Phase 5 |
| `9b81e85f` | Open editor on edge click; typed node/edge data | Phase 5 click → SelectedEdge / panel |
| `57504667` | Create reaction file on coarse edge creation | **Already on develop** — verify only |
| `322a3f85` | Fine relations in workspace snapshot | Phase 1 + 5 snapshot/sync |
| `93a47f5c` | Render existing fine edges from store | Phase 5 hydration |
| `255570a6` | Recalc handles for fine-granular edges | Phase 5 polish |
| `c599c0a6` | Fine edge double-click infers reaction file id | Phase 5–6 + [004](./004-6f425dd6-fine-granular-reaction-open-file.md) |
| `814a4978` | Dirty → highlight Save on panel | Phase 6 |
| `1aab5209` | New Low Code reaction starts dirty | Phase 6 |
| `21b6f7a0` | Include `/` in ecore identifier separators | `EcoreIdentifiers` in Phase 3 |
| `f2e715df` | Re-enable reaction edges when returning to workspace | Phase 5 mode/CSS toggles |
| `0bd53eeb` | Alias generation in reactions | Only if Low Code aliases still require it |
| Casing renames `77b2da53` / `0fbd6555` | `FineGranularReactionUtils` etc. | Use develop naming conventions from day one |

### Suggested CSS (`reaction.css`)

```css
.react-flow .react-flow__handle.reaction-handle[data-handleid^="reaction"][data-handleid*="source"] {
  pointer-events: var(--reaction-handle-pointer-events-source, none);
  opacity: var(--reaction-handle-opacity-source, 0);
}
.react-flow .react-flow__handle.reaction-handle[data-handleid^="reaction"][data-handleid*="target"] {
  pointer-events: var(--reaction-handle-pointer-events-target, none);
  opacity: var(--reaction-handle-opacity-target, 0);
}
.react-flow__edge.react-flow__edge-fine-granular-reaction {
  opacity: var(--reaction-edge-opacity, 0);
}
```

Helpers `enableReactionHandles` / `disableReactionHandles` / edge variants set these CSS variables on `:root` or the flow pane.

---

## B. Excluded general development (~180+ commits)

### Why excluded

They are not Low Code product scope, and/or develop already has independent implementations. Cherry-picking them would fight the current architecture.

### Categories

| Category | Examples | Reason |
|----------|----------|--------|
| Dependabot / CI | `6084f5bd`, Actions bumps | Develop CI is source of truth |
| Meta model management | CreateModelModal uploads, URL import, genmodel fixes | Develop evolved separately |
| Auth / password / OTP | Verification flows, password score | Develop AuthContext stack |
| Unrelated UI/UX | VSUM ellipse overlay, view types, many canvas polish commits | Develop canvas already diverged |
| Deployment / env URLs | nginx, hardcoded URL flips | Develop env config |
| Tests for old trees | Tests targeting MainLayout/MainContext APIs | Wrong architecture |
| Merge commits | PR merges into internship-reinbold | Not portable work units |
| Style-only noise on non-Low Code files | Random refactors | Out of scope |

### Explicit exclude list (infrastructure head)

- `6084f5bd` — Dependabot (also documented as [001](./001-6084f5bde2-add-dependabot-config.md))
- All Dependabot Action version bumps in-range
- All `Merge pull request #…` / `Merge remote-tracking branch…` commits

Individual markdown files were **not** created for excluded commits; this section is the inventory.

---

## C. Reminder

`develop` is the implementation target. `internship-reinbold` is a **behavior reference** only. If a supporting commit’s detail is needed during implementation, extract the specific function/type into the relevant Phase doc rather than widening scope to general commits.
