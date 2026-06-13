# US-15: LLM-Cropped Source Capture + Markdown Rendering

## Goal

Two related improvements so the source content on the Review page is actually
useful, not just a stub:

1. **Skill side**: when generating cards, store **LLM-cropped source
   excerpts** in the `source` field — the relevant passages the LLM picked
   out of the original input as the basis for the cards. Not a one-line
   description, not the full original text.
2. **Review side**: render the source as **Markdown** (sanitized) so headings,
   code blocks, lists render correctly.

## Why

US-14 shipped a Source section on the review page, but it surfaces a problem
upstream: the fsrs-flashcards skill writes `"source": "Cell structure lecture
notes"` — a 4-word description. The full original text the user pasted is
discarded after the LLM call. That makes the Source section decorative, not
functional.

Even if we fix the skill, plain-text rendering loses structure (code blocks,
headings, lists) that the user would naturally want to skim while reviewing.

## Scope

### In

**Skill changes** (`skills/fsrs-flashcards/`):
- Update `SKILL.md` Generation Process: explicitly require the LLM to **crop
  the source** — pick out the relevant passages/segments from the original
  input that back the generated cards, and place them in `source` (Markdown
  formatted, ≤ 8000 chars). The LLM knows which passages matter, so we let
  it do the selection.
- Update `references/format.md`: change the `source` schema description from
  "Brief description of source text" → "LLM-cropped source excerpts (Markdown
  formatted, ≤ 8000 chars) — the relevant passages from the original input
  that support these cards."
- Update the three examples in `format.md` to use cropped source excerpts
  in Markdown, not one-line descriptions.

**Server changes** (`packages/server/src/`):
- `routes/cards.ts` `/import` endpoint: validate `source` size — reject
  payloads > 16KB to protect localStorage. Truncate gracefully with a
  warning header is fine, but hard-reject is simpler.
- Optional: also update the auto-import path (`public/auto-import/*.json`)
  — but this is dev-only, not blocking.

**Client changes** (`packages/client/src/`):
- Add `react-markdown` + `rehype-sanitize` (or `dompurify` + `marked` — pick
  the lighter one) as a dependency in `packages/client`.
- Replace the `<div className="whitespace-pre-wrap">` source block in
  `ReviewPage.tsx` with a `<ReactMarkdown>` component, sanitized.
- Style the rendered markdown: prose, readable line length, code-block
  background.

### Out

- Persisting per-card `source_quote` (already excluded by the API).
- Server-side markdown rendering or conversion.
- A separate "view full source" page — keep it inline.

## Acceptance

1. Skill output JSON has a `source` field containing LLM-cropped excerpts
   (Markdown formatted, ≤ 8000 chars) — the relevant passages that support
   the generated cards. Not a description, not the full original text.
2. Importing a deck with a 3,000-char cropped source stores it in
   `decks.source`.
3. Review page renders the source as Markdown:
   - Headings, lists, code blocks, bold/italic all render
   - Scripts and dangerous HTML are stripped (sanitize passes)
4. Server rejects imports with `source` > 16KB with a 400 error.
5. Skill `format.md` examples updated to use cropped Markdown source
   excerpts, not one-line descriptions.

## Tech

- Skill: edit `SKILL.md` and `references/format.md`
- Server: edit `packages/server/src/routes/cards.ts` import handler
- Client:
  - `pnpm add react-markdown rehype-sanitize` in `packages/client`
  - Replace source div in `ReviewPage.tsx`
- Sanitization: `rehype-sanitize` is the canonical path; do not allow raw
  HTML through `dangerouslySetInnerHTML`

## Files to touch

- `skills/fsrs-flashcards/SKILL.md`
- `skills/fsrs-flashcards/references/format.md`
- `packages/server/src/routes/cards.ts` (size check in /import)
- `packages/client/src/components/ReviewPage.tsx` (replace source div)
- `packages/client/package.json` (add deps)
- `docs/planning/us-15-*.md` (new user story — to create)

## Verification

- `pnpm -r type-check` — no errors
- Manual: import a 3,000-char article with headings and a code block, review
  the resulting card, confirm source renders with proper structure and
  scripts are stripped
- Try importing with a 20KB `source` → confirm 400 error

## Open Questions

- ~~Should we keep the brief description somewhere (e.g. `source_title`)?~~
  **Resolved**: just LLM-cropped source. The skill selects the relevant
  passages; the LLM also stores the title in `deck` field.
- Markdown flavor: GFM (GitHub-flavored) is the de-facto default. Use
  `remark-gfm` for tables / task lists.
