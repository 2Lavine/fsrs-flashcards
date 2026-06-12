# US-12 LLM Settings Page [done]

As a learner, I want to configure my LLM API key and base URL in the app settings, so the AI rewrite feature can connect to my preferred LLM provider.

## Scenario

- Given I'm on any page
- When I click a settings icon / nav item
- Then a settings page shows with fields for LLM Base URL and API Key
- And values are persisted to the DB and survive page reloads
- And the API key field is masked (password-style input)

## Tech

- Settings stored in existing `settings` table (key/value pairs)
- New API routes: `GET /api/settings/llm` and `POST /api/settings/llm`
- New page/route in the frontend nav
