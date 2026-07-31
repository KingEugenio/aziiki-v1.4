# AZIIKI Design System — v1 (Phases 1–2 of the UI redesign)

This is the reference for the visual redesign in progress. Phase 1 built the
**foundation** (design tokens, primitives, dark mode) and one flagship
screen (Dashboard/Scorecard). Phase 2 redesigned the Billing & PDFs chrome
and added an app-wide dark-mode compatibility layer. Nothing here changes
data, props, business logic, or user flows — it's a visual layer only, per
the master redesign brief.

## Where things live

- `src/index.css` — all tokens, primitive classes (`.az-card`, `.az-btn-*`, `.az-input`, `.az-chip-*`, `.az-elevation-*`), and the app-wide dark-mode compatibility shim (see Phase 2 below)
- `src/lib/useTheme.ts` — dark/light mode hook (persisted, OS-aware)
- `src/components/ThemeToggle.tsx` — the toggle control (wired into the sidebar footer, desktop only for now)
- `src/components/BusinessDashboard.tsx` — Phase 1 flagship screen, fully hand-redesigned
- `src/components/InvoiceReceiptBuilder.tsx` — Phase 2: chrome (header, mode switcher, pane-tab nav, issuer card) hand-redesigned; rest of the screen covered by the dark-mode shim (see below)
- `src/components/CustomerCRM.tsx` — Phase 3: fully hand-redesigned
- `src/components/FinancialReports.tsx` — Phase 3: header/period selector/metric cards hand-redesigned; rest covered by the shim
- `src/components/AIFieldAssistant.tsx` — Phase 3: fully hand-redesigned (this is the "CFO AI Advisor" screen)
- `App.tsx` — calls `useTheme()` at the app root (not just inside `ThemeToggle`) so the `.dark` class applies before/without the sidebar mounting

## Token reference

### Color (runtime CSS variables — flip automatically with `.dark` on `<html>`)

| Token | Purpose | Light | Dark |
|---|---|---|---|
| `--surface-page` | App background | `#F8FAFC` | `#0B1220` |
| `--surface-card` | Card background | `#FFFFFF` | `#131B2C` |
| `--surface-card-2` | Nested/inset surface | `#F8FAFC` | `#0F1729` |
| `--border-subtle` / `--border-default` / `--border-strong` | Borders, low → high contrast | slate tints | white-alpha tints |
| `--text-primary` / `--text-secondary` / `--text-tertiary` | Text hierarchy | near-black → grey | near-white → grey |
| `--positive` / `--positive-soft` | Money in / good | emerald | mint |
| `--negative` / `--negative-soft` | Money out / risk | rose | coral |
| `--warning` / `--warning-soft` | Needs attention | amber | amber |
| `--accent` / `--accent-soft` / `--accent-strong` | Brand accent | teal / navy | teal-adjusted for dark bg |

**Rule:** never hardcode a Tailwind color class (`bg-white`, `text-slate-800`, `border-emerald-200`) on anything meant to support dark mode. Use the token via `style={{ color: "var(--text-primary)" }}` or the `az-*` primitive classes instead — that's what makes the `.dark` class toggle actually work.

### Radius (`@theme`, static)

`rounded-xl` (16px) → standard card · `rounded-2xl` (20px) → elevated card/dialog · `rounded-3xl` (28px) → hero panels/sheets · `rounded-4xl` (36px) → full-screen sheet top corners.

### Elevation

`--shadow-1` through `--shadow-4`, applied via `.az-elevation-1`–`4` or built into `.az-card` (level 1, level 3 on hover via `.az-card-interactive`). Dark mode shadows use a subtle glow + 1px light border instead of a drop shadow, which reads as a grey smudge on dark backgrounds.

### Motion

`animate-fade-in` (existing), `animate-scale-in`, `animate-slide-up` — all fast (220–320ms), physics-leaning easing (`cubic-bezier(0.16, 1, 0.3, 1)`), used for panels/drawers opening. `.micro-press` (existing) for tap feedback, `.az-hover-lift` for subtle row/tile hover.

## Primitives

```
.az-card              — base card: surface + border + shadow-1 + radius-2xl
.az-card-interactive   — add to .az-card for hover lift + shadow-3
.az-card-inset         — nested surface (e.g. a stat pill inside a card)
.az-btn / .az-btn-primary / .az-btn-secondary
.az-input
.az-chip-positive / -negative / -warning / -accent
.az-elevation-1..4
.az-hover-lift
```

## What Phase 1 covers

- Full token system (color, radius, shadow, motion) — done
- Dark/light mode toggle, persisted, OS-aware — done (desktop sidebar only so far; not yet in the mobile nav, since mobile nav itself hasn't been redesigned yet)
- Dashboard/Scorecard tab fully redesigned with the new tokens, mobile-first (horizontal-scroll metric cards on phones, larger tap targets, responsive text sizes) — done

## What Phase 2 covers

**Hand-redesigned** (real structural + token changes, not just color): the Billing & PDFs panel header, the Invoice/Receipt/Estimate mode switcher, the pane-tab navigation (rebuilt as a horizontal-scroll pill nav instead of underline-tabs that were starting to squeeze on smaller screens), the toast alert, and the collapsible Issuer Brand Info card.

**Deliberately left untouched:** the actual document preview canvas — the WYSIWYG invoice/receipt/estimate render itself (the right-hand column, `DESIGN_TEMPLATES`-driven) and its printed footer/share-button row. That's the *document's own* design (the 10 named templates from the earlier MVP pass), not app chrome, and it feeds print/PDF export — safer to leave it exactly as-is than risk the printed output.

**App-wide dark-mode compatibility shim** (new in `src/index.css`, bottom of file): every screen that hasn't been individually redesigned yet (Customer CRM, Reports & Wisdom, App Guide, auth screens, the rest of Billing & PDFs' own form fields, etc.) still uses literal Tailwind classes like `bg-white` / `text-slate-800` / `border-slate-200`. Rather than leaving those screens broken (invisible dark-on-dark text) until their turn in Phase 3+, a CSS override block remaps every observed shade of those literal classes to the semantic tokens whenever `.dark` is active — so **dark mode now works everywhere in the app**, today, even on screens that haven't had their spacing/hierarchy/cards redesigned yet. Bright solid-color elements (emerald-600 buttons, etc.) were deliberately left alone since they're already legible on any background.

This means: dark mode = done app-wide. Structural redesign (cards, spacing, hierarchy, mobile-first layout) = done on Dashboard + Billing & PDFs chrome, still pending everywhere else.

## What Phase 3 covers

**Hand-redesigned** with the `az-*` tokens: **Customer CRM** (account directory list, search, bulk CSV importer, add-account form, customer detail panel, balance summary cards with the horizontal-scroll mobile pattern), **Reports & Wisdom** (header, period-selector pill nav, all 4 metric summary cards), and **CFO AI Advisor** (diagnostic desk, liquidity/overdue stat cards, risk-scored results card, chat bubbles, quick-guide preset chips, send bar).

**MVP scope reconciliation** (against the Brutal Product Teardown, executed this phase): Basic Inventory/Warehouse Stock is hidden behind `MVP_MODE` again — the Teardown places it at v1.1, not launch, since it adds friction before a service business's first invoice. Reports & Wisdom's multi-currency view toggle (business/original/custom) is hidden too — the Teardown's "three competing answers to how's my business doing" critique was really about competing overview *screens* (Health Score vs. Reports vs. Net Worth), already resolved by hiding Net Worth; the currency toggle was trimmed as the one genuinely redundant control left inside Reports itself. Everything else in Reports (trend chart, category pie, Pay-Yourself-First widget, Wisdom book slider, advisory alerts, Wealth Calculator) stays — that's one screen's widgets, not a duplicate "answer."

**Dark mode QA pass** (this phase's third piece — "if it won't work, remove it"): audited every screen for patterns that would look broken in dark mode, not just the ones on the pending list.
- Fixed: two literal light gradients in App Guide's interactive calculators (would've rendered as a near-white box on a dark page) — now token-based.
- Fixed: the theme was only ever applied once a signed-in desktop user's sidebar `ThemeToggle` mounted — meaning the sign-in screen always ignored a saved dark preference, and **mobile users had no way to trigger dark mode at all** (the toggle lives in the desktop-only sidebar footer; no mobile nav exists yet, since that's Phase 4). Theme init is now called at the true app root, so the `.dark` class is active immediately based on saved/OS preference regardless of auth state or viewport. The toggle *control* itself is still desktop-sidebar-only until Phase 4 builds a real mobile nav to put it in.
- Extended the dark-mode compatibility shim: audited every color-shade class actually used across the codebase against what the shim covered, and closed the gaps — several slate/emerald/rose/amber shades (e.g. `bg-slate-150/250/300/350`, `text-slate-750/950`, `text-emerald-600/650`, the rose/amber chip families) were being used in live, MVP-reachable screens but weren't remapped, which would've meant faint or invisible text/backgrounds in dark mode. Left alone (correctly, on inspection): the document preview canvas, intentionally-dark cards (auth left panel, Golden Tablet vault widget, dark hero banners) which are already legible on any page theme, and anything only reachable through a hidden non-MVP screen.

Net result: **dark mode now works, correctly, everywhere a launch user can actually go** — not just "doesn't render broken," but redesigned chrome on the highest-traffic screens plus a verified-correct shim everywhere else.

## What's NOT done yet (honest scope, not an oversight)

The master brief asks for every screen, every component, and a mobile-first nav pattern (bottom bar / sheets replacing the sidebar on phones). Remaining sequenced phases:

1. **Phase 4** — Global shell: sidebar → collapsible on tablet, bottom nav + FAB pattern on phone (this is the one change that touches App.tsx's navigation structure, not just a component's internals — needs its own careful pass since nav affects every screen). This is also where the theme toggle becomes reachable on mobile.
2. **Phase 5** — Remaining screens (App Guide's own layout/spacing — its colors are now dark-mode-correct but it hasn't been hand-redesigned with `az-*` cards yet, onboarding, auth screens, settings/brand kit), the rest of Billing & PDFs' own form fields (items table, discount/tax, PDF Intake, Past Ledger, Brand Kit pane internals), plus empty/loading/error state polish app-wide.

**Known open item outside UI scope:** the Brutal Product Teardown flags a dead-code `business_roles` table (migration 0004) duplicating the real `business_memberships` system (migration 0026) and recommends deleting it outright. That's a backend/database change, not a UI one — flagged here, not executed, since it falls outside this redesign's front-end-only scope.

Ask for the next phase by name (e.g. "do Phase 4 next") and I'll pick up exactly where this leaves off, using the same tokens so nothing drifts inconsistent.
