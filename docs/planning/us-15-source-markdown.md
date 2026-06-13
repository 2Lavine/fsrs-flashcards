# US-15 LLM-Cropped Source + Markdown Rendering [todo]

As a learner reviewing a card, I want the LLM-cropped source excerpts (rendered as Markdown) to be visible below the card, so I can re-read the surrounding context and verify the card is accurate — not just see a one-line description of where the cards came from.

## Scenario

- Given I import a long article (or notes, transcript) into a deck
- When the fsrs-flashcards skill generates cards from the input
- Then the `source` field of the import JSON contains **LLM-cropped source excerpts** (Markdown formatted, ≤ 8000 chars) — the relevant passages the LLM selected from the original input that support the generated cards
- And on the review page, the source block renders headings, code blocks, lists, and inline formatting
- And dangerous HTML/script tags are stripped

## Acceptance

1. Skill output: `source` = LLM-cropped excerpts (Markdown, ≤ 8000 chars), not a one-line description and not the verbatim full text.
2. Server `/import` rejects payloads with `source` > 16KB.
3. Review page source block renders Markdown (sanitized).
4. `format.md` schema docs and examples updated to match the new contract.

## Tech

- `react-markdown` + `rehype-sanitize` (+ `remark-gfm` for GFM) in `packages/client`
- Server: size check in `routes/cards.ts` `/import`
- Skill: update `SKILL.md` generation rules + `references/format.md` schema + examples

## Related

- Builds on US-14 (source display block) — the block is already in `ReviewPage.tsx`
- Supersedes the current "Brief description of source text" contract in `format.md`
