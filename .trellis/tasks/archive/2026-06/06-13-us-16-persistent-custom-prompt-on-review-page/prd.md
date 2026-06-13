# US-16: Persistent Custom Prompt on Review Page

## Goal

Make the custom AI prompt input on the Review page **always visible** (no
toggle), so the learner can ask the LLM to generate cards from any
free-form question without leaving the review flow. AiCardsPage stays
unchanged.

## Why

The current "Custom" button toggles a textarea. Most users have a question
pop into their head during review — the extra click to expand, write,
generate, and dismiss breaks the flow. The textarea is small and useful
enough to live on the page permanently.

## Scope

### In

- **Review page only** (`packages/client/src/components/ReviewPage.tsx`):
  - Remove the "Custom" toggle button.
  - Always render the textarea + a Generate button.
  - Replace the "Cancel" button with a small "Clear" button (or remove
    entirely — the user can backspace).
  - Update the placeholder to invite free-form questions:
    "Ask anything — the LLM will turn it into flashcards. Use
    {question}/{answer} to reference the current card."
- **LLM call change**:
  - The custom prompt is sent to the LLM **without** the current card's
    question/answer/deck/category as forced context. The user is asking a
    fresh question, not rewriting the current card.
  - `{question}` and `{answer}` placeholders remain available in the
    system prompt template so the user CAN reference the current card by
    writing them in their prompt — but they're not auto-substituted.
- **Layout**: textarea sits in the same position (between the action
  button row and the card display) and stays ~80–120px tall (rows={3}).

### Out

- **Do NOT touch `AiCardsPage.tsx`** — that's a separate free-form entry
  point and stays as-is.
- No new preset, no preset chaining, no new LLM mode flag.
- No persistent input value across page reloads (localStorage) — out of
  scope. The textarea is a free-form input, not a saved draft.
- No mobile-specific layout changes.

## Acceptance

1. On the Review page, the custom textarea is always visible — no toggle
   button required.
2. Clicking the preset buttons (解释脉络, 解释名词) still works exactly as
   before (they use the current card).
3. Typing a free-form question and clicking Generate sends the prompt to
   the LLM and produces cards via the existing task queue.
4. The current review card is **not** auto-injected as context when using
   the custom input.
5. `AiCardsPage` is unchanged (no diff in that file).
6. Type-check passes; existing tests still pass.

## Tech

- Single component change in `ReviewPage.tsx`:
  - Remove `const [customOpen, setCustomOpen] = React.useState(false);`
  - Always render the textarea block (drop the `customOpen && ...` guard).
  - Remove the "Custom" button from the action row.
  - Change "Cancel" to "Clear" (or remove).
  - Adjust `handleCustomAi` to NOT pass the current card as the
    `cardContext` arg. Pass empty/default values so the LLM just follows
    the user's prompt. Keep `presetIdx = -1` and pass
    `{ customPrompt, categories }` as options.
- No new dependencies, no type changes.

## Files to touch

- `packages/client/src/components/ReviewPage.tsx`

## Verification

- `pnpm -r typecheck` passes.
- `pnpm --filter @fsrs/server test` still passes (22 tests).
- Manual: open Review page, see the textarea already there, type a
  free-form question, click Generate, confirm cards appear in the
  pending task panel.
- Click a preset button (解释脉络) on the current card — confirm it
  still works (uses the current card).
- Visit `/ai-cards` (AiCardsPage) — confirm it's identical to before
  (no diff).

## Related

- Builds on US-14/15 source display block (page is more crowded now, but
  the textarea is still in the right spot).
- The `{question}/{answer}` placeholder syntax comes from the preset
  system. The custom prompt is just a free-form instruction that may
  or may not use those placeholders.
