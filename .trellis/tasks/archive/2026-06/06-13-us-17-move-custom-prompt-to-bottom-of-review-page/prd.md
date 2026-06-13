# US-17: Move Custom Prompt to Bottom + Restore Card Injection

## Goal

Two related tweaks to the custom AI prompt on the Review page:

1. **Move the textarea to the bottom** of the Review page (outside the
   card-stage container), so it acts as a bottom-of-page quick-action
   input.
2. **Restore the original "inject current card" behavior** in
   `handleCustomAi` that US-16 accidentally changed. The LLM should
   receive the current review card as context, just like before US-16.

## Why

US-16 (persistent custom prompt) made the textarea always visible — good.
But it also stripped the current card out of the LLM call, on the
assumption that the user wanted "pure free-form". That was wrong: the
user actually wants to ask the LLM to do things **with the current
card** (e.g., "give me 3 mnemonics for this card's answer"), not
unrelated free-form questions. The textarea is a "rewrite/expand this
card with custom instructions" tool that happens to always be on screen.

While we're here: putting the input at the bottom of the page is
cleaner. The card stage is the visual focus; the custom input is a
secondary action that should not crowd the card.

## Scope

### In (Review page only — `packages/client/src/components/ReviewPage.tsx`)

1. **Move the custom prompt block** out of the Card Stage container and
   place it as the last child of the page-level
   `<div className="flex flex-col gap-6 max-w-5xl mx-auto">`.
2. **Restore `handleCustomAi`** to its US-16-pre-state:
   - Guard: `if (!card || !customPrompt.trim()) return;`
   - Lookup categories: `await cardQuery.getCategoriesByDeck(card.deckId || undefined)`
   - Pass the current card as cardContext:
     ```tsx
     enqueue(config, -1, {
       question: card.question, answer: card.answer,
       deck: card.deck, category: card.category, tags: card.tags,
     }, { customPrompt: customPrompt.trim(), categories: cats });
     ```
3. **Generate button gating**: disable when `!s.card || !customPrompt.trim()`.
4. **Textarea visibility**: keep always visible (no `s.card` guard on the
   block itself), so the user can see it before a card loads.
5. **Placeholder**: keep the new one
   ("Ask anything — the LLM will turn it into flashcards. Use
   {question} and {answer} to reference the current card."). It's
   accurate whether or not the LLM is auto-injecting the current card.

### Out

- **Do NOT touch `AiCardsPage.tsx`.** That page is a separate
  free-form entry point and stays as-is.
- No new preset, no preset chaining, no new LLM mode flag.
- No new dependencies.
- No change to the placeholder's `{question}`/`{answer}` semantics.

## Acceptance

1. The custom textarea is always visible AND located at the **bottom**
   of the Review page (after the Card Stage, not inside it).
2. Typing a prompt and clicking Generate passes the **current review
   card** to the LLM as context (revert of US-16's accidental change).
3. Generate is disabled when there's no current card or the prompt is
   empty.
4. Preset buttons (解释脉络, 解释名词) still work exactly as before.
5. `AiCardsPage` is unchanged (no diff in that file).
6. `pnpm -r typecheck` passes; `pnpm --filter @fsrs/server test` still
   passes (22 tests).

## Tech

- Single component change in `ReviewPage.tsx`:
  - Cut the custom prompt block from inside the Card Stage `<div>` and
    paste it as a sibling AFTER the Card Stage `<div>` (still inside
    the page-level container).
  - Restore `handleCustomAi` to the pre-US-16 shape.
  - Update the Generate button's `disabled` prop to also check `!s.card`.
- No new dependencies, no type changes.

## Files to touch

- `packages/client/src/components/ReviewPage.tsx`

## Verification

- `pnpm -r typecheck` passes.
- `pnpm --filter @fsrs/server test` still passes.
- Manual: open Review page, see the textarea already at the bottom
  (below the card), type a prompt that references the current card,
  click Generate, confirm the LLM receives the current card's
  question/answer as context (visible in the pending task panel).
- Manual: when the queue is empty (no current card), Generate is
  disabled.
- `git diff --name-only` shows only `ReviewPage.tsx`.

## Related

- Reverts one half of US-16 (the LLM call) and adds a new layout change
  to the other half (the textarea position).
- The user's mental model: the custom prompt is a "rewrite/expand
  THIS card with custom instructions" tool, not a generic
  free-form generator.
