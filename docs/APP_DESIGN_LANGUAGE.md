# FitWay App — Design Language (Apple HIG, dark-first)

The redesign of the `/app` section. Scope is **the user app only** — do not
touch the public website (`pages/website`, `web-*` CSS), admin, or coach areas.

## Principles
- **Apple Human Interface Guidelines** feel: calm, minimal, premium, content-first.
- **Dark mode first.** Light mode must still work (themes auto-flip via tokens).
- **Soft shadows only** — never borders — to separate surfaces. Hairlines, when
  truly needed, use `ring-1 ring-border` (a box-shadow, since the global reset
  forces `border-color: transparent`).
- **8px spacing system.** Use Tailwind multiples of 2 (`gap-2`=8, `gap-4`=16,
  `gap-6`=24, `p-4`/`p-5`/`p-6`, `space-y-6`). Page gutters `px-4` (16) on phones.
- **12px radius** is the default (`rounded-md`). Chips `rounded-sm` (8px), large
  surfaces `rounded-lg` (16px), pills/avatars `rounded-full`.
- **Large type hierarchy.** Generous, confident headings; quiet secondary text.
- **Accessibility WCAG AA:** ≥4.5:1 text contrast, visible focus rings (built into
  ui/*), ≥40px tap targets, `aria-label` on icon-only buttons, `alt` on images.

## Color tokens — READ THIS (common gotcha)
Semantic utilities are bridged to the brand theme:
- `bg-background` page bg · `bg-card` surfaces · `bg-muted` filled inputs/insets
- `text-foreground` **primary text** · `text-muted-foreground` secondary text
- **`text-primary` / `bg-primary` = the brand YELLOW accent** (NOT body text).
  Primary-button text on yellow is `text-primary-foreground` (near-black).
- `text-destructive` / `bg-destructive` = red. Brand blue = `text-[var(--secondary)]`.
- Status colors: `var(--green)`, `var(--amber)`, `var(--red)`, `var(--secondary)`.

## Typography scale
- Page/hero title: `text-[28px] leading-tight font-bold tracking-tight` (or `text-3xl`).
- Greeting/section title: `text-xl font-semibold tracking-tight`.
- Card title: `text-[15px] font-semibold`.
- Body: `text-[15px] text-foreground`.
- Secondary/caption: `text-[13px]`/`text-xs text-muted-foreground`.
- Numerics (stats): `text-2xl`/`text-3xl font-bold tabular-nums tracking-tight`.

## Elevation
`shadow-soft-xs` < `shadow-soft-sm` < `shadow-soft` < `shadow-soft-md` < `shadow-soft-lg`.
Cards rest at `shadow-soft-sm`; popovers/sheets/dialogs at `shadow-soft-lg`.
Never use Tailwind's default harsh `shadow`/`shadow-lg`.

## Components (import from `@/components/ui/<name>`)
button, card (Card/CardHeader/CardTitle/CardDescription/CardContent/CardFooter),
badge, input, textarea, label, tabs, avatar (Avatar/AvatarImage/AvatarFallback),
switch, progress, skeleton, separator, dialog, sheet, dropdown-menu, select,
popover, tooltip, accordion, scroll-area, checkbox, radio-group, slider, sonner.

Prefer these over hand-rolled markup. Examples:
- Buttons: `<Button>` variants `default|secondary|outline|ghost|destructive|link`,
  sizes `default|sm|lg|icon|icon-sm`. Icon-only buttons MUST have `aria-label`.
- Surfaces: `<Card className="p-5">…</Card>` (Card has default padding via `py-6`;
  override with `p-*` and use CardContent, or use a bare `<Card>` and pad inside).
- Status pills: `<Badge variant="success|warning|destructive|secondary|muted|accent">`.
- Loading: `<Skeleton className="h-X w-Y rounded-md" />`.
- To居asts: `import { toast } from "sonner"` (Toaster is mounted in AppLayout).

## Hard rules when migrating a page
1. **Preserve ALL behavior**: every `useState`/`useEffect`/fetch/handler/route,
   every `t()` i18n call, RTL (`dir`/logical props), feature flags. Change
   **presentation only** — never alter data flow or API calls.
2. Replace inline-styled buttons/cards/inputs/badges/tabs/avatars/modals with the
   `ui/*` components. Layout (flex/grid) may stay as Tailwind utilities.
3. Use logical spacing for RTL: prefer `ms-/me-/ps-/pe-`, `start-/end-`, `text-start`.
4. Keep `lucide-react` icons; size `16`–`20`, `strokeWidth={2}` (≈`size-4`/`size-5`).
5. Don't introduce new colors — use the tokens above.
6. Keep page export name/signature and the default export intact.
