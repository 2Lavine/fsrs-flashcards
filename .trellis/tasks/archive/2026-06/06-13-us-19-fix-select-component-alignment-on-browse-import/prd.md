# US-19: Replace Native Select with shadcn Select in BrowsePage

## Goal

Replace the **native `<select>` element** in BrowsePage with the
project's shadcn `Select` component so it visually aligns with the
adjacent `Input` and `Button` (heights, border-radius, focus ring,
chevron icon, dark theme).

## Why

`BrowsePage.tsx` uses a raw HTML `<select>` for the deck filter:

```tsx
<select
  className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
  value={deckFilter}
  onChange={e => setDeckFilter(e.target.value)}
>
```

That doesn't match the surrounding shadcn `Input` and `Button`:
- Heights/padding drift slightly (native select uses padding-based
  height; shadcn controls use explicit `h-8`/`h-9`)
- Focus ring style differs
- The OS-rendered arrow icon is jarring on the dark theme
- No proper placeholder or disabled state styling

The project already wraps the shadcn `Select` (built on
`@base-ui/react/select`, NOT Radix) in `ui/select.tsx` and uses it
in `AiCardsPage.tsx`. Reusing it here gives free consistency.

## Scope

### In (BrowsePage only — `packages/client/src/components/BrowsePage.tsx`)

- Replace the native `<select>` deck filter with the shadcn
  `Select` component.
- Import pattern (mirror `AiCardsPage.tsx`):
  ```tsx
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
  ```
- Trigger sized to match adjacent `Input` and `Button`. The shadcn
  default is `h-8` — add `h-9` if it looks short next to the
  Input/Button (those default to `h-9`).
- Empty-value "All Decks" should render as the trigger's placeholder
  text: `<SelectValue placeholder="All Decks" />`.
- When `deckFilter` is set, the trigger shows the matching deck name.
- `<SelectItem>` per deck.
- Same `value`/`onValueChange` API (shadcn's `onValueChange` takes
  the value directly, no `e.target.value`).

### Out

- Do NOT change the deck filter's behavior (just the visual).
- Do NOT touch `ImportModal.tsx`, `AiCardsPage.tsx`, or any other
  file.
- No new dependencies — `Select` is already in `ui/select.tsx`.
- No mobile-specific tweaks.

## Acceptance

1. The BrowsePage deck filter uses the shadcn `Select` component
   and visually matches the adjacent `Input` and `Button` heights,
   border, and focus ring.
2. The OS-rendered dropdown arrow is gone; the shadcn chevron is
   used instead.
3. Selecting a deck from the dropdown updates `deckFilter` and
   filters the card list (same behavior as before).
4. The trigger shows "All Decks" as placeholder when no filter
   is set; shows the deck name when one is selected.
5. `ImportModal` is unchanged.
6. `AiCardsPage` is unchanged.
7. `pnpm -r typecheck` passes; `pnpm --filter @fsrs/server test`
   still passes (22 tests).

## Tech

- Single component change in `BrowsePage.tsx`:
  - Add shadcn Select imports.
  - Replace the native `<select>` JSX with `<Select>` +
    `<SelectTrigger>` + `<SelectValue>` + `<SelectContent>` +
    `<SelectItem>` list.
  - The `onChange={(e) => setDeckFilter(e.target.value)}` becomes
    `onValueChange={(v) => setDeckFilter(v)}`.
  - The empty string for "All Decks" stays the same — it's just
    not rendered as a `<SelectItem>` but as the trigger's
    `placeholder`.

## Files to touch

- `packages/client/src/components/BrowsePage.tsx`

## Verification

- `pnpm -r typecheck` passes.
- `pnpm --filter @fsrs/server test` still passes.
- Manual: open Browse page, confirm the deck filter trigger is
  the same height as the Input/Button, opens a styled dropdown
  on click, filters cards correctly.
- `git diff --name-only` shows only `BrowsePage.tsx`.

## Related

- The shadcn `Select` is already used in `AiCardsPage.tsx` — this
  is a consistency fix, not a new pattern.
- Built on `@base-ui/react/select` (per the project's
  `CLAUDE.md` Tooltip convention note applies to Select as well
  — use the compound pattern, not raw primitives).
