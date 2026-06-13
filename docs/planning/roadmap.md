# Roadmap

## Done

- [x] React 19 + TypeScript + Vite 6 scaffold
- [x] SQLite via sql.js WASM with localStorage persistence
- [x] FSRS v6 scheduling (ts-fsrs)
- [x] Zustand state management
- [x] Review page — question/answer, 1/2/3/4 rating, Space to reveal
- [x] Browse page — search, deck filter, card list, delete
- [x] Stats page — daily bar chart, category/rating distribution, recent logs
- [x] Import/Export JSON
- [x] Category dimension — card field, review filter chips, pause toggle
- [x] Undo — Ctrl+Z / A, unlimited session history stack
- [x] Delete card — D key
- [x] Dark theme — "Scholarly Midnight" aesthetic, CSS split by page
- [x] Auto-import — dev server reads `public/auto-import/*.json` on startup
- [x] DB schema migration — category column added to existing DBs

## Next

- [ ] **vitest** — unit tests for FSRS scheduling, SQL CRUD, undo stack
- [ ] **PWA** — offline-ready, installable to home screen
- [ ] **Markdown cards** — code blocks, tables, math (KaTeX) in card content
- [ ] **Card editor** — edit question/answer/tags/category inline
- [ ] **Anki export** — `.apkg` export for Anki users
- [ ] **Scheduler config UI** — adjust retention, max interval, steps from Stats page
- [ ] **Keyboard shortcut cheatsheet** — overlay showing all hotkeys
- [x] **Review heatmap** — GitHub-style contribution graph for review activity → US-13
- [x] **Stats by deck** — replace category breakdown with deck-level stats → US-13

## Tech Debt

- [ ] Share types between auto-import endpoint and CardInput
- [ ] `CardStore` deprecated — fully migrate to `SqlCardQuery`/`SqlCardMutation`
- [ ] Extract shared UI components (Flashcard, StatsBar, CategoryChips)
- [ ] Error boundary for DB init failures
- [ ] IndexedDB backup for large databases (>5MB localStorage limit)
