# US-14: Show Source Content on Review Page

## Goal

Show the deck's source content (original material the cards were derived from)
below the card during review, expanded by default, so learners can quickly
reference the origin of a card without leaving the review flow.

## Why

Users generate cards by pasting source material (articles, notes, transcripts).
During review they often want to see the original context the card was derived
from — especially for ambiguous or paraphrased cards. Today the source is
stored in `decks.source` but never surfaced in the UI.

## Scope

In:
- Add a collapsible "Source" section below the card on `ReviewPage`
- Default: expanded
- Hide entirely when current deck's `source` is empty
- Plain-text rendering (whitespace preserved); no Markdown in this iteration
- Load `source` via the existing due-cards query — no extra round-trip

Out:
- Markdown rendering (defer to a future "Markdown cards" story)
- Editing the source from the review page
- Per-card source (current schema is deck-level only)

## Acceptance

1. On a deck with non-empty `source`, the source section appears below the
   card content, above the rating buttons, expanded by default.
2. Clicking the header collapses/expands the section.
3. On a deck with empty `source`, the section is not rendered at all.
4. The section does not capture keyboard focus from the card or rating
   hotkeys (1/2/3/4, Space, Z, A, D).
5. Switching to a new card updates the section's content (or hides it) to
   match the new card's deck.

## Tech

- `ReviewPage.tsx` — render new `<SourceContent>` component below the card
- Review store — include `deckSource` (or the full deck source field) in the
  due-card query result so the component has it without a refetch
- Card query (`SqlCardQuery` / shared) — add `source` to the projection
- Use a native `<details>/<summary>` for accessibility & no extra deps, or
  shadcn `Collapsible` if it fits the existing style
- Style: muted background, smaller font, max-height with scroll for long
  sources

## Files to touch

- `packages/shared/src/index.ts` — extend query result type
- `packages/shared/src/sql-card-query.ts` (or equivalent) — add `source` to SELECT
- `packages/client/src/stores/review-store.ts` — store source alongside current card
- `packages/client/src/components/ReviewPage.tsx` — render source section
- (optional) `packages/client/src/components/SourceContent.tsx` — new component

## Verification

- Manual: import a deck with a long source string, navigate to review, see
  the source expanded below the card, collapse it, rate the card, confirm
  the next card shows its own source.
- Type-check: `pnpm -r type-check` (or `tsc --noEmit` per package)
- Lint: `pnpm -r lint`
