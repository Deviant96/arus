# Snug Simple Design System (2026)

Reusable technical reference for the **Snug Simple** aesthetic — a 2026 comfort-first UI trend.  
Use this doc to **apply** the look to Arus (or any app), or to **port** the same visual language elsewhere.

**Related:** the current Arus shipping theme is documented in [`design-system.md`](./design-system.md) (“Banking Dark”). Keep that file to restore the dark look after a redesign.

**Scope:** presentation only (tokens, chrome, idioms, copy tone). Not product logic.

---

## 1. What it is

Snug Simple turns digital interfaces into inviting, human-centered spaces — a **friendly companion**, not a cold tool. Named as a 2026 web/app design trend (VistaPrint / 99designs community). Closely related labels:

| Cousin | Overlap |
|---|---|
| **Warm Minimalism** | Cream canvases, earthy accents, organic softness + clarity |
| **Soft SaaS** | Muted pastels, rounded components, whitespace, warm copy for retention |
| **Calm UI** | Lower cognitive load; predictable chrome; restraint over spectacle |

**Best fit:** wellness, lifestyle, community, friendly fintech / personal money tools.  
**Poor fit:** legal/compliance-heavy products that need stark authority, or neon “tech demo” branding.

---

## 2. Design intent

| Trait | Decision |
|---|---|
| Mood | Cozy, approachable, low anxiety — digital living room |
| Mode | **Light / warm** by default (cream canvas). Dark is out of character unless a full second theme is designed |
| Density | Airy; large tap targets; money figures still dominate hierarchy |
| Motion | Gentle swell / fade (200–280ms); no flashy parallax |
| Cards | Soft floating cards or filled pastel blocks on beige — not sharp bordered boxes |
| Brand | Warm accent (terracotta or sage) + charcoal CTAs; playful but restrained for finance |

**Product UI rule (Arus):** recording an expense stays the primary action. Chrome still exposes a prominent **+ / Quick Add** — restyle it as a soft colored FAB, not a harsh neon button.

---

## 3. Principles checklist

### 3.1 Warm, muted color palettes

- Replace pure white (`#ffffff`) and high-contrast black shells with **soft neutrals** and **muted pastels**.
- Use pastel / earth blocks **functionally** (categories, days, status) — not rainbow decoration on every chrome piece.
- Primary actions: **charcoal pills** or one warm accent (terracotta / sage), not saturated neon.

### 3.2 Rounded geometry and soft edges

- Eliminate sharp corners. Cards ≈ 24–32px radius; buttons/inputs/chips → **pills**.
- Optional: organic waves behind hero / net-worth style charts (finance reference).
- Prefer soft depth (light shadow) over hard 1px clinical borders.

### 3.3 Approachable, chunky typography

- Rounded or friendly sans (Nunito, Plus Jakarta Sans, or similar) — conversational headlines.
- Bold display for greetings / page titles; medium body; avoid ultra-thin corporate faces.
- Keep **tabular nums** on all money and percentages.

### 3.4 Playful, human-centric elements

- Simple icons, soft empty states, warm microcopy.
- Full cartoon mood-faces suit wellness apps; for spending trackers, keep playfulness in **empty states and accents**, not primary data chrome.

### 3.5 Structured yet gentle layouts

- Clear grid, bottom nav, page headers — but with breathing room and pill controls.
- Guide without feeling rigid, clinical, or over-polished.

### 3.6 Light tactility

- Soft shadows, optional 2–3% noise/paper texture, subtle gradients.
- Avoid heavy neumorphism that fails contrast.

### Do / don’t

**Do**

- Cream/beige canvas + charcoal ink
- Large radii and pill CTAs
- Map pastels to meaning (category, status)
- Friendly empty-state copy
- Preserve money alignment (`.tnum`)

**Don’t**

- Pure white + pure black as the only neutrals
- Sharp cards, dense data tables without softness
- Neon purple glass / glow as identity
- Pastel text on pastel backgrounds for body copy
- Paint every expense bright red (keep outflows charcoal; reserve rose for errors)

**Not Snug Simple:** stark banking-dark chrome, purple neon glass, sharp cards, high-saturation dashboards, accessibility-breaking neumorphism.

---

## 4. Lessons from reference decks

| Reference | Steal for any app | Dial down for finance (Arus) |
|---|---|---|
| Meal planner | Cream canvas; rainbow pastel **functional** blocks; charcoal pill CTA; FAB in bottom nav; stacked soft cards | Map pastels to **categories / status**, not random chrome rainbow |
| Wellness | Soft yellow/lavender screens; pill chip grids; charcoal Continue; friendly micro-illustrations | Skip mood-face as primary UI; warmth in copy/empty states only |
| Fintech (closest) | Terracotta/sage accents; wavy chart headers; cream forms; sage center `+`; floating soft cards | Best template for KPIs, forms, and mobile chrome |

---

## 5. Color tokens (starter kit)

Concrete hex starters synthesized from the references. Tweak per brand; keep relative roles.

### 5.1 Surfaces and ink

| Token | Hex | Role |
|---|---|---|
| `--snug-canvas` | `#F4F0E8` | App background (warm beige) |
| `--snug-canvas-soft` | `#FAF7F1` | Slightly lighter wash / auth |
| `--snug-surface` | `#FFFCF7` | Floating cards, forms |
| `--snug-surface-muted` | `#EFE9DF` | Recessed wells, chip tracks |
| `--snug-border` | `#E4DDD0` | Hairline borders if needed |
| `--snug-ink` | `#1C1917` | Primary text (charcoal, not pure black) |
| `--snug-ink-muted` | `#6B655D` | Secondary meta |
| `--snug-ink-dimmed` | `#9A9388` | Timestamps, captions |
| `--snug-cta` | `#1C1917` | Primary pill buttons (charcoal) |
| `--snug-cta-fg` | `#FFFCF7` | Text/icons on CTA |

**PWA / theme-color suggestion:** `#F4F0E8`.

### 5.2 Accent pastels (functional blocks)

| Token | Hex | Suggested use |
|---|---|---|
| `--snug-terracotta` | `#E8A07A` | Warm hero headers, selected accents |
| `--snug-sage` | `#A8C5A8` | Income, positive, FAB, success-soft |
| `--snug-dusty-blue` | `#A8B8C8` | Transfers / info-soft |
| `--snug-lavender` | `#C8B8D8` | Secondary feature cards |
| `--snug-butter` | `#F0E0A8` | Highlight chips, featured rows |
| `--snug-rose` | `#E8B0B0` | Soft error / late (muted, not neon) |
| `--snug-sand` | `#D4C4A8` | Neutral category fallback |

### 5.3 Money and status mapping

| Role | Treatment |
|---|---|
| Income / success | Sage text or tint (`--snug-sage`); optional deeper green `#3D6B4F` for readable text on cream |
| Expense amount | Charcoal ink (default) — **not** red |
| Transfer | Dusty blue tint + muted ink |
| Warning | Soft amber `#C4922A` text / butter background |
| Error / late / over budget | Muted rose `#B85C5C` text / `--snug-rose` background |
| Primary FAB | Sage fill + white icon, or charcoal (meal-planner style) |

Readable success/error text on cream should use **deeper** variants than the pastel fills:

```
--snug-success-ink: #3D6B4F;
--snug-warning-ink: #C4922A;
--snug-error-ink:   #B85C5C;
--snug-info-ink:    #4A6A8A;
```

### 5.4 Chart series palette

```
#A8C5A8  #E8A07A  #A8B8C8  #C8B8D8  #F0E0A8
#E8B0B0  #D4C4A8  #8FB8B0  #C4A882  #9A9388
```

Tooltip: surface `#FFFCF7`, border `#E4DDD0`, text `#1C1917`.  
Pie slice border: canvas `#F4F0E8`.

### 5.5 Category badge tint

Given category color `C`:

- Background: `C` at ~18–22% opacity on cream (or mix toward `--snug-surface`)
- Icon/foreground: darkened `C` so it stays readable on pastel

---

## 6. Typography

| Role | Guidance |
|---|---|
| Family | Rounded / friendly sans — prefer **Nunito** or **Plus Jakarta Sans**, bundled locally (Docker-safe; no CDN fetch at build) |
| Fallback | `ui-rounded, ui-sans-serif, system-ui, sans-serif` |
| Page title | Large, bold/extrabold, tight tracking, conversational (“Good morning, Prima”) |
| Section title | Medium-bold, ~15–16px |
| Body / rows | 14–15px medium; meta 12–13px muted |
| Micro | 10–11px; uppercase sparingly (KPI captions OK) |
| Buttons | Semibold on pills |

### Tabular numbers (required for money)

```css
.tnum {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}
```

---

## 7. Shape and spacing

| Token | Value | Notes |
|---|---|---|
| `--snug-radius-control` | `1rem` (16px) | Inputs, small chips |
| `--snug-radius-card` | `1.5rem`–`2rem` (24–32px) | Panels, KPI tiles |
| `--snug-radius-pill` | `999px` | Primary buttons, search, filters |
| `--snug-radius-fab` | `999px` or `1.25rem` | Center `+` |
| Page padding | `px-4` → `px-6` / `px-8` | Same breathing gutters as today |
| Section gaps | `1.25rem`–`1.75rem` | Airier than banking-dark |
| Soft shadow | `0 8px 24px -12px rgba(28, 25, 23, 0.12)` | Floating cards |
| Soft shadow sm | `0 2px 8px -2px rgba(28, 25, 23, 0.08)` | Rows / chips |

---

## 8. Shared CSS idioms

### Panel (replace dark banking panel)

```css
.panel {
  background: var(--snug-surface);
  border: 1px solid var(--snug-border);
  border-radius: var(--snug-radius-card);
  box-shadow: 0 8px 24px -12px rgba(28, 25, 23, 0.10);
}

.panel-pastel {
  /* Functional pastel block — set --panel-tint per instance */
  background: var(--panel-tint, var(--snug-butter));
  border: none;
  border-radius: var(--snug-radius-card);
  box-shadow: none;
}

.panel-hover {
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}
.panel-hover:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 28px -12px rgba(28, 25, 23, 0.14);
}
```

### Optional paper texture

```css
.snug-texture::before {
  content: "";
  pointer-events: none;
  position: fixed;
  inset: 0;
  opacity: 0.03;
  background-image: url("data:image/svg+xml,..."); /* fine noise SVG */
  z-index: 50;
}
```

Keep opacity ≤ 3%; prefer CSS/SVG over heavy image textures (Core Web Vitals).

### Motion

```css
@keyframes snug-fade-up {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.snug-fade-up { animation: snug-fade-up 0.28s ease both; }

/* Buttons / FAB */
.snug-press:active { transform: scale(0.97); }
```

---

## 9. Layout chrome recipes

### 9.1 App shell

```
┌────────────┬─────────────────────────────┐
│ Soft rail  │ Banners (soft warning tint) │
│ (lg+)      │ Main on cream canvas        │
│ ~240px     │                             │
└────────────┴─────────────────────────────┘
         Bottom nav (mobile) + sage/charcoal FAB
         Quick Add (drawer / soft modal)
```

- Shell: cream canvas + charcoal ink
- Sidebar: slightly muted cream (`--snug-surface-muted` wash), no harsh dark border — use soft divider
- Active nav: pastel pill background + charcoal label (or sage tint)

### 9.2 Mobile bottom nav

- Light bar on cream; thin rounded line icons
- Center FAB: sage (fintech) or charcoal (meal planner) circle with white `+`
- Active item: terracotta or sage icon/label — not neon

### 9.3 Auth

- Centered brand on cream
- Form in soft white card (`--snug-surface`), pill inputs, charcoal primary button
- Conversational headline (“Welcome back”)

### 9.4 Page header

- Chunky greeting / title
- Subtitle muted
- Desktop primary action: charcoal or sage pill

---

## 10. Component recipes

### KPI / summary tiles

- Soft white or pastel panels in a 3-column grid
- Uppercase micro label in muted ink
- Large `.tnum` amount (income → success ink; net → success/error ink)

### Transaction row

- Full-width soft hover (`--snug-surface-muted`)
- Left: pastel category badge (rounded-xl / 2xl)
- Title charcoal; meta muted
- Amount `.tnum`; expense charcoal; income sage ink

### Quick Add

- Mobile: bottom sheet with large radius, cream/white body
- Desktop: soft modal, max-width ~28rem, pill inputs
- Primary save: charcoal or sage pill, large tap target

### Empty state

- Soft panel, centered
- Friendly illustration or simple rounded icon well (pastel)
- Warm copy + single charcoal/sage CTA

### Budget progress

- Track: muted sand well
- Fill: sage → butter/amber ≥85% → rose ≥100%
- Percent `.tnum`

### Charts

- Warm tooltip colors (§5.4)
- Pastel series; terracotta or sage for primary trend line
- Optional wavy clip / organic header behind hero chart (finance ref) — decorative only

### Offline / sync banners

- Warning: butter background + warning ink
- Syncing: dusty-blue wash + info ink
- Avoid harsh yellow/black alert bars

---

## 11. Framework-agnostic CSS starter

```css
:root {
  color-scheme: light;

  --snug-canvas: #F4F0E8;
  --snug-canvas-soft: #FAF7F1;
  --snug-surface: #FFFCF7;
  --snug-surface-muted: #EFE9DF;
  --snug-border: #E4DDD0;
  --snug-ink: #1C1917;
  --snug-ink-muted: #6B655D;
  --snug-ink-dimmed: #9A9388;
  --snug-cta: #1C1917;
  --snug-cta-fg: #FFFCF7;

  --snug-terracotta: #E8A07A;
  --snug-sage: #A8C5A8;
  --snug-dusty-blue: #A8B8C8;
  --snug-lavender: #C8B8D8;
  --snug-butter: #F0E0A8;
  --snug-rose: #E8B0B0;
  --snug-sand: #D4C4A8;

  --snug-success-ink: #3D6B4F;
  --snug-warning-ink: #C4922A;
  --snug-error-ink: #B85C5C;
  --snug-info-ink: #4A6A8A;

  --snug-radius-control: 1rem;
  --snug-radius-card: 1.5rem;
  --snug-radius-pill: 999px;

  --font-sans: 'Nunito', 'Plus Jakarta Sans', ui-rounded, ui-sans-serif, system-ui, sans-serif;
}

body {
  margin: 0;
  font-family: var(--font-sans);
  background: var(--snug-canvas);
  color: var(--snug-ink);
  text-rendering: optimizeLegibility;
  -webkit-tap-highlight-color: transparent;
}

.panel {
  background: var(--snug-surface);
  border: 1px solid var(--snug-border);
  border-radius: var(--snug-radius-card);
  box-shadow: 0 8px 24px -12px rgba(28, 25, 23, 0.10);
}

.tnum {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}

.btn-pill {
  border: none;
  border-radius: var(--snug-radius-pill);
  background: var(--snug-cta);
  color: var(--snug-cta-fg);
  font-weight: 600;
  padding: 0.85rem 1.4rem;
  cursor: pointer;
}

.btn-pill-sage {
  background: var(--snug-sage);
  color: var(--snug-ink);
}
```

---

## 12. Nuxt UI / Arus mapping notes

**Status:** Applied as the shipping Arus theme. Restore path remains [`design-system.md`](./design-system.md) (Banking Dark).

When re-applying or porting, keep logic untouched; restyle presentation:

| Area | Direction |
|---|---|
| [`app/app.vue`](../app/app.vue) | Stop forcing dark; prefer light |
| [`nuxt.config.ts`](../nuxt.config.ts) | `colorMode.preference: 'light'`; theme-color / PWA → cream; bundle rounded font locally (`ui.fonts: false`) |
| [`app/app.config.ts`](../app/app.config.ts) | Remap `primary` (e.g. stone/neutral charcoal CTAs + custom CSS for sage/terracotta accents), raise card/button radii toward pills |
| [`app/assets/css/main.css`](../app/assets/css/main.css) | Replace banking-dark `.dark` surface overrides with snug light tokens; redefine `.panel` |
| [`app/composables/useChartTheme.ts`](../app/composables/useChartTheme.ts) | Warm tooltip + pastel palette hex |
| Layouts / chrome | Cream shell; soft sidebar; sage/charcoal FAB in [`MobileNav.vue`](../app/components/layout/MobileNav.vue) |
| Brand mark | Keep waves icon; recolor stroke to terracotta or sage on cream favicon |

**Restore path:** [`design-system.md`](./design-system.md) + current dark CSS/config if the redesign needs rollback.

---

## 13. Accessibility guardrails

- Body text: charcoal (`#1C1917`) on cream — aim for WCAG AA+.
- Never set body/labels as light pastel on pastel fills; use ink on pastel or charcoal on surface.
- Pastel blocks are **backgrounds**; interactive labels stay ink or white-on-charcoal.
- Focus rings: visible charcoal/terracotta outline (2px+), not shadow-only.
- Status is not color-only — keep text labels (Paid / Late / Partial).
- Keep `.tnum` and don’t rely on red expense coloring for meaning.
- Motion: respect `prefers-reduced-motion` (disable swell / fade-up).

---

## 14. Port checklist (any app)

1. Set light `color-scheme`; cream canvas + charcoal ink tokens.
2. Bundle a rounded sans locally.
3. Raise radii (card 24–32px, controls pills).
4. Restyle panels as soft white/pastel cards; drop harsh dark borders.
5. One warm accent + charcoal CTAs; pastel series for categories/charts.
6. Soft FAB for the dominant create action.
7. Warm empty states and microcopy.
8. Retheme charts/tooltips; verify contrast.
9. Update favicon / PWA theme-color to cream.
10. Run through a11y checklist (§13).

---

## 15. Sources

- VistaPrint — *8 Web Design Trends 2026*, section **Snug Simple** (soft neutrals, pastel blocks, playful icons, rounded edges, chunky type, light textures/gradients): https://www.vistaprint.com/hub/web-design-trends
- Adjacent reading: Soft SaaS / Warm Minimalism / Calm UI writeups (muted pastels, whitespace, organic softness, cognitive ease)
- Reference comps (project assets): meal planner (pastel day blocks), wellness (pill chips + soft cards), fintech (terracotta waves + sage FAB)

---

*Document distilled for reuse in Arus or other apps. Update this file when the canonical Snug Simple token kit for the product changes.*
