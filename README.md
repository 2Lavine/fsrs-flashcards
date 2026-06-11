# FSRS Flashcards

A personal spaced-repetition flashcard app powered by the FSRS v6 algorithm.

Generate cards with Claude, review daily with keyboard shortcuts, and track your learning progress with stats and charts.

## Features

- **FSRS v6 scheduling** — state-of-the-art spaced repetition algorithm
- **Keyboard-driven review** — `Space` reveal, `1`-`4` rate, `A`/`Ctrl+Z` undo, `D` delete
- **Category & subcategory** — filter, pause/resume topics during review
- **Stats dashboard** — daily chart, category/rating distribution, streak tracking
- **Import/Export JSON** — Claude-generated cards drop right in
- **SQLite + localStorage** — all data stays in your browser, no server needed
- **Dark theme** — "Scholarly Midnight" aesthetic, warm amber + serif typography

## Quick Start

```bash
pnpm install
pnpm dev        # http://localhost:5173
```

To seed cards during dev: drop JSON files into `public/auto-import/` — they're auto-imported on startup.

## Build & Deploy

```bash
pnpm build      # → dist/
```

The app is a fully static SPA. Deploy `dist/` to any static host:

| Platform | Command |
|----------|---------|
| **Vercel** | `pnpm build` (auto-detects Vite, zero config) |
| **Netlify** | Drop `dist/` folder, or connect repo |
| **GitHub Pages** | Set deploy source to `dist/` via Actions |
| **Cloudflare Pages** | `pnpm build`, output dir: `dist/` |

No backend, no database server — sql.js runs a full SQLite inside the browser via WebAssembly. Cards and review history persist in `localStorage`.

## Tech Stack

- **React 19** + TypeScript + Vite 6
- **Zustand 5** — state management
- **sql.js** — SQLite compiled to WASM
- **ts-fsrs** — FSRS v6 scheduler
- **react-hotkeys-hook** — keyboard shortcuts (custom hook)

## Project Structure

```
src/
├── main.tsx              # Entry: initDB → initStore → render App
├── App.tsx               # Page router (review / browse / stats)
├── db.ts                 # sql.js init, schema, migrations, persist()
├── store-instance.ts     # Zustand store + cardQuery/cardMutation singletons
├── format.ts             # Date formatting, cloze rendering
├── styles/               # CSS split by page (tokens, shared, review, browse, stats)
├── hooks/
│   ├── useHistory.ts     # Unlimited session undo stack
│   ├── useReviewHotkeys.ts
│   └── useToast.ts
├── services/
│   ├── types.ts
│   ├── SqlCardQuery.ts   # Read operations
│   ├── SqlCardMutation.ts # Write operations
│   └── SchedulerService.ts
└── components/
    ├── ReviewPage.tsx
    ├── BrowsePage.tsx
    ├── StatsPage.tsx
    └── ImportModal.tsx
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Reveal answer |
| `1` | Rate Again |
| `2` | Rate Hard |
| `3` | Rate Good |
| `4` | Rate Easy |
| `A` / `Ctrl+Z` | Undo last rating |
| `D` | Delete current card |

## Roadmap

- [ ] **Cloud sync** — migrate to [Turso](https://turso.tech) (free tier: 9GB, 1B rows/month) + [Drizzle ORM](https://orm.drizzle.team) for type-safe queries
- [ ] **PWA** — offline-ready with service worker
- [ ] **Markdown cards** — code blocks, tables, math rendering
- [ ] **Anki export** — `.apkg` format

## License

MIT
