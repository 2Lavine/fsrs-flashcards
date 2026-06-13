# US-18: Fixed One-Row Custom Prompt at Viewport Bottom

## Goal

Pin the custom AI prompt to the **bottom of the viewport** as a single
horizontal row — input on the left, two buttons (Generate + Clear) on
the right — so the user can type and submit a custom prompt at any
time, in the style of a chat input bar.

## Why

US-17 moved the textarea to the bottom of the *page*, but the layout
was still vertical (textarea on top, buttons below). The user wants
the tighter, more familiar **chat-input pattern**: one row, input
fills the space, action buttons docked on the right.

`position: fixed` (vs `sticky`) is correct here: the Review page has
limited vertical content, so sticky would behave like static. Fixed
guarantees the bar is always at the viewport bottom regardless of
scroll.

## Scope

### In (Review page only — `packages/client/src/components/ReviewPage.tsx`)

1. **Replace the multi-row textarea block** with a single horizontal
   row:
   - A single-line text `<input>` (or `<textarea rows={1}>`) on the
     left, taking the remaining width.
   - Two buttons (`Generate`, `Clear`) docked on the right.

   ```tsx
   <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg z-50">
     <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-2">
       <input
         type="text"
         className="flex-1 rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
         placeholder="Ask anything — the LLM will turn it into flashcards. Use {question} and {answer} to reference the current card."
         value={customPrompt}
         onChange={e => setCustomPrompt(e.target.value)}
         onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCustomAi(); } }}
         disabled={!s.card}
       />
       <Button size="sm" onClick={handleCustomAi} disabled={!s.card || !customPrompt.trim()}>Generate</Button>
       <Button variant="outline" size="sm" onClick={() => setCustomPrompt('')}>Clear</Button>
     </div>
   </div>
   ```

   Notes on the recommendation:
   - `flex items-center gap-2` makes it a single row with buttons
     right-docked.
   - `flex-1` on the input lets it fill the remaining width.
   - `onKeyDown` adds a small UX nicety: pressing `Enter` triggers
     `handleCustomAi` (with `Shift+Enter` left for future multi-line
     expansion). Optional — include if it feels right.
   - `disabled={!s.card}` on the input so it's clearly inert when
     there's no current card.

2. **Add bottom padding to the page-level container** so the fixed
   bar doesn't cover the rating buttons on the card. The current
   container is `flex flex-col gap-6 max-w-5xl mx-auto`. Add `pb-24`
   (or similar) to leave room for the fixed bar.

3. **Keep the existing behavior**:
   - `handleCustomAi` uses the current card (US-17 behavior).
   - Generate disabled when no card or no prompt.

### Out

- **Do NOT touch `AiCardsPage.tsx`** — separate page, stays as-is.
- No multi-line textarea expansion (out of scope; can be added later).
- No new preset, no preset chaining.
- No new dependencies.

## Acceptance

1. The custom prompt is a **single horizontal row** pinned to the
   bottom of the viewport: input on the left, Generate + Clear buttons
   on the right.
2. The fixed bar has a background color matching the page (dark
   theme-compatible), a top border, and a slight shadow so it
   visually separates from the card content.
3. The fixed bar is constrained to the page's max width (`max-w-5xl`)
   and centered.
4. The page content has enough bottom padding that the fixed bar does
   not overlap the rating buttons on the card.
5. `handleCustomAi` still uses the current card (US-17 behavior).
6. Generate still disabled when no card or no prompt.
7. `AiCardsPage` is unchanged (no diff).
8. `pnpm -r typecheck` passes; `pnpm --filter @fsrs/server test` still
   passes (22 tests).

## Tech

- Single component change in `ReviewPage.tsx`:
  - Replace the current textarea block (in the moved-to-bottom
    position from US-17) with a single horizontal row: input + two
    buttons.
  - Wrap it in a `fixed bottom-0 left-0 right-0` container with
    `bg-background border-t shadow-lg z-50`.
  - Add `pb-24` (or similar) to the page-level container.
- Use Tailwind v4 utility classes only — no new deps.
- Use `<input type="text">` for the chat-input feel. If the user later
  wants multi-line, we can swap to `<textarea rows={1}>` with the
  same `flex-1` styling.

## Files to touch

- `packages/client/src/components/ReviewPage.tsx`

## Verification

- `pnpm -r typecheck` passes.
- `pnpm --filter @fsrs/server test` still passes.
- Manual: open Review page, confirm the custom input is a single row
  at the bottom of the viewport, input on the left takes the
  remaining width, Generate + Clear are on the right. Type a prompt
  and click Generate — confirm it still uses the current card.
- Confirm dark theme compatibility.
- `git diff --name-only` shows only `ReviewPage.tsx`.

## Related

- Builds on US-16 (persistent custom prompt), US-17 (moved to page
  bottom), and now US-18 (pinned to viewport + one-row layout).
- Long-term: if more "always-available" controls are added, they
  could share this fixed bottom bar. Out of scope.
