# US-14 Source Content on Review Page [todo]

As a learner, I want to see the original source content below the card during review, so I can quickly reference where the card came from without leaving the review flow.

## Scenario

- Given I'm reviewing a card whose deck has source content
- When the card is displayed (question visible)
- Then the deck's source content is shown below the card in a collapsible section
- And the section is **expanded by default** — user wants quick reference during review
- And I can collapse it if I want to focus on the card itself

## Acceptance

- Source content area is expanded by default — click header to collapse
- Renders as plain text (or Markdown if Markdown cards are supported)
- Hidden entirely when the deck has no source content
- Does not interfere with rating hotkeys (1/2/3/4) or space-to-reveal

## Tech

- `decks.source` is already stored in the database schema
- Add `source` to the due-cards query result or fetch on demand
- Show below the card container in `ReviewPage.tsx`
- Use a simple collapsible section (details/summary or shadcn Collapsible)
