# Arus Design System — “Banking Dark”

Reusable technical reference for the current Arus UI/theme (as of 2026-10).  
Use this doc to **restore** the look after a redesign, or to **port** the same visual language to another app.

**Scope:** presentation only (tokens, chrome, idioms). Not product logic.

---

## 1. Design intent

| Trait | Decision |
|---|---|
| Mood | Deep, calm, banking-dark — quiet surfaces, emerald accent |
| Mode | Dark by default (forced; no light theme in v1) |
| Density | Comfortable, mobile-first; money figures dominate hierarchy |
| Motion | Minimal: 150–250ms ease; one entrance (`fade-slide-up`) |
| Cards | Prefer soft **panels** over heavy shadowed cards |
| Brand | Wave mark + emerald; name is secondary to clarity |

**Product UI rule that shapes layout:** recording an expense is the primary action. Chrome always exposes a prominent **+ / Quick Add**.

---

## 2. Stack assumptions (Arus)

| Layer | Choice |
|---|---|
| Framework | Nuxt 4 + Vue 3 |
| Components | Nuxt UI v4 (`@nuxt/ui`) |
| CSS | Tailwind CSS v4 (`@import "tailwindcss"`) |
| Icons | Lucide via Iconify (`i-lucide-*`); Google brand via `i-simple-icons-google` |
| Font | Inter Variable, bundled locally (`@fontsource-variable/inter`) — do not fetch from CDN at build time |
| Charts | ECharts + `vue-echarts` |
| PWA theme | `#09090b` / `#0a0a0b` |

In another stack, map Nuxt UI semantic tokens (`bg-muted`, `text-highlighted`, `bg-primary`, …) to your own design tokens using the hex values below.

---

## 3. Color system

### 3.1 Brand / semantic palettes (Nuxt UI)

```ts
// app.config.ts
ui: {
  colors: {
    primary: 'emerald',  // Tailwind emerald scale → accent / CTAs
    neutral: 'zinc',     // Zinc for text/borders when not overridden
  },
}
```

Canonical accent hex used in brand assets: **`#10b981`** (emerald-500).

### 3.2 Dark surface scale (custom overrides)

Applied under `.dark` in CSS. These override Nuxt UI’s default dark backgrounds for a deeper “banking” feel:

| Token | Hex | Role |
|---|---|---|
| `--ui-bg` | `#0a0a0b` | App canvas / body |
| `--ui-bg-muted` | `#111113` | Panels, sidebar wash |
| `--ui-bg-elevated` | `#17171a` | Hover rows, elevated chips, chart tooltip bg |
| `--ui-bg-accented` | `#1e1e22` | Stronger fill (toggle active, pressed) |
| `--ui-border` | `#212126` | Default borders, chart split lines |
| `--ui-border-muted` | `#1a1a1e` | Panel borders (quieter) |
| `--ui-border-accented` | `#2a2a30` | Hover borders, chart tooltip border |

**PWA / meta theme-color:** `#09090b` (close sibling of canvas; keep in sync when changing dark base).

### 3.3 Text hierarchy (Nuxt UI semantic classes)

Use these Tailwind/Nuxt UI utilities consistently:

| Class | Use |
|---|---|
| `text-highlighted` | Primary labels, active nav, row titles |
| `text-default` | Body / expense amounts |
| `text-muted` | Secondary meta, subtitles |
| `text-dimmed` | Tertiary (timestamps, captions, keyboard hints) |
| `text-inverted` | On solid primary buttons |

Approximate chart/label greys when hardcoding outside Nuxt UI:

| Role | Hex |
|---|---|
| Axis / muted chart text | `#8b8b94` |
| Tooltip body text | `#e4e4e7` |

### 3.4 Status & money colors

| Role | Treatment |
|---|---|
| Income / success | `text-success` / `bg-success` / CSS `.money-income` → `var(--ui-success)` |
| Expense amount | `text-default` or `.money-expense` (neutral, not red) |
| Transfer | `text-muted` / `.money-transfer` / info tint on transfer icon |
| Warning | `text-warning` / `bg-warning` (budget ≥85%, offline cache alert) |
| Error / late / over budget | `text-error` / `bg-error` |
| Info | `text-info` / `bg-info` (transfers, sync) |

**Important money UX:** expenses stay near-white/default; green is reserved for income and brand. Do not paint every outflow red.

### 3.5 Chart series palette

```
#10b981  #3b82f6  #f59e0b  #ec4899  #8b5cf6
#06b6d4  #ef4444  #84cc16  #f97316  #64748b
```

Donut slices: category color from data when present; else palette by index.  
Pie item border: canvas color `#0a0a0b`, width `2`.

### 3.6 Category badge tint formula

Given category color `C` (hex, e.g. `#64748b` fallback):

- Background: `C` + alpha `1f` (≈12% opacity) → e.g. `#64748b1f`
- Icon/foreground: solid `C`

---

## 4. Typography

| Token | Value |
|---|---|
| Family | `'Inter Variable', ui-sans-serif, system-ui, -apple-system, sans-serif` |
| Body rendering | `text-rendering: optimizeLegibility` |
| Page title | `text-xl lg:text-2xl font-semibold tracking-tight` |
| Brand wordmark | `font-semibold text-[15px] tracking-tight` (sidebar) / `text-xl` (auth) |
| Section title | `text-sm font-semibold` |
| Row primary | `text-sm font-medium` |
| Row secondary | `text-xs text-muted` |
| Micro labels | `text-[10px]`–`text-[11px]`, often `uppercase tracking-wide` for KPI captions |
| Buttons | `font-medium` (Nuxt UI button slot override) |

### Tabular numbers (required for money)

```css
.tnum {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}
```

Apply `.tnum` (or equivalent) to **all** monetary and percentage figures so columns align.

---

## 5. Shape & spacing

| Token | Value | Notes |
|---|---|---|
| Base radius `--ui-radius` | `0.625rem` (10px) | Nuxt UI base |
| Panel radius | `calc(var(--ui-radius) * 1.6)` ≈ `1rem` | Soft card feel |
| Nuxt `UCard` root | `rounded-2xl` | Auth forms |
| Icon wells | `rounded-xl` or `rounded-2xl` | Brand, empty state, FAB |
| Nav items | `rounded-lg` | Sidebar links |
| Chips / badges | `rounded-lg`–`rounded-xl` | |
| FAB (mobile +) | `rounded-2xl`, `size-13`, `-mt-5` lift | |
| Page padding | `px-4 sm:px-6 lg:px-8` | Content gutters |
| Header top | `pt-6 lg:pt-8 pb-4` | |
| Mobile bottom clearance | `pb-24` (+ `.pb-safe` on nav) | Clears bottom tab bar |
| Desktop main bottom | `lg:pb-10` | |

---

## 6. Shared CSS idioms (port these)

### Panel (primary content container)

```css
.panel {
  background: var(--ui-bg-muted);
  border: 1px solid var(--ui-border-muted);
  border-radius: calc(var(--ui-radius) * 1.6);
}
.panel-hover {
  transition: border-color 0.15s ease, background 0.15s ease;
}
.panel-hover:hover {
  border-color: var(--ui-border-accented);
  background: var(--ui-bg-elevated);
}
```

Usage patterns:

- KPI summary tiles: `panel px-5 py-4`
- List groups: `panel divide-y divide-default/50`
- Empty state wrapper: `panel` + centered content
- Prefer panels over bordered “dashboard cards” with heavy shadows

### Scroll / inputs / safe area

- `.scroll-thin` — hide scrollbars on horizontal chip rows
- Number inputs — hide spinners (WebKit + Firefox)
- `.pb-safe` — `padding-bottom: env(safe-area-inset-bottom, 0)`

### Motion

```css
@keyframes fade-slide-up {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.fade-slide-up { animation: fade-slide-up 0.25s ease both; }
```

Interactive feedback:

- Row hover: `hover:bg-elevated/60 transition-colors`
- FAB press: `active:scale-95 transition-transform`
- Panel hover: 150ms border/background (above)

---

## 7. Layout chrome

### 7.1 App shell (authenticated)

```
┌────────────┬─────────────────────────────┐
│ Sidebar    │ Offline banner (conditional)│
│ (lg+)      │ Main (scroll)               │
│ w-60       │                             │
│ sticky     │                             │
│ border-r   │                             │
│ bg-muted/30│                             │
└────────────┴─────────────────────────────┘
         MobileNav (lg:hidden, fixed bottom)
         QuickAdd (drawer mobile / modal desktop)
```

- Shell: `min-h-screen flex bg-default text-default`
- Sidebar width: `w-60`, sticky full viewport height
- Quick Add mounted **once** in layout (global overlay)

### 7.2 Desktop sidebar

1. Brand row (h-16): icon well `size-8 rounded-xl bg-primary/15 text-primary` + wordmark  
2. Primary CTA: block `UButton` size `lg`, `rounded-xl`, label “Quick Add” + keyboard chip  
3. Nav links: icon + label; active = `bg-elevated text-highlighted` + icon `text-primary`  
4. Footer: avatar + name/email → dropdown (Settings / Sign out)

Keyboard chip styling: `text-[11px] opacity-70 border border-white/25 rounded px-1.5 py-0.5`

### 7.3 Mobile bottom nav

- Fixed, `border-t`, `bg-default/95 backdrop-blur`, `.pb-safe`
- 5 columns: Home · Activity · **FAB** · Reports · More
- Inactive: `text-muted`; active: `text-primary`
- Labels: `text-[10px] font-medium`
- Center FAB: `bg-primary text-inverted shadow-lg shadow-primary/30`

### 7.4 Auth layout

- Centered column, `bg-default`
- Brand: `size-10 rounded-2xl bg-primary/15 text-primary` + `i-lucide-waves` + “Arus”
- Form in `UCard` `max-w-sm`, body padding `p-6 sm:p-7`
- Footer tagline: `text-xs text-dimmed`

### 7.5 Page header pattern

- Title + optional subtitle (`text-sm text-muted`)
- Optional right slot for primary actions (often desktop-only via `hidden lg:flex`)

---

## 8. Component recipes

### Transaction row

- Full-width button, `rounded-xl`, `gap-3`, `py-2.5`
- Left: category badge (or transfer well `bg-info/10 text-info`)
- Middle: title `text-highlighted` + meta `text-xs text-muted`
- Right: amount `.tnum font-semibold` + time `text-[11px] text-dimmed`
- Amount classes: income → success; expense → default; transfer → muted

### Empty state

- Panel, centered, `py-14`
- Icon well `size-12 rounded-2xl bg-elevated text-muted`
- Title `font-medium text-[15px]`; description `text-sm text-muted`
- Optional CTA slot below

### Budget progress

- Track: `h-1.5 rounded-full bg-elevated`
- Fill: primary; at ≥85% warning; at ≥100% error
- Percent uses `.tnum`

### Installment status (text)

| Status | Class |
|---|---|
| paid | `text-success` |
| upcoming | `text-muted` |
| late | `text-error` |
| partially_paid | `text-warning` |
| skipped | `text-dimmed` |

Calendar dots: `bg-success` / `bg-info` / `bg-error` / `bg-warning` / `bg-zinc-600` (skipped).

### Offline / sync banners

- Offline / cache warning: `bg-warning/10 text-warning border-warning/20`
- Syncing: `bg-info/10 text-info border-info/20`
- Compact: `text-xs font-medium`

### Toasts

- Nuxt UI toaster: `position: 'top-center'`, `duration: 3000`

### Overlays (Quick Add)

- Mobile (`max-width: 640px`): bottom `UDrawer`, `max-h-[94dvh]`, handle on
- Desktop: `UModal`, `max-w-lg`

---

## 9. Brand assets

### Mark

- Icon: Lucide **waves** (`i-lucide-waves`) in UI chrome
- Favicon / PWA icon: dark rounded square + emerald wave stroke + emerald dot

**SVG recipe (32×32 conceptual):**

- Background rect: fill `#0a0a0b`, corner radius ~25% of size
- Wave path: stroke `#10b981`, round caps
- Accent dot: fill `#10b981` (upper-right of wave)

Files in this repo: `public/favicon.svg`, `public/icons/icon.svg`.

### Copy tone (UI strings)

Short, calm, concrete. Prefer “Record your first expense…” over hype. Optional AI labeled clearly as optional.

---

## 10. Nuxt / app wiring checklist (restore in Arus)

| File | Responsibility |
|---|---|
| `app/assets/css/main.css` | Surface tokens, `.panel`, `.tnum`, motion, utilities |
| `app/app.config.ts` | `primary: emerald`, `neutral: zinc`, button/card slots |
| `app/app.vue` | Force `colorMode.preference = 'dark'`; `UApp` toaster |
| `nuxt.config.ts` | `colorMode` dark; Inter CSS import; `ui.fonts: false`; theme-color; PWA colors |
| `app/composables/useChartTheme.ts` | Axis/tooltip/palette hex |
| `app/layouts/default.vue` / `auth.vue` | Shell structure |
| `app/components/layout/*` | Sidebar, mobile nav, offline banner |
| `app/components/ui/*` | PageHeader, EmptyState, CategoryBadge |

---

## 11. Porting to another app (framework-agnostic)

1. **Define two layers of tokens:** (a) surface scale from §3.2, (b) semantic primary = emerald-500 `#10b981`.
2. **Lock dark mode** as default (or only) theme; set browser `theme-color` to canvas.
3. **Load Inter Variable** locally; set as sans family.
4. **Implement panel + tnum + money color rules** before building screens.
5. **Shell:** desktop rail ~240px + mobile 5-slot bar with raised primary FAB if the product has a single dominant create action.
6. **Lists over cards:** dense rows inside panels; avoid shadow stacks.
7. **Charts:** reuse palette + tooltip colors from §3.5 / `useChartTheme`.
8. **Status colors:** map success/warning/error/info; keep expense amounts neutral.

### Minimal CSS starter (non-Nuxt)

```css
:root {
  --bg: #0a0a0b;
  --bg-muted: #111113;
  --bg-elevated: #17171a;
  --bg-accented: #1e1e22;
  --border: #212126;
  --border-muted: #1a1a1e;
  --border-accented: #2a2a30;
  --primary: #10b981;
  --radius: 0.625rem;
  --font-sans: 'Inter Variable', ui-sans-serif, system-ui, sans-serif;
  color-scheme: dark;
}

body {
  margin: 0;
  font-family: var(--font-sans);
  background: var(--bg);
  color: #e4e4e7;
  text-rendering: optimizeLegibility;
}

.panel {
  background: var(--bg-muted);
  border: 1px solid var(--border-muted);
  border-radius: calc(var(--radius) * 1.6);
}

.tnum {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}
```

---

## 12. Do / don’t (preserve the look)

**Do**

- Keep surfaces nearly black with subtle elevation steps
- Use emerald sparingly: brand wells, active nav icon, primary buttons, FAB
- Align money with tabular nums
- Use panels + dividers for grouped lists

**Don’t**

- Introduce purple glow / neon glass as the default identity
- Use large drop shadows on every card
- Color expense amounts red by default
- Fetch Inter from a network font CDN in Docker/CI builds
- Mix light-theme panels into the dark shell without a full light token set

---

## 13. Source snapshot (Arus paths)

Authoritative implementations to copy when restoring:

- `app/assets/css/main.css`
- `app/app.config.ts`
- `app/composables/useChartTheme.ts`
- `app/layouts/default.vue`
- `app/layouts/auth.vue`
- `app/components/layout/AppSidebar.vue`
- `app/components/layout/MobileNav.vue`
- `app/components/ui/PageHeader.vue`
- `app/components/ui/EmptyState.vue`
- `app/components/ui/CategoryBadge.vue`
- `app/components/transaction/Row.vue`
- `public/favicon.svg` / `public/icons/icon.svg`

---

*Document generated from the Arus codebase design as shipped on `main` (banking-dark + emerald). Update this file if the canonical theme changes and you still want a portable snapshot.*
