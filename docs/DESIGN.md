# Vitruvius Modeler — Design Guide

## Overview

Vitruvius is an **academic meta-model management tool** built at KIT. The UI has two distinct design modes that live inside one application shell, and understanding both is essential.

**App Shell** (Homepage, Model Library, Projects, Sidebar) follows a modern, clean SaaS aesthetic: dark navy sidebar, white/light-gray main area, a single teal brand accent, and compact readable tables. Think "professional tool for engineers" — not flashy, not generic.

**Diagram Canvas / UML Editor** uses a deliberately different, academic aesthetic inspired by the [jjodel](https://github.com/jjodell/jjodel) project: crisp navy borders, very low corner rounding (3px), monospace fonts for attributes, and minimal decoration. The visual language signals "engineering diagram", not "web app widget".

**Key characteristics:**
- Single teal brand accent `{colors.primary}` (#049484) carries all interactive signals in the app shell — links, focus rings, active states, CTA buttons. Nothing else is interactive-colored.
- A separate, authoritative dark-navy `{colors.cta-dark}` (#0B1720) is used for page-level "create / upload" buttons — so the primary CTA doesn't compete with the teal accent.
- On the dark sidebar a brighter sibling teal `{colors.accent-on-dark}` (#4ecdc4) is used for active-item icons and the role label — Action Blue would disappear against `#0B1720`.
- SVG stroke icons everywhere — no filled icons, no emoji in interactive surfaces.
- `Georgia, serif` appears **only** in `ConfirmDialog` to signal formal importance; all other text is sans-serif.
- UML nodes are intentionally **sharp** (3px radius) — softening them breaks the academic diagram feel.

---

## Colors

### Brand & Accent

| Token | Hex | Use |
|---|---|---|
| `{colors.primary}` | #049484 | The single interactive accent: focus rings, active filter borders, table pagination active, toolbar CTA. |
| `{colors.primary-dark}` | #037368 | Pressed/darker state of primary. Forms the gradient endpoint: `linear-gradient(135deg, #049484, #037368)`. |
| `{colors.primary-bg}` | #f0faf8 | Tinted background when an element is in an active/filtered state (e.g. filter button). |
| `{colors.cta-dark}` | #0B1720 | Page-level "create / upload" buttons (the authoritative dark tone that doesn't compete with teal). Hover lightens to `#1e293b`. |
| `{colors.accent-on-dark}` | #4ecdc4 | Active nav icon, role label, open chevron — used exclusively on `{colors.sidebar}` where `{colors.primary}` would be invisible. |
| `{colors.auth-primary}` | #06b5a0 → #05a896 | Auth-only. Gradient text + button on the glassmorphic login card. Never used in the in-app shell. |

### Surface

| Token | Hex | Use |
|---|---|---|
| `{colors.canvas}` | #ffffff | Cards, panels, modals, table bodies — the dominant app surface. |
| `{colors.canvas-muted}` | #f8fafc | Input backgrounds, table header rows, near-white alternating surfaces. |
| `{colors.canvas-subtle}` | #fafafa | Table row hover, dropdown option hover, very subtle fill. |
| `{colors.app-bg}` | #f7f8fa | Root app container background (fills behind the sidebar + main area). |
| `{colors.flow-bg}` | #f1f2f4 | The diagram canvas background — used with a dot-grid overlay (see Layout). |
| `{colors.sidebar}` | #0B1720 | Dark sidebar. The deepest surface in the hierarchy. |
| `{colors.sidebar-menu}` | #131e2b | Context menu that pops out of the sidebar — one step lighter than `{colors.sidebar}`. |
| `{colors.auth-glass}` | rgba(40, 40, 40, 0.65) | Auth card background: translucent dark with `backdrop-filter: blur(25px)`. Exclusive to auth. |

### Text

| Token | Hex | Use |
|---|---|---|
| `{colors.ink}` | #111827 / #0f172a | Page titles, table name cells, modal main headings. The darkest readable text. |
| `{colors.body}` | #374151 | Default body, form labels, dropdown options, description text. |
| `{colors.muted}` | #6b7280 | Secondary metadata: dates, column icons, table muted cells. |
| `{colors.subtle}` | #9ca3af / #94a3b8 | Empty states, placeholder hints, loading text. |
| `{colors.on-dark}` | #ffffff | All text on `{colors.sidebar}` or gradient header. |
| `{colors.on-dark-secondary}` | rgba(255, 255, 255, 0.55) | Inactive nav text in the sidebar. |
| `{colors.on-dark-muted}` | rgba(255, 255, 255, 0.35–0.45) | Sub-labels (email, role) in the sidebar user card. |
| `{colors.uml-navy}` | #0c436e | UML node header text and attribute text — specific to the diagram editor. |
| `{colors.uml-attr}` | #1e3a50 | Monospace attribute/method list items inside UML nodes. |

### Semantic

| Token | Hex | Use |
|---|---|---|
| `{colors.error}` | #dc2626 | Error text, danger button, validation fail state. |
| `{colors.error-bg}` | #fef2f2 | Error message container background. |
| `{colors.error-border}` | #fecaca | Error box border. |
| `{colors.error-alt}` | #ef4444 | UML delete button, slightly brighter danger red. |
| `{colors.success}` | #10b981 / #15803d | Success text, validation pass state. |
| `{colors.success-bg}` | #f0fdf4 | Success message container background. |
| `{colors.success-border}` | #86efac | Success box border. |
| `{colors.warning-orange}` | #f97316 | "Warning" urgency state (7 days left). |
| `{colors.warning-yellow}` | #eab308 | "Caution" urgency state (14 days left). |
| `{colors.critical}` | #ef4444 | "Critical" urgency state (3 days left), same as `colors.error-alt`. |

### UML Element-Type Accents
These are exclusively used as color-coded prefixes inside diagram nodes.

| Constant | Hex | Element type |
|---|---|---|
| `NAVY` | #0c436e | Class header text |
| `TEAL` (UML) | #087E8B | Class type-label |
| `ABSTRACT` | #9B2335 | Abstract class type-label |
| `INTERFACE_BLUE` | #1a6ea6 | Interface type-label |
| `GOLD` | #d4a017 | Enumeration type-label |
| `MAROON` | #5F0F40 | Package header |

### Borders & Dividers

| Token | Value | Use |
|---|---|---|
| `{colors.border}` | #e5e7eb | Standard border for inputs, cards, table containers. |
| `{colors.border-soft}` | #e2e8f0 | Slightly softer — used in modals, detail panels. |
| `{colors.border-subtle}` | #f1f5f9 / #f3f4f6 | Very light internal dividers inside cards. |
| `{colors.border-on-dark}` | rgba(255, 255, 255, 0.06–0.10) | Sidebar internal hairlines (logo area, user card top, nav dividers). |
| `{colors.uml-separator}` | #b8d0e2 | Divider between attribute/method sections inside UML nodes. |

---

## Typography

### Font Families

- **UI / Body** (everywhere except canvas and dialogs): `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif`
- **Mono** (UML node attributes, code editor): `'Consolas', 'Courier New', monospace`
- **Serif** (ConfirmDialog only): `Georgia, serif` — signals formal, irreversible actions

### Hierarchy

| Token | Size | Weight | Tracking | Use |
|---|---|---|---|---|
| `{typography.page-title}` | 26px | 700 | -0.02em | Main page headings ("Model Library", "Dashboard") |
| `{typography.modal-title}` | 26px | 700 | -0.5px | Modal and dialog headings |
| `{typography.section-head}` | 18–20px | 600–700 | 0 | Node header names, section headings |
| `{typography.app-title}` | 16–18px | 600–700 | -0.01em | Sidebar wordmark, in-header app title |
| `{typography.body-strong}` | 14px | 600–700 | 0 | Form labels, table name cells, emphasized copy |
| `{typography.body}` | 13–14px | 400–500 | 0 | Default body, table data, dropdown items |
| `{typography.caption}` | 12–13px | 400–600 | 0–0.04em | Metadata, dates, table column headers (uppercase) |
| `{typography.label}` | 11px | 700 | 0.01em | Form section labels, detail field labels |
| `{typography.micro}` | 10–11px | 400–500 | 0 | Sidebar sub-labels (user email, role) |
| `{typography.uml-body}` | 16px | 400 | 0 | UML attribute / method list items (monospace) |
| `{typography.uml-header}` | 18px | 700 | 0.1px | UML node class name |

### Principles

- **Weight ladder is 400 / 500 / 600 / 700.** There is no 300 and no 800 anywhere in the application.
- **Table column headers** use `12px / 600 / uppercase / letter-spacing: 0.04em` — this is the standard "data table" pattern and must be consistent across all tables.
- **Monospace font** (`Consolas`) is used only inside UML nodes for attributes, methods, and enum values. It signals "code / structured data", not "UI label".
- **`Georgia, serif`** is confined to `ConfirmDialog`. If you add a new confirmation-style modal, inherit this font. For all other modals and panels, use the UI font stack.
- **13px is the standard body size** in the app shell. 14px is used for slightly more prominent reads (table name cells, primary form labels). 16px is reserved for headings and node labels.

---

## Layout

### Spacing System (8px base)

| Token | Value | Use |
|---|---|---|
| `{spacing.xxs}` | 4px | Icon-to-label gaps in tight rows |
| `{spacing.xs}` | 6–8px | Nav item internal gap, button padding y, list item gap |
| `{spacing.sm}` | 10–12px | Nav item padding, filter chip padding, toast padding |
| `{spacing.md}` | 14–16px | Form group spacing, card inner spacing |
| `{spacing.lg}` | 20–24px | Section dividers, card padding |
| `{spacing.xl}` | 32px | Page content padding (top) |
| `{spacing.page}` | 40px | Page horizontal padding (`padding: 32px 40px`) |

### Fixed Structural Dimensions

| Element | Size |
|---|---|
| **Header** | 48px tall, `position: absolute` top-pinned |
| **AppSidebar (dark)** | 220px wide, 100vh |
| **ToolsPanel / old Sidebar** | 350px wide |
| **Modal (large)** | `min(800px, 92vw)` × `min(640px, 88vh)` |
| **Modal (small / confirm)** | 480px max-width |
| **Auth card** | 480px max-width |

### Canvas Dot Grid
The UML diagram canvas uses this exact CSS pattern — do not remove or change it:
```css
background-color: #f1f2f4;
background-image: radial-gradient(circle, #b0b7c3 1px, transparent 1px);
background-size: 20px 20px;
```

### Z-Index Stack

| Layer | Value | What lives here |
|---|---|---|
| Base | 0 | App content, canvas |
| Sidebar overlay | 10 | Sidebar internal absolute elements |
| Sidebar user menu | 100 | Context menu popup above user card |
| App header | 1000 | `<header>` pinned to top |
| Modals & overlays | 1000–9999 | Standard modals (1000), toasts (2000), confirm (9999) |
| Change-password modal | 10000 | Nested above the profile dropdown |

---

## Elevation & Depth

| Level | Token | CSS Value | Use |
|---|---|---|---|
| Flat | — | No shadow | Sidebar, table header cells, full-width bars |
| Hairline | `{shadow.xs}` | `0 1px 4px rgba(0,0,0,0.04)` | Table container, UML diagram preview card |
| Subtle | `{shadow.sm}` | `0 2px 8px rgba(0,0,0,0.08)` | Cards, React Flow controls, avatar button |
| Elevated | `{shadow.md}` | `0 8px 24px rgba(0,0,0,0.12)` | Dropdown menus, sidebar user menu popup |
| Tinted (header) | `{shadow.header}` | `0 2px 8px rgba(4,148,132,0.25)` | App header — uses brand color |
| Modal | `{shadow.modal}` | `0 24px 64px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.10)` | Full modals, large dialogs |
| Auth | `{shadow.auth}` | `0 25px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.2)` | Auth card on the full-bleed dark background |
| UML selected | `{shadow.uml-focus}` | `0 0 0 3px rgba(8,126,139,0.2), 0 2px 8px rgba(12,67,110,0.18)` | Selected UML node glow |

**Shadow philosophy:** Shadows float surfaces above their context — they should never be applied to inline text, labels, or borders. UML nodes have a shadow *only when selected*. Buttons never get shadows unless they are the primary CTA on an overlay (form submit, danger confirm).

---

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.none}` | 0px | Full-bleed containers, canvas |
| `{rounded.uml}` | 3px | UML node boxes — *do not increase this*; the sharpness is the aesthetic |
| `{rounded.micro}` | 4–6px | Small controls inside UML nodes, confirm-dialog buttons, row action button |
| `{rounded.sm}` | 7–8px | Standard buttons, text inputs, filter chips, table pagination buttons, toast |
| `{rounded.md}` | 9–10px | Dropdown menus, sidebar user popup, `ConfirmDialog` container |
| `{rounded.lg}` | 12px | Table container, large cards, auth form inputs and buttons |
| `{rounded.xl}` | 16–20px | Auth card itself (`20px`) |
| `{rounded.pill}` | 9999px / 50% | Avatar circles, keyword / status badge pills |

---

## Components

### AppSidebar

Dark `{colors.sidebar}` (#0B1720), 220px fixed width, full viewport height. The only purely dark surface in the application.

- **Logo area** (`padding: 20px 16px 16px`, bottom hairline `rgba(255,255,255,0.06)`): 32px `border-radius: 8px` logo image + "Vitruvius" in white 700/18px with `-0.01em` tracking.
- **Nav items** (`{component.nav-item}`): full-width buttons, `padding: 9px 12px`, `border-radius: 8px`. Active state: `rgba(4,148,132,0.15)` fill, white text weight 600, icon in `{colors.accent-on-dark}` (#4ecdc4). Inactive: `rgba(255,255,255,0.55)` text weight 400.
- **Background image** overlay: `opacity: 0.80`, `pointer-events: none`, `aria-hidden`. Purely atmospheric — don't remove it, don't interact with it.
- **User card** (bottom): 36px avatar circle with `linear-gradient(135deg, #049484, #06b89e)`, truncated name (13px/600/white) + role (11px/muted). Click opens upward context menu.
- **User context menu**: `{colors.sidebar-menu}` bg, `border-radius: 10px`, upward positioning. Uses `{component.menu-item}` and `{component.menu-divider}` (1px `rgba(255,255,255,0.08)` line).

### Header

`linear-gradient(135deg, #049484, #037368)`, height 48px, `position: absolute` — sits above all content with `z-index: 1000`.

- Left: app title 16px/600/white.
- Right: circular user avatar (white bg, `{colors.border}` ring; on hover ring shifts to `{colors.muted}` and shadow lifts).
- Avatar click opens profile dropdown (300px wide, white bg, `border: 1px solid #e8e8e8`, 8px radius, `slideDown 0.2s` animation). Dropdown contains: user info section (`#f8f9fa` bg, 20px padding) + action buttons.

### Standard Modal

- **Backdrop**: `rgba(0,0,0,0.45)` with `backdropFilter: blur(3px)`. Clicking the backdrop closes the modal.
- **Container**: white, `min(800px, 92vw)` × `min(640px, 88vh)`, `border-radius: 10px`, `{shadow.modal}`.
- **Header strip**: white bg, `1px solid {colors.border-subtle}` bottom, `padding: 14px 20px`. Contains icon + title (16px/700/`{colors.ink}`) on left; Edit + Close buttons on right.
- **Body**: Two-column layout for detail views — `~280px` left panel (scrollable metadata/form) + `flex: 1` right panel (preview/content). Separated by `1px solid {colors.border-subtle}`.
- **Close button** (`{component.button-icon-sm}`): 30×30px, `border-radius: 6px`, no border, `{colors.subtle}` icon; hover adds `#f1f5f9` bg and darkens icon.

### ConfirmDialog

- **Backdrop**: `rgba(0,0,0,0.45)` with `backdropFilter: blur(8px)` — *stronger blur than a standard modal* to focus attention.
- **Container**: white, `480px` max, `border-radius: 10px`, `{shadow.modal}`, `font-family: Georgia, serif`.
- **Variant**: `danger` (red title + red confirm button) or `success` (green title + green confirm button). Danger is the default.
- **Buttons**: Cancel (`{component.button-cancel}`) + Confirm (`background: {colors.error}` or success, shadow tinted to match color).

### Auth Card

Exclusive to `/login` and `/verify-otp`. Do not replicate this style elsewhere.

- Full-page centered, `background: rgba(40,40,40,0.65)`, `backdrop-filter: blur(25px)`, `border-radius: 20px`.
- Animated gradient bar at top: 5px, `linear-gradient(90deg, #06b5a0, #05a896)` with `gradientShift` keyframe.
- Inputs: `background: rgba(255,255,255,0.95)`, `border: 2px solid rgba(255,255,255,0.4)`, `border-radius: 12px`. Focus: `border-color: #06b5a0`, ring `0 0 0 4px rgba(6,181,160,0.3)`, `transform: translateY(-1px)`.
- Primary button: `linear-gradient(135deg, #047a6e, #058478)`, `border-radius: 12px`, hover lifts `translateY(-3px)`.
- Headline uses gradient-clip text technique: `-webkit-background-clip: text`, `-webkit-text-fill-color: transparent`.

### Tables (ModelLibraryTable / ProjectsView)

- **Container**: white bg, `border-radius: 12px`, `1px solid {colors.border}`, `{shadow.xs}`.
- **Column headers**: `background: #fafafa`, `padding: 12px 16px`, 12px/600/uppercase/`letter-spacing: 0.04em`/`{colors.muted}`.
- **Rows**: `padding: 13px 16px`, `1px solid #f9fafb` bottom border. Hover: `background: #fafafa`, `cursor: pointer`. Primary text cell (`name`): 14px/500/`{colors.ink}`. Secondary cells: 14px/`{colors.muted}`.
- **RowActionsMenu** (`{component.button-row-actions}`): Dots button `padding: 4px 8px`, `border-radius: 6px`, `1px solid {colors.border}`. Dropdown: `border-radius: 10px`, `{shadow.md}`, `minWidth: 140px`. Danger row: `{colors.error}` text, hover `#fef2f2` bg.
- **Pagination**: `{component.page-btn}` — `border-radius: 7px`, active state `background: {colors.primary}` + white text.

### Buttons

**`{component.button-cta-dark}`** — Page-level "create" or "upload" action. `background: {colors.cta-dark}` (#0B1720), white text, `border-radius: 9px`, 14px/600, `padding: 9px 18px`. Shadow: `0 1px 4px rgba(11,23,32,0.25)`. Hover: slightly lightens. Use for: "Upload model", "New project", "Add member".

**`{component.button-primary-teal}`** — Form-submit and modal confirm. `linear-gradient(135deg, #049484, #037368)`, white text, `border-radius: 8px`, 14px/700, `padding: 12px 28px`. Shadow: `0 2px 8px rgba(4,148,132,0.25)`. Hover: `translateY(-1px)`. Use for: Change Password submit, modal save actions.

**`{component.button-cancel}`** — Secondary/cancel in a pair. White bg, `2px solid {colors.border}`, `{colors.body}` text, `border-radius: 8px`, 14px/600.

**`{component.button-danger}`** — Destructive confirm. `background: {colors.error}` (#dc2626), white text, `border-radius: 6px`, 14px/600. Shadow: `0 4px 12px rgba(220,38,38,0.3)`. Hover: lift `translateY(-1px)` + darker shadow.

**`{component.button-filter}`** — Toolbar filter pills. `padding: 7px 12px`, `border-radius: 8px`, default `1px solid {colors.border}` / white bg. Active (filtered): `border-color: {colors.primary}`, `background: {colors.primary-bg}`, `color: {colors.primary}`.

**`{component.button-nav-item}`** — AppSidebar nav. Full-width, no border, transparent → active fill `rgba(4,148,132,0.15)`. See AppSidebar section.

**`{component.button-icon-sm}`** — 30×30px icon button. No border, no bg; hover adds `#f1f5f9` bg. Used in modal headers (Edit, Close).

### Input Fields

Standard pattern across all forms inside the app shell:
```
border: 1.5–2px solid {colors.border-soft}   /* #e2e8f0 */
border-radius: 8px
padding: 9–12px 12–14px
font-size: 13–14px
background: #f8fafc   /* or #ffffff */
color: {colors.ink}
transition: border-color 0.15s
```
Focus state:
```
border-color: {colors.primary}   /* #049484 */
box-shadow: 0 0 0 3px rgba(4, 148, 132, 0.1)
```

Auth inputs use 12px radius, stronger focus ring (`0 0 0 4px`), and a `translateY(-1px)` lift on focus.

### UML Nodes (jjodel-inspired)

These live exclusively on the diagram canvas. The style is **academic and crisp** — resist making them look like app-shell cards.

**Base container** (`{component.uml-node}`):
- `min-width: 380px`, `background: #ffffff`
- `border: 1.5px solid {colors.uml-navy}` (#0c436e)
- `border-radius: 3px` — *never increase this*
- Default shadow: `0 1px 4px rgba(12,67,110,0.10)`
- Selected: `border: 2px solid {TEAL}` + glow ring `{shadow.uml-focus}`

**Node header**: `border-bottom: 2px solid {colors.uml-navy}`, `padding: 13px 18px`, 18px/700, navy text.

**Type label prefix** (e.g. "Class:", "Interface:"): 15px/600, `opacity: 0.65`, colored by element type (see UML Element-Type Accents table above).

**Italic style**: Abstract classes and interfaces use `font-style: italic` on the header.

**Attribute / Method lists**: `font-family: {font.mono}`, 16px, `padding: 6px 18px`. Section divided by `1px solid {colors.uml-separator}`.

**Package**: Maroon theme (`{colors.uml-maroon}` = #5F0F40), `background: #f9f4f7`, bold package name centered.

**Delete button**: `{component.uml-delete-btn}` — 22px red circle (`{colors.error-alt}`), absolute at `top: -8px; right: -8px`, only visible when node is selected. Hover: `scale(1.1)`.

**Connection handles**: 8px dots, `background: {colors.uml-navy}`, `border: 1.5px solid #fff`. Hidden by default (CSS controlled via `.react-flow__handle { opacity: 0 }`); revealed on node hover.

### Toast / Notification System

Fixed `top: 16px; right: 16px`, stacked with `gap: 8px`.

- Container: `min-width: 280px; max-width: 420px`, `border-radius: 8px`, `{shadow.elevated}`.
- Text: 13px/500/`{colors.ink}`.
- **Success**: `background: #f0fff4`, `border: 1px solid #c6f6d5`.
- **Error**: `background: #fff5f5`, `border: 1px solid #feb2b2`.
- **Info**: `background: #ebf8ff`, `border: 1px solid #bee3f8`.
- Close button: `×`, `{colors.muted}` color, 14px, no bg.
- Auto-dismisses after 3000ms by default.

### Dropdown Menus

All context menus and filter dropdowns share this base:
```
background: #ffffff
border: 1px solid {colors.border}
border-radius: 10px
box-shadow: {shadow.md}   /* 0 8px 24px rgba(0,0,0,0.12) */
overflow: hidden
```
Items: `padding: 9px 14px`, 13px, left-aligned. Hover: `background: #f9fafb`. Selected: `background: {colors.primary-bg}`, `color: {colors.primary}`. Danger item: `color: {colors.error}`, hover `background: #fef2f2`.

Divider inside menus: `height: 1px`, `background: #f3f4f6`, `margin: 2px 0`.

### Domain Badge Pills (Keyword tags)

Used on model cards and in the detail modal to show keywords / domains. Each pill picks a color pair from `D_THEMES`:

| Domain key | Badge bg | Badge text |
|---|---|---|
| `default` | #e0e7ff | #4338ca |
| `computer` | #dbeafe | #1d4ed8 |
| `target` | #d1fae5 | #065f46 |
| `modell` / `model` | #ede9fe | #5b21b6 |
| `teal` | #ccfbf1 | #0f766e |
| *(unknown — hash)* | Cycling set of 4 fallback pairs | — |

Pill shape: `padding: 3px 10px`, `border-radius: 20px`, 11px/600.

### React Flow Controls & Minimap

Positioned to the left of the canvas, offset for the 350px ToolsPanel:
```css
.react-flow__controls {
  position: fixed !important;
  left: calc(350px + 16px) !important;
  bottom: 16px !important;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
```
Minimap: `border-radius: 8px`, same shadow, positioned by React Flow's default (bottom-right of canvas).

---

## Animations & Transitions

| Name | Definition | Use |
|---|---|---|
| `fadeIn` | `opacity: 0 → 1` | Modal overlay entrance |
| `slideDown` | `opacity + translateY(-8px → 0)` | Dropdown menus, header user dropdown |
| `spin` | `rotate(0 → 360deg), 1s linear infinite` | Loading spinners inside modals / table |
| `gradientShift` | `background-position 0% → 100% → 0%, 3s ease infinite` | Auth card top gradient bar |

**Transition defaults:**
- Interactive controls: `transition: all 0.15s ease` (nav items, filter buttons, row hovers)
- Buttons with transform (hover lift): `transition: all 0.2s ease`
- Input focus ring: `transition: border-color 0.15s`

---

## Responsive Behavior

The application is primarily a **desktop tool**. Responsive support is minimal and defensive, not a first-class concern.

| Breakpoint | Key changes |
|---|---|
| ≤ 768px | `.sidebar-responsive` max-width 280px; `.header-responsive` padding shrinks to 12px; h1 drops to 16px |
| ≤ 640px | Auth card: form grid collapses to 1-column, paddings tighten |
| ≤ 480px | `.sidebar-responsive` goes full-width; header padding 8px; h1 14px |

The UML canvas / diagram editor has no explicit responsive breakpoints — it is intended for large-screen use.

---

## Icon System

All icons are **inline SVG with stroke**, no filled icons. Standard attributes:
```
width/height: 14–18px (context-dependent)
viewBox: "0 0 24 24"
fill: none
stroke: currentColor
strokeWidth: 2
strokeLinecap: round
strokeLinejoin: round
```
Icon size conventions:
- 14px: pagination chevrons, small metadata icons
- 15px: search icon in toolbar
- 16px: dots menu icon, row action icon
- 18px: nav item icons in AppSidebar
- 28px: modal header decorative icon (the boxed Vitruvius hexagon SVG)
- 40px: empty-state folder icon

---

## Do's and Don'ts

### Do
- Use `{colors.primary}` (#049484) as the *only* interactive signal in the app shell: focus rings, active states, filter highlights. Reserve `{colors.cta-dark}` for the page-level "create" CTA.
- Use `{colors.accent-on-dark}` (#4ecdc4) for active states inside the dark sidebar — never use `{colors.primary}` directly on `{colors.sidebar}`.
- Use `Georgia, serif` in `ConfirmDialog`. If you build a new destructive-action modal, inherit this font.
- Keep UML node `border-radius: 3px` — the sharpness is deliberate.
- Apply `translateY(-1px)` hover lift only to elevated buttons (teal gradient primary, danger confirm) — not to utility or inline buttons.
- Keep the dot-grid canvas CSS exactly as-is (`radial-gradient(circle, #b0b7c3 1px, transparent 1px)`, `20px 20px`).
- Use stroke SVG icons at `strokeWidth: 2`, `strokeLinecap: round` — match existing icons precisely.
- Use `{font.mono}` (Consolas/Courier New) only for UML node attribute/method lists and the code editor. Nowhere else.
- Follow the weight ladder: 400 → 500 → 600 → 700. Especially: form labels are 600–700, NOT 500.
- Match the standard focus style: `border-color: #049484` + `box-shadow: 0 0 0 3px rgba(4,148,132,0.1)` — this is the universal "focused input" signal.

### Don't
- Don't use the auth glassmorphic style (`rgba(40,40,40,0.65)` + heavy blur) anywhere inside the app shell — it's exclusive to login/verify pages.
- Don't use `{colors.auth-primary}` (#06b5a0) as a general accent — it's brighter and slightly different from `{colors.primary}` and will create visual inconsistency.
- Don't add decorative gradients to cards, tables, or panel backgrounds — gradients are confined to the header, modal header strips, and auth-only surfaces.
- Don't apply shadows to UML nodes in their default (unselected) state — flat is intentional.
- Don't soften UML node corners (border-radius > 3px) — it looks like a regular app-shell card and breaks the academic diagram aesthetic.
- Don't use `font-weight: 300` or `800` anywhere.
- Don't mix `Georgia, serif` outside of `ConfirmDialog`.
- Don't invent new border-radius values between `{rounded.sm}` (8px) and `{rounded.md}` (10px) — the existing scale covers all cases.
- Don't add background images or overlays except in `AppSidebar` (where it is already tightly controlled).
- Don't implement standalone inline error states with colors other than `{colors.error}` / `{colors.success}` — these semantic colors must stay consistent.

---

## File Map for New Developers

| What you need | Where to look |
|---|---|
| CSS variables / root palette | `src/styles/global.css` → `:root` block, `src/components/auth/Auth.css` |
| App shell layout | `src/pages/HomePage.tsx`, `src/components/layout/AppSidebar.tsx` |
| Header | `src/components/layout/Header.tsx` |
| Sidebar (UML editor tools) | `src/components/layout/Sidebar.tsx`, `src/components/ui/SidebarTabs.tsx` |
| UML node visual system | `src/components/flow/umlNodeStyles.ts` ← start here |
| UML node component | `src/components/flow/EditableNode.tsx` |
| Modals (standard) | `src/components/ui/ModelLibraryTable.tsx` → `ModelDetailModal` |
| Modal (confirm / danger) | `src/components/ui/ConfirmDialog.tsx` |
| Auth card | `src/components/auth/Auth.css`, `src/components/auth/SignIn.tsx` |
| Toast system | `src/components/ui/ToastProvider.tsx` |
| Table pattern | `src/components/ui/ModelLibraryTable.tsx` → `ModelLibraryTable` + `TableRow` |
| Domain badge colors | `src/components/ui/ModelLibraryTable.tsx` → `D_THEMES` constant |
| Flow canvas + dot grid | `src/styles/global.css` → React Flow section |
