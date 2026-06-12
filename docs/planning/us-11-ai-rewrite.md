# US-11 AI Rewrite Cards [todo]

As a learner, I want to use AI preset prompts to rewrite my card content, so I can quickly improve card quality without manual editing.

## Scenario

- Given I'm browsing my cards
- When I click an AI rewrite button (e.g. "Simplify", "Expand", "Translate") on a card
- Then the card's question + answer is sent to an LLM with the selected prompt
- And a preview modal shows the original vs rewritten content
- Then I can choose to **replace** the current card, **create a new card**, or **cancel**

## Preset Prompts

| Prompt | Description |
|---|---|
| 深入解释脉络 | Deeply explain the context and logical thread of this card's topic |
| 解释名词 | Explain key terms and concepts mentioned in the card |

## Tech

- `POST /api/ai-rewrite` endpoint calling LLM via AI SDK
- `@ai-sdk/openai` with custom provider (OpenAI-compatible endpoint)
- Modal UI for diff preview and apply
