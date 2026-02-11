# Egen Meeting Notes — Brand-Aligned Redesign Prompt

> **For Claude Code / Cursor / Windsurf — Single comprehensive prompt**
> 
> This prompt transforms the Egen Meeting Notes dashboard from a generic interface into a polished, brand-aligned product that embodies Egen's identity: **calm in the AI storm**, **accelerating time to value**, and **creating certainty that fuels measurable impact**.

---

## Context

You are redesigning a Next.js 16 (React 19, TypeScript, Tailwind CSS) meeting notes management dashboard for **Egen**, an AI and data engineering consultancy. The app uses Radix UI primitives and TanStack React Query. It currently has a functional but generic design with a left sidebar, stat cards, and a notes table.

The app's features include:
- **Dashboard** with stat overview cards and recent notes
- **Notes list** with filtering, search, and sort
- **Uncategorized queue** for notes needing classification
- **Client/Project hierarchy** navigation (tree view)
- **Rules management** for auto-classification
- **Note detail view** with sharing, tagging, and metadata
- **Chrome Extension popup** (post-meeting, one-click filing — separate but style-consistent)

Your job is to apply Egen's brand guidelines systematically to every surface, interaction, and detail. This is not a reskin — it's a thoughtful translation of brand principles into product design.

---

## Part 1: Brand Foundation

### 1.1 Brand Principles → Design Behavior

Each of Egen's five brand principles must map to concrete design decisions:

| Principle | What it means for the UI |
|-----------|--------------------------|
| **In motion** | Subtle forward-moving transitions. Page loads stagger left-to-right and top-to-bottom. Hover states shift elements slightly forward/up. Progress indicators move fluidly. Use `ease-out` curves — things arrive with confidence, not bounce. |
| **Purposeful** | Every element earns its space. No decorative filler. Whitespace is generous and intentional. Color is applied with restraint — most of the interface lives in neutrals with blue accents at decision points. |
| **Focused** | Visual hierarchy is sharp. One primary action per view. Stats that matter are large; supporting info is quiet. Search and filters are accessible but don't dominate. |
| **Relatable** | Sentence case everywhere. Friendly micro-copy. Warm neutral backgrounds (not cold gray). Rounded corners. Human-readable timestamps ("2 hours ago" not "2025-01-15T14:00:00Z"). |
| **Imaginative** | Unexpected but delightful touches: a subtle gradient that shifts on scroll, the motion bar accent on active states, confidence scores visualized as fluid progress rather than dry numbers. |

### 1.2 Brand Voice in the UI

- Use **sentence case** for all text — headings, buttons, labels, navigation. Never all-caps.
- No punctuation at end of headings or labels.
- Use active, forward-moving language: "Save & share" not "Submit", "Categorize" not "Assign category", "View notes" not "Open document".
- Empty states should feel encouraging, not empty: "No notes yet — they'll appear here after your next meeting" not "No data found."
- Error messages are calm and solution-oriented: "Couldn't classify this note. You can file it manually or try again." not "Classification failed."

---

## Part 2: Design Tokens

### 2.1 Color System

Implement as CSS custom properties and Tailwind config extensions. Every color below is exact — do not approximate.

```css
:root {
  /* ── Primary Blues ── */
  --blue-900: #002259;
  --blue-800: #062F73;
  --blue-700: #00368C;
  --blue-600: #0844A6;
  --blue-500: #0049BF;
  --blue-400: #0D6AFF;
  --blue-300: #3381FF;
  --blue-200: #66A1FF;
  --blue-100: #99C0FF;
  --blue-50:  #BFD8FF;

  /* ── Accent ── */
  --green-300: #0DFFAE;

  /* ── Neutrals ── */
  --gray-1000: #001433;
  --gray-200:  #4D6080;
  --gray-100:  #A2ADBF;
  --gray-80:   #B8C6D9;
  --gray-70:   #CEDBF2;
  --gray-60:   #E6F0FF;
  --gray-50:   #F2F7FF;
  --gray-25:   #F9FBFF;
  --white:     #FFFFFF;

  /* ── Semantic Mappings ── */
  --bg-primary:     var(--gray-25);
  --bg-surface:     var(--white);
  --bg-elevated:    var(--white);
  --bg-sidebar:     var(--gray-1000);
  --bg-hover:       var(--gray-60);
  --bg-active:      var(--blue-50);
  --bg-accent:      var(--blue-400);

  --text-primary:   var(--gray-1000);
  --text-secondary: var(--gray-200);
  --text-tertiary:  var(--gray-100);
  --text-inverse:   var(--white);
  --text-accent:    var(--blue-500);
  --text-link:      var(--blue-400);

  --border-default: var(--gray-70);
  --border-subtle:  var(--gray-60);
  --border-focus:   var(--blue-400);

  --shadow-sm:  0 1px 2px rgba(0, 20, 51, 0.05);
  --shadow-md:  0 4px 12px rgba(0, 20, 51, 0.08);
  --shadow-lg:  0 8px 24px rgba(0, 20, 51, 0.12);
  --shadow-xl:  0 16px 48px rgba(0, 20, 51, 0.16);
}
```

#### Color Application Rules

1. **Background hierarchy:** `--gray-25` (page) → `--white` (cards/panels) → `--gray-60` (hover) → `--blue-50` (active/selected)
2. **Blue usage:** Lighter blues (`--blue-50` through `--blue-200`) for backgrounds, tints, and subtle states. Mid blues (`--blue-400`, `--blue-500`) for interactive elements, links, and primary buttons. Deeper blues (`--blue-700` through `--blue-900`) for emphasis moments, the sidebar, and high-contrast text on light backgrounds.
3. **Green-300 (`#0DFFAE`) is reserved** for moments that truly matter: success confirmations, achievement indicators, the confidence "high" state, and the active pulse on auto-filed notes. Never use it as a general accent. It appears maybe 2-3 times per screen maximum.
4. **Sidebar** uses `--gray-1000` (`#001433`) background with `--white` and `--gray-80` text. Active nav items get a `--blue-400` left border accent and a subtle `rgba(13, 106, 255, 0.1)` background tint.
5. **Never use pure black** (`#000000`). The darkest color is `--gray-1000` (`#001433`).
6. **All color combinations must meet WCAG AA** contrast ratio for text at 12pt+ (4.5:1 minimum).

### 2.2 Typography

**Primary typeface:** Space Grotesk (import from Google Fonts). Use weights: Light (300), Regular (400), Medium (500), SemiBold (600), Bold (700).

**Fallback stack:** `'Space Grotesk', Arial, sans-serif`

```css
:root {
  --font-family: 'Space Grotesk', Arial, sans-serif;

  /* ── Type Scale (1.25 ratio) ── */
  --text-xs:   0.64rem;   /* 10.24px — fine print, badges */
  --text-sm:   0.8rem;    /* 12.8px  — captions, metadata */
  --text-base: 1rem;      /* 16px    — body copy (minimum for digital) */
  --text-md:   1.25rem;   /* 20px    — subheadings, card titles */
  --text-lg:   1.563rem;  /* 25px    — section headers */
  --text-xl:   1.953rem;  /* 31.25px — page titles */
  --text-2xl:  2.441rem;  /* 39px    — hero/display */
  --text-3xl:  3.052rem;  /* 48.8px  — large display */

  /* ── Line Heights ── */
  --leading-tight:  1.2;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;

  /* ── Letter Spacing ── */
  --tracking-tight:  -0.02em;
  --tracking-normal:  0;
  --tracking-wide:    0.02em;
}
```

#### Typography Rules

- **Minimum body size:** 16px (`--text-base`). Never go smaller for readable body copy.
- **Captions and metadata:** 12.8px (`--text-sm`) minimum.
- **Headings:** Use Medium (500) or SemiBold (600) weight. Never Bold for headings — it's too heavy with Space Grotesk.
- **Body:** Regular (400) weight.
- **Numbers in stat cards:** SemiBold (600) at `--text-xl` or `--text-2xl`.
- **No italic** — Space Grotesk doesn't have an italic variant. Use SemiBold for emphasis instead.
- **No all caps** — sentence case everywhere.
- **Letter spacing:** Slightly tight (`--tracking-tight`) for headings, normal for body.

### 2.3 Spacing & Layout

```css
:root {
  /* ── Spacing Scale (4px base) ── */
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-8:  32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;

  /* ── Border Radius ── */
  --radius-sm:   4px;   /* Grid elements, tags, small badges */
  --radius-md:   8px;   /* Cards, inputs, dropdowns — everyday elements */
  --radius-lg:  12px;   /* Larger containers, modals, panels */
  --radius-xl:  16px;   /* Hero elements, feature cards */
  --radius-full: 9999px; /* Pills, avatars, circular elements */
}
```

#### Rounded Corner Rules

- **Nested containers:** Subtract 4px per nesting level. If outer container is `12px`, inner elements use `8px`, and elements within those use `4px`.
- **When splitting a container** with an internal divider (e.g., a card with a header section and body section), use **hard edges (0px)** at the split line, keeping rounded corners only on the outer edges.
- **Consistent radius per component type:** All cards at `--radius-md`, all buttons at `--radius-md`, all inputs at `--radius-md`, all modals at `--radius-lg`.

### 2.4 Gradients

Define these as reusable gradient tokens. They are used for the motion bar, button hovers, background accents, and confidence indicators.

```css
:root {
  /* ── Motion Bar Gradients ── */
  --gradient-subtle:     linear-gradient(135deg, var(--gray-50), var(--blue-400));
  --gradient-bold:       linear-gradient(135deg, var(--blue-900), var(--blue-400));
  --gradient-light:      linear-gradient(135deg, var(--blue-50), var(--blue-400));
  --gradient-accent:     linear-gradient(135deg, var(--blue-900), var(--blue-400), var(--green-300));

  /* ── Surface Gradients (very subtle, for backgrounds) ── */
  --gradient-page:       linear-gradient(180deg, var(--gray-25) 0%, var(--white) 100%);
  --gradient-sidebar:    linear-gradient(180deg, var(--gray-1000) 0%, var(--blue-900) 100%);
  --gradient-card-hover: linear-gradient(135deg, var(--white) 0%, var(--gray-50) 100%);
}
```

---

## Part 3: Component Design System

### 3.1 Sidebar Navigation

The sidebar is the app's spine — it should feel grounded and authoritative while providing clear wayfinding.

**Structure:**
```
┌─────────────────────────┐
│ [Egen Logo]             │ ← Logo top-left, bottom-left placement within sidebar
│                         │
│ ── Main ──              │ ← Section labels in --gray-100, --text-xs, uppercase exception: 
│                         │    these tiny section dividers can use caps for scannability
│  ◻ Dashboard            │
│  ◻ Notes                │
│  ◻ Uncategorized (3)    │ ← Badge count in --blue-400 pill
│                         │
│ ── Clients ──           │
│  ▸ Acme Corp            │ ← Expandable tree nodes
│    ├─ Data Platform     │
│    └─ Cloud Migration   │
│  ▸ Beta Industries      │
│                         │
│ ── Manage ──            │
│  ◻ Rules                │
│  ◻ Settings             │
│                         │
│ ─────────────────────── │
│ [User avatar] Alice J.  │ ← Bottom-pinned user section
│ alice@egen.com          │
└─────────────────────────┘
```

**Styling:**
- Background: `--gradient-sidebar` (subtle gradient from `--gray-1000` to `--blue-900`)
- Width: `256px`, collapsible to `64px` (icon-only mode) with smooth 200ms transition
- Logo: Egen reverse variation (white on dark), positioned top-left with comfortable padding (`--space-6`)
- Nav items: `--text-sm` size, `--white` color at 80% opacity, full opacity on hover/active
- Active item: Left border `3px solid var(--blue-400)`, background `rgba(13, 106, 255, 0.08)`, text at full white opacity
- Hover: Background `rgba(255, 255, 255, 0.05)`, text at full opacity
- Section dividers: `--gray-100` color, `--text-xs` size, `--tracking-wide` letter spacing, `--space-6` margin top
- Tree nodes: Indented `--space-6` per level, subtle connecting lines in `--gray-200` at 30% opacity
- Uncategorized badge: Pill shape (`--radius-full`), background `--blue-400`, text `--white`, `--text-xs` size
- Transition: All color/opacity changes use `150ms ease-out`
- Collapsed state: Show only icons, tooltips on hover, logo shrinks to icon mark

**Micro-interactions:**
- Tree expand/collapse: Chevron rotates 90° with `200ms ease-out`, children slide in with staggered `50ms` delay per item
- Sidebar collapse: Width animates `200ms ease-out`, text fades out at `100ms`, icons remain
- Active indicator: Left border slides in from top with `150ms ease-out`

### 3.2 Stat Cards (Dashboard)

The dashboard overview cards provide at-a-glance metrics. They should feel confident and data-rich without being cluttered.

**Layout:** Horizontal row of 4-5 cards in a CSS Grid with `gap: var(--space-4)`.

**Card Structure:**
```
┌──────────────────────────────┐
│  ↗ 12%                      │ ← Trend indicator, top-right
│                              │
│  156                         │ ← Primary number, large
│  Total notes                 │ ← Label below
│                              │
│  ───── sparkline ─────       │ ← Mini trend line (last 30 days)
└──────────────────────────────┘
```

**Styling:**
- Background: `--white` with `--shadow-sm`
- Border: `1px solid var(--border-subtle)`
- Border-radius: `--radius-md` (8px)
- Padding: `--space-5` (20px)
- Primary number: `--text-2xl`, weight 600, color `--text-primary`
- Label: `--text-sm`, weight 400, color `--text-secondary`
- Trend indicator: `--text-xs`, positioned top-right. Green text + up-arrow for positive, `--gray-100` for neutral
- Sparkline: 48px tall, rendered with a simple SVG path. Stroke `--blue-300` at 2px, fill gradient from `--blue-100` at 20% opacity to transparent
- Hover: `--shadow-md` transition, border shifts to `--border-default`, card translates `0, -1px`

**The "Uncategorized" card gets special treatment:**
- When count > 0: Left border becomes `3px solid var(--blue-400)` (attention, not alarm)
- The number pulses subtly with a `2s ease-in-out infinite` opacity animation between 0.7 and 1.0
- When count = 0: Shows a small `--green-300` dot indicator — this is one of the rare green accent moments

**Micro-interactions:**
- Page load: Cards stagger in from left to right with `100ms` delay between each, sliding up `8px` and fading in over `300ms ease-out`
- Number count-up: On initial load, numbers count from 0 to final value over `600ms` with an ease-out curve
- Hover: Shadow elevation + subtle translate in `150ms ease-out`

### 3.3 Notes Table / List

The notes list is the most-used view. It must be scannable, filterable, and information-dense without feeling crowded.

**Use a card-list hybrid** (not a raw data table). Each note is a horizontal card within a vertical list:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ☆  │  📝 Weekly sync — Acme Data Platform                   2h ago   │
│     │  👥 Alice, Bob, Charlie  •  📂 Acme Corp / Data Platform         │
│     │  🏷 #acme  #data-platform  #q1                                   │
│     │                                              [View] [Share] [⋯]  │
└──────────────────────────────────────────────────────────────────────────┘
```

**Styling:**
- Each note card: `--white` background, `1px solid var(--border-subtle)`, `--radius-md`
- Cards separated by `--space-2` gap (tight but distinct)
- Star/favorite: `--gray-80` default, `--blue-400` when starred, with a `200ms` scale bounce on toggle
- Title: `--text-base`, weight 500, color `--text-primary`. Truncate with ellipsis if needed.
- Metadata line: `--text-sm`, color `--text-secondary`
- Tags: Inline pills with `--radius-sm`, background `--blue-50`, text `--blue-700`, `--text-xs`, padding `2px 8px`
- Timestamp: `--text-sm`, color `--text-tertiary`, right-aligned
- Action buttons: Ghost style by default (no background), `--text-secondary` color. On hover: `--bg-hover` background, `--text-accent` color
- Hover (card): `--shadow-sm` appears, left border fades in as `2px solid var(--blue-200)`, background shifts to `--gray-50`
- Selected (card): `--bg-active` (`--blue-50`), left border `3px solid var(--blue-400)`

**Confidence indicator (for recently classified notes):**
- Inline colored dot before the title
- High (>90%): `--green-300` dot
- Medium (70-90%): `--blue-400` dot
- Low (<70%): `--gray-100` dot with a subtle ring animation

**Filter bar above the list:**
```
[🔍 Search notes...]  [Client ▼]  [Date range ▼]  [Tags ▼]  [Sort ▼]
```
- Search input: `--radius-md`, `--border-default`, focus ring `2px solid var(--blue-400)` with `--shadow-sm`
- Filter dropdowns: Ghost buttons with `--text-secondary`, hover shows `--bg-hover`. Active filter gets a `--blue-50` background and `--blue-500` text
- Sort: Subtle link-style, `--text-tertiary`

**Micro-interactions:**
- List load: Notes stagger in top-to-bottom, `50ms` delay per item, sliding in from left `4px` with `200ms ease-out` fade
- Star toggle: Scale `1 → 1.2 → 1` bounce over `300ms`
- Tag click: Smooth filter application, list items that don't match fade out over `150ms`, remaining items compress gap smoothly
- Hover actions: Buttons fade in from 0 to 1 opacity over `100ms`
- Swipe right (mobile): Reveals quick-action panel with "Share" and "Move" actions

### 3.4 Buttons

Three tiers:

**Primary (key actions — "Save & share", "Categorize"):**
- Background: `--blue-500`
- Text: `--white`, weight 500
- Border-radius: `--radius-md`
- Padding: `10px 20px`
- Hover: Background shifts to `--blue-600`, `--shadow-sm` appears, translate `0, -1px`
- Active/pressed: Background `--blue-700`, translate `0, 0px` (pressed in), shadow removed
- Focus: `2px` outline offset in `--blue-300`
- Transition: All `150ms ease-out`

**Secondary (supporting actions — "Review later", "Export"):**
- Background: transparent
- Border: `1px solid var(--border-default)`
- Text: `--text-primary`, weight 500
- Hover: Background `--gray-60`, border `--blue-200`
- Active: Background `--blue-50`

**Ghost (inline actions — "View", "Share", table row actions):**
- Background: transparent, no border
- Text: `--text-secondary`, weight 400
- Hover: Background `--bg-hover`, text `--text-accent`
- Padding: `6px 12px`

**Destructive actions** (delete, remove): Use `--text-secondary` default, hover reveals red-tinted background. Never use bright red as default state — keep the interface calm.

**Button with motion bar:** For the primary CTA on the page, add a subtle `--gradient-subtle` bottom border that's 2px tall. This is the "motion bar" treatment — a directional gradient accent.

### 3.5 Inputs & Forms

- Border: `1px solid var(--border-default)`
- Border-radius: `--radius-md`
- Background: `--white`
- Text: `--text-base`, `--text-primary`
- Placeholder: `--text-tertiary`
- Padding: `10px 14px`
- Focus: Border becomes `--border-focus` (`--blue-400`), add `0 0 0 3px rgba(13, 106, 255, 0.1)` box-shadow (soft blue glow)
- Disabled: Background `--gray-50`, text `--gray-100`, 60% opacity
- Labels: `--text-sm`, weight 500, `--text-primary`, margin-bottom `--space-1`
- Helper text: `--text-xs`, `--text-tertiary`, margin-top `--space-1`
- Error state: Border `#D93025` (keep standard red for true errors — this is functional, not brand), helper text in same red
- Transition: Border color and shadow `150ms ease-out`

**Dropdowns:** Use Radix UI Select. Menu has `--radius-md`, `--shadow-lg`, `--white` background. Items have `--radius-sm` on hover with `--bg-hover` background.

**Checkboxes & toggles:** Custom-styled using Radix primitives. Checked state uses `--blue-500` fill. Toggle track uses `--gray-80` unchecked, `--blue-500` checked, with `200ms ease-out` slide.

### 3.6 Modals & Dialogs

- Overlay: `rgba(0, 20, 51, 0.5)` (dark blue-tinted, not pure black)
- Panel: `--white` background, `--radius-lg`, `--shadow-xl`
- Max-width: `480px` for standard dialogs, `640px` for complex forms
- Padding: `--space-6` (24px)
- Header: `--text-lg`, weight 600, with subtle bottom border `1px solid var(--border-subtle)`
- Close button: Top-right, ghost style, `--gray-100` default, hover `--text-primary`
- Entry animation: Overlay fades in `200ms`, panel scales from `0.95` to `1` and fades in over `200ms ease-out`
- Exit: Reverse at `150ms`

### 3.7 Toast Notifications

Used for auto-file confirmations, share success, and undo actions.

- Position: Bottom-right, `--space-6` from edges
- Background: `--gray-1000`
- Text: `--white`, `--text-sm`
- Border-radius: `--radius-md`
- Shadow: `--shadow-lg`
- Max-width: `360px`
- Left accent border: `3px solid var(--green-300)` for success, `--blue-400` for info
- Undo link: `--blue-200` color, underlined
- Enter: Slide up `12px` + fade in, `300ms ease-out`
- Auto-dismiss: After 5 seconds, slide down + fade out `200ms`
- Stack: Multiple toasts stack with `--space-2` gap, each shifting up smoothly

### 3.8 Empty States

When a view has no content, show an encouraging message with a subtle illustration or icon.

- Container: Centered in the available space
- Icon: A relevant geometric icon (folder for notes, search for no results) in `--blue-200`, `48px`
- Heading: `--text-md`, weight 500, `--text-primary`
- Description: `--text-base`, `--text-secondary`, max-width `400px`, centered
- CTA: Primary button if there's an actionable next step
- Example: Empty notes → "No notes yet" / "Meeting notes will appear here automatically after your calendar events end" / [Browse uncategorized]

### 3.9 Confidence Visualization

Instead of a dry percentage number, visualize classification confidence as a fluid element:

**Inline indicator (notes list):**
- Small dot (6px) with color based on confidence tier
- Tooltip on hover showing percentage and reasoning

**Detail view indicator:**
- Horizontal bar, `4px` tall, `--radius-full` ends
- Background: `--gray-60` (track)
- Fill: Gradient from `--blue-400` to `--green-300` proportional to confidence
- Below 70%: Fill is only `--gray-100` — no color, needs attention
- Animate fill width on load over `400ms ease-out`
- Label: "Confidence: High (95%)" in `--text-sm`, `--text-secondary`

---

## Part 4: The Motion Bar

The motion bar is Egen's signature visual element — a gradient strip that adds direction and energy. In the app, it's used sparingly but distinctively.

### Applications

1. **Active nav item:** A `3px` left border with `--gradient-bold` (Blue-900 → Blue-400) on the active sidebar item.

2. **Page header accent:** Each page title area has a `2px` bottom line using `--gradient-subtle` (Gray-50 → Blue-400), spanning the full width. It subtly shifts gradient position on page load (`background-position` animation from `0%` to `100%` over `800ms ease-out`).

3. **Primary button hover:** On hover, the primary button's bottom border reveals a `2px` gradient line (`--gradient-light`) that slides in from left over `200ms`.

4. **Card top accent (optional, hero cards only):** The dashboard stat cards can have a `2px` top border using `--gradient-subtle`. Apply this only to the first/most important card to create hierarchy.

5. **Loading state:** Replace traditional spinners with a horizontal `2px` bar at the top of the content area. The bar uses `--gradient-bold` and animates its position left-to-right in a continuous loop (`1.5s ease-in-out infinite`).

6. **Toast left accent:** Success toasts use the `--gradient-accent` (includes green-300) as their left border, flowing vertically.

### "Cutting Edge" Corner Treatment

For hero moments (the main stat card, the modal header, the rules detail panel), apply the motion bar as a top-right corner wrap:

```css
.cutting-edge {
  position: relative;
  overflow: hidden;
}
.cutting-edge::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 60px;
  height: 2px;
  background: var(--gradient-bold);
  border-radius: 0 var(--radius-lg) 0 0;
}
.cutting-edge::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 2px;
  height: 40px;
  background: var(--gradient-bold);
  border-radius: 0 var(--radius-lg) 0 0;
}
```

Use this on **at most 1-2 elements per page**. It's a moment of distinction, not wallpaper.

---

## Part 5: Patterns & Texture

Egen has two brand patterns: "Accelerate" and "Waves of momentum." In the app, these are used as very subtle background textures, never as foreground decoration.

### Implementation

Create a subtle SVG pattern that echoes the "Waves of momentum" concept — gentle, parallel diagonal lines flowing from bottom-left to top-right (direction = forward momentum).

```css
.pattern-bg {
  background-image: url("data:image/svg+xml,..."); /* Diagonal wave lines */
  background-size: 200px 200px;
  opacity: 0.03; /* Extremely subtle — just barely visible */
}
```

**Where to apply:**
- **Login/onboarding screens** — full-page pattern background at 0.05 opacity
- **Sidebar bottom section** — very subtle wave pattern behind the user profile area at 0.03 opacity
- **Empty states** — pattern behind the illustration/icon at 0.04 opacity
- **Page backgrounds** — optional, at 0.02 opacity on `--gray-25` base

**Where NOT to apply:**
- Over content areas where text needs to be read
- On cards or interactive elements
- Anywhere it would reduce contrast or readability

---

## Part 6: Page-by-Page Specifications

### 6.1 Dashboard Page

**Layout:**
```
┌─────────┬─────────────────────────────────────────────────────────────┐
│         │  Dashboard                                                  │
│         │  ── gradient accent line ──                                 │
│         │                                                             │
│ Sidebar │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│         │  │ Total   │ │ Clients │ │ Projects│ │ Uncateg │          │
│         │  │ Notes   │ │         │ │         │ │ orized  │          │
│         │  │   156   │ │   12    │ │   28    │ │    3    │          │
│         │  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
│         │                                                             │
│         │  Recent notes                                               │
│         │  ┌─────────────────────────────────────────────────────┐    │
│         │  │  Note card 1                                       │    │
│         │  ├─────────────────────────────────────────────────────┤    │
│         │  │  Note card 2                                       │    │
│         │  ├─────────────────────────────────────────────────────┤    │
│         │  │  Note card 3                                       │    │
│         │  └─────────────────────────────────────────────────────┘    │
│         │                                                             │
│         │  [View all notes →]                                         │
└─────────┴─────────────────────────────────────────────────────────────┘
```

**Details:**
- Page title "Dashboard" in `--text-xl`, weight 600, `--text-primary`
- Subtitle or greeting: "Good afternoon, Alice" in `--text-base`, `--text-secondary` (time-aware greeting)
- Stat cards row: CSS Grid, `repeat(auto-fit, minmax(180px, 1fr))`, gap `--space-4`
- Recent notes section: Heading "Recent notes" in `--text-md`, weight 500
- "View all notes →" link: `--text-accent`, weight 500, arrow animates `4px` right on hover
- Background: `--bg-primary` with very subtle `--gradient-page`
- Content max-width: `1200px`, centered with auto margins and `--space-6` horizontal padding

### 6.2 Notes List Page

**Layout:** Full filter bar at top, scrollable card list below.

**Filter bar:**
- Sticky at the top of the content area (not the page — sidebar remains fixed)
- Background: `--white` with `--shadow-sm` when scrolled
- Search: Spans half the available width on large screens
- Filters: Wrap to second line on smaller screens
- Active filters show a count badge and "Clear all" link

**List:**
- Virtual scrolling (TanStack Virtual or native) for performance with large note counts
- Loading: Skeleton cards with `--gray-60` shimmer animation (left-to-right gradient sweep over `1.5s`)
- Pagination: Prefer infinite scroll with a "Load more" button as fallback
- Group by date: Optional sticky date headers ("Today", "Yesterday", "January 14, 2025") in `--text-xs`, weight 600, `--text-tertiary`, uppercase tracking

### 6.3 Uncategorized Queue

This page has special importance — it's where users triage notes that need classification.

**Layout:** Similar to notes list, but with an action-oriented header:
```
Uncategorized notes
3 notes need your attention

[Categorize all with AI ✨]   [Select all]
```

**Note cards here include:**
- A prominent "Categorize" primary button per card
- A "Suggested: Acme Corp / Data Platform (82%)" line showing AI suggestion with confidence
- Quick-assign dropdown for manual override
- "Ignore" ghost action to dismiss from queue

**Micro-interaction:** When a note is categorized, the card animates out — slides right and fades over `300ms`, remaining cards close the gap smoothly over `200ms`. A success toast appears with undo.

### 6.4 Rules Management

**Layout:** Vertical list of rule cards, each expandable to show full condition/action details.

**Rule card (collapsed):**
```
┌──────────────────────────────────────────────────────────────────────┐
│  Acme Corp meetings                              95% • 47× applied  │
│  When: attendee domain contains acme.com                             │
│  Then: file to Clients / Acme Corp / [auto]                         │
│                                          [Edit] [Toggle] [⋯]        │
└──────────────────────────────────────────────────────────────────────┘
```

**Rule card (expanded):** Shows full conditions tree, action details, stats chart (times applied over last 30 days as a mini bar chart), and test functionality.

**"New rule" flow:** Multi-step form in a side panel (slides in from right, 400px wide):
1. Name your rule
2. Define conditions (visual builder with AND/OR logic)
3. Define actions (folder, sharing, tags)
4. Test against recent meetings
5. Save & activate

---

## Part 7: Animation & Transition Specifications

### Global Transitions

```css
:root {
  --ease-out:   cubic-bezier(0.16, 1, 0.3, 1);     /* Snappy, confident arrivals */
  --ease-in-out: cubic-bezier(0.45, 0, 0.55, 1);    /* Smooth, balanced movement */
  --duration-fast:   100ms;  /* Hover states, color changes */
  --duration-normal: 200ms;  /* Most transitions */
  --duration-slow:   300ms;  /* Complex animations, entries/exits */
  --duration-slower: 500ms;  /* Page-level transitions */
}
```

### Page Load Sequence

When navigating to any page, elements enter in this orchestrated sequence:

1. **0ms:** Page background fades in
2. **50ms:** Page title and subtitle slide down `8px` + fade in (`--duration-slow`)
3. **150ms:** Filter bar / action area slides down + fades in (`--duration-slow`)
4. **200ms:** First content element (stat card, first note) begins entry
5. **+50ms per item:** Subsequent items stagger in (cards left-to-right, list items top-to-bottom)

All slide-in movements are `8px` — subtle, not dramatic. Direction is always downward or leftward (implying forward momentum in the reading direction).

### Loading States

**Skeleton screens** instead of spinners for all content loading:
- Skeleton shapes match the layout of the content they replace
- Background: `--gray-60`
- Shimmer: Diagonal gradient sweep from left to right, `--gray-60` → `--gray-50` → `--gray-60`, over `1.5s ease-in-out infinite`
- Skeletons fade out and real content fades in with a `200ms` crossfade

**The one spinner exception:** A horizontal progress bar at the very top of the content area (below the header), using `--gradient-bold`, for API calls that may take 2+ seconds (like Gemini classification). This is the "motion bar as loading indicator" pattern.

### Hover States Summary

| Element | Hover Effect | Duration |
|---------|-------------|----------|
| Nav item | Background tint, full opacity text | 150ms |
| Card | Shadow elevation, left border, slight lift | 150ms |
| Button (primary) | Darker shade, shadow, lift 1px | 150ms |
| Button (ghost) | Background tint, accent text color | 100ms |
| Link | Underline slides in from left | 200ms |
| Tag | Background darkens one step | 100ms |
| Star | Scale 1.1x | 150ms |
| Row action | Fade in from 0 opacity | 100ms |

---

## Part 8: Responsive Behavior

### Breakpoints

```css
/* Mobile-first breakpoints */
--bp-sm:  640px;   /* Mobile landscape */
--bp-md:  768px;   /* Tablet portrait */
--bp-lg:  1024px;  /* Tablet landscape / small desktop */
--bp-xl:  1280px;  /* Standard desktop */
--bp-2xl: 1536px;  /* Large desktop */
```

### Behavior

- **< 768px:** Sidebar collapses to bottom tab bar (Dashboard, Notes, Clients, More). Content is full-width. Stat cards stack 2x2. Note cards simplify (hide tags, show on expand).
- **768px–1024px:** Sidebar collapses to icon-only mode (`64px`). Content fills remaining width. Stat cards remain in a row.
- **> 1024px:** Full sidebar visible. Content area has max-width `1200px`, centered.
- **> 1536px:** Optional: Two-column layout for notes (list + detail panel side by side).

---

## Part 9: Accessibility Requirements

- All interactive elements must be keyboard navigable with visible focus indicators (`2px solid var(--blue-400)`, `2px` offset)
- Color is never the only indicator of state — always pair with shape, icon, or text
- Minimum touch target: `44px × 44px` on mobile
- All images and icons have appropriate `alt` text or `aria-label`
- Modals trap focus and are dismissible with `Escape`
- Toasts are announced to screen readers via `role="status"` or `aria-live="polite"`
- Respect `prefers-reduced-motion`: When active, disable all animations and transitions; show content immediately
- Respect `prefers-color-scheme`: Currently light-mode only, but structure CSS variables so dark mode can be added later

---

## Part 10: Implementation Checklist

Execute these changes in this order:

### Phase 1: Foundation
- [ ] Install Space Grotesk from Google Fonts (`@fontsource/space-grotesk` or CDN link)
- [ ] Create `tokens.css` (or Tailwind `theme.extend`) with all color, typography, spacing, radius, shadow, and gradient variables from Part 2
- [ ] Update `tailwind.config.ts` to extend the default theme with Egen's palette, type scale, and radius values
- [ ] Create the `--gradient-*` CSS custom properties
- [ ] Set global body styles: `font-family: var(--font-family)`, `background: var(--bg-primary)`, `color: var(--text-primary)`
- [ ] Add `prefers-reduced-motion` media query that sets `* { transition: none !important; animation: none !important; }`

### Phase 2: Layout Shell
- [ ] Redesign sidebar: dark gradient background, white text, active state with blue-400 left border, section dividers, collapsible behavior
- [ ] Add Egen logo (reverse/white variant) to sidebar top
- [ ] Add user profile section to sidebar bottom
- [ ] Implement sidebar collapse/expand with smooth animation
- [ ] Set content area max-width and centering
- [ ] Add the motion bar loading indicator (top of content area, horizontal gradient bar)

### Phase 3: Dashboard
- [ ] Redesign stat cards with proper typography, spacing, hover states, and sparklines
- [ ] Add staggered entry animation for cards
- [ ] Add count-up animation for stat numbers
- [ ] Apply "cutting edge" corner treatment to the first stat card
- [ ] Implement "Recent notes" section with note cards
- [ ] Add time-aware greeting ("Good morning/afternoon/evening, [Name]")
- [ ] Handle empty states with encouraging copy and pattern background

### Phase 4: Notes List
- [ ] Redesign filter bar with search input, filter dropdowns, and sort
- [ ] Redesign note cards with new typography, colors, tag pills, confidence dots, and action buttons
- [ ] Add hover states: shadow elevation, left border, action button fade-in
- [ ] Add staggered entry animation for note list
- [ ] Implement skeleton loading states with shimmer
- [ ] Add star/favorite toggle with scale bounce animation

### Phase 5: Uncategorized Queue
- [ ] Design the triage header with count and AI categorize button
- [ ] Add AI suggestion line with confidence indicator per note
- [ ] Implement card-out animation when categorized (slide right + fade)
- [ ] Add success toast with undo on categorization

### Phase 6: Rules Management
- [ ] Design rule cards (collapsed and expanded states)
- [ ] Build expand/collapse animation for rule details
- [ ] Design "New rule" side panel with multi-step flow
- [ ] Add rule stats visualization (mini bar chart for application history)

### Phase 7: Components & Polish
- [ ] Redesign all buttons (primary, secondary, ghost, destructive) per spec
- [ ] Redesign all form inputs with focus states and blue glow
- [ ] Redesign modals with blue-tinted overlay and entry animation
- [ ] Build toast notification system with positioning, stacking, and auto-dismiss
- [ ] Design empty states for each view
- [ ] Apply confidence visualization bar to note detail view
- [ ] Add motion bar accent to page headers

### Phase 8: Responsive & Accessibility
- [ ] Implement responsive breakpoints and layout shifts
- [ ] Mobile: Convert sidebar to bottom tab bar
- [ ] Add keyboard navigation and visible focus indicators
- [ ] Add `aria` attributes to all interactive components
- [ ] Test with `prefers-reduced-motion`
- [ ] Audit all color combinations for WCAG AA compliance

---

## Part 11: Key "Don'ts"

These are explicitly called out in the brand guidelines — avoid them at all costs:

1. **Don't use all caps** for any text, including buttons or badges. Sentence case only.
2. **Don't use italics** — Space Grotesk doesn't support it. Use SemiBold for emphasis.
3. **Don't use pure black** (`#000`) anywhere. Darkest color is `--gray-1000` (`#001433`).
4. **Don't overuse green-300.** It's not a status color — it's a celebration color. Max 2-3 instances per screen.
5. **Don't use generic icons.** Icons should be geometric, matching Space Grotesk's character. Match icon stroke weight to the font weight of adjacent text.
6. **Don't add patterns over text.** Patterns are background-only at very low opacity.
7. **Don't use more than one "cutting edge" corner treatment per page.**
8. **Don't make transitions too dramatic.** Keep movements to `8px` or less. Confidence, not flair.
9. **Don't use emojis in the actual UI** — the ASCII mockups above use them for documentation clarity only. Use proper geometric icons from a consistent set (Lucide, Phosphor, or similar geometric icon library that complements Space Grotesk).
10. **Don't punctuate headlines** or navigation labels.

---

## Part 12: File & Folder Expectations

After implementation, the project should have these key additions/modifications:

```
src/
├── styles/
│   ├── tokens.css              ← All CSS custom properties
│   ├── globals.css             ← Global resets, font import, base styles
│   └── animations.css          ← Keyframe definitions and utility classes
├── components/
│   ├── ui/
│   │   ├── Button.tsx          ← Primary/Secondary/Ghost/Destructive variants
│   │   ├── Card.tsx            ← Note card, stat card variants
│   │   ├── Input.tsx           ← Text input with focus glow
│   │   ├── Select.tsx          ← Dropdown with Radix
│   │   ├── Modal.tsx           ← Dialog with overlay and entry animation
│   │   ├── Toast.tsx           ← Notification with accent border and stacking
│   │   ├── Skeleton.tsx        ← Shimmer loading placeholder
│   │   ├── Badge.tsx           ← Count pill, tag pill, status dot
│   │   ├── ConfidenceBar.tsx   ← Animated gradient confidence indicator
│   │   ├── MotionBar.tsx       ← Reusable gradient accent line
│   │   └── EmptyState.tsx      ← Icon + message + optional CTA
│   ├── layout/
│   │   ├── Sidebar.tsx         ← Dark gradient sidebar with collapse
│   │   ├── TopBar.tsx          ← Page header with title + motion bar accent
│   │   └── Layout.tsx          ← Shell combining sidebar + content area
│   ├── dashboard/
│   │   ├── StatCard.tsx        ← Individual metric card with sparkline
│   │   ├── StatsRow.tsx        ← Grid of stat cards with stagger animation
│   │   └── RecentNotes.tsx     ← Recent notes preview list
│   ├── notes/
│   │   ├── NoteCard.tsx        ← Individual note in list view
│   │   ├── NotesList.tsx       ← Full notes list with filters
│   │   ├── FilterBar.tsx       ← Search + filter dropdowns
│   │   └── NoteDetail.tsx      ← Expanded note view with metadata
│   ├── uncategorized/
│   │   ├── TriageHeader.tsx    ← Count + AI categorize action
│   │   └── TriageCard.tsx      ← Note card with categorize actions
│   └── rules/
│       ├── RuleCard.tsx        ← Collapsible rule display
│       ├── RulesList.tsx       ← Full rules list
│       └── RuleEditor.tsx      ← Side panel for creating/editing rules
├── hooks/
│   ├── useStaggerAnimation.ts  ← Staggered entry animation hook
│   ├── useCountUp.ts           ← Number count-up animation hook
│   └── useReducedMotion.ts     ← Respect prefers-reduced-motion
└── tailwind.config.ts          ← Extended with Egen tokens
```

---

*This prompt is designed to be executed systematically from top to bottom. Each section builds on the previous. The result should be a meeting notes application that doesn't just use Egen's colors — it breathes Egen's principles of calm clarity, forward momentum, and purposeful restraint.*
