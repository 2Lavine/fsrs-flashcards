# @sour/llm-config — Package Plan

## Overview

A reusable package for configuring and creating an OpenAI-compatible LLM provider. Usable across any project that needs LLM access with UI settings.

## Package API (3 entry points)

| Export | Path | Purpose |
|---|---|---|
| `@sour/llm-config` | `src/index.ts` | Types, storage interface, `createLLMProvider()` |
| `@sour/llm-config/react` | `src/react.tsx` | `<LLMSettingsForm>` component |
| `@sour/llm-config/server` | `src/server.ts` | `llmSettingsRoutes(app, storage)` Hono plugin |

## Core Abstraction

```ts
// src/index.ts
import { createOpenAI } from '@ai-sdk/openai';

interface LLMConfig {
  baseURL: string;
  apiKey: string;
}

interface LLMConfigStorage {
  get(): Promise<LLMConfig | null>;
  set(config: LLMConfig): Promise<void>;
}

function createLLMProvider(config: LLMConfig) {
  return createOpenAI({
    baseURL: config.baseURL,
    apiKey: config.apiKey,
  });
}
```

## Storage Interface

Package defines `LLMConfigStorage` as an abstract interface. Each consuming project injects its own implementation.

**Example in fsrs-flashcards** — adapter over the `settings` table:

```ts
// fsrs-flashcards / some adapter file
const storage: LLMConfigStorage = {
  get: async () => {
    const r = await db.get("SELECT value FROM settings WHERE key='llm_config'");
    return r ? JSON.parse(r.value) : null;
  },
  set: async (config) => {
    await db.execute(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('llm_config', ?)",
      [JSON.stringify(config)]
    );
  },
};
```

## React Component

```tsx
// src/react.tsx
<LLMSettingsForm
  storage={storage}           // LLMConfigStorage impl
  onSaved={(config) => void}  // optional callback
/>
```

- Base URL input + API Key input (masked)
- Save button with loading/error/success states
- Loads existing config on mount
- Pure presentational — no HTTP calls inside, talks only through `storage` interface

## Server Routes (Hono)

```ts
// src/server.ts
llmSettingsRoutes(app: Hono, storage: LLMConfigStorage)

// Registers:
//   GET  /api/settings/llm  →  { baseURL, apiKey }
//   POST /api/settings/llm  →  body: { baseURL, apiKey }
//   POST returns masked apiKey in response
```

## Dependencies

| Dep | Why |
|---|---|
| `@ai-sdk/openai` | Provider factory |
| `hono` | Server routes (peer dep) |
| `react` | Settings form (peer dep) |
| `zod` | Request validation |

## File Structure

```
packages/llm-config/
├── package.json          # name: @sour/llm-config
├── tsconfig.json
└── src/
    ├── index.ts          # types + createLLMProvider
    ├── react.tsx          # LLMSettingsForm component
    └── server.ts          # llmSettingsRoutes(router, storage)
```

## Usage Example (fsrs-flashcards)

```ts
// server — register routes
import { llmSettingsRoutes } from '@sour/llm-config/server';
import { settingsStorage } from './adapters/llm-storage';
llmSettingsRoutes(app, settingsStorage);

// client — render settings page
import { LLMSettingsForm } from '@sour/llm-config/react';
import { settingsStorage } from './adapters/llm-storage';
<LLMSettingsForm storage={settingsStorage} />
```
