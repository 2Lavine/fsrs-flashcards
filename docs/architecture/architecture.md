# FSRS Flashcards — Architecture & Data Flow

## Stack

```
React 19 + TypeScript + Vite 6
  ├── Zustand 5          ← reactive state trigger (~1 KB)
  ├── sql.js (WASM)      ← SQLite in browser
  ├── ts-fsrs            ← FSRS spaced-repetition scheduler
  └── localStorage       ← SQLite binary persistence
```

## Layer Diagram

```
┌─────────────────────────────────────────────────┐
│  UI Layer (React Components)                    │
│  ReviewPage  BrowsePage  StatsPage  ImportModal │
│       │            │          │           │       │
│       └────────────┴──────────┴───────────┘       │
│               │         │                         │
│        useStore()   cardStore (direct reads)      │
└───────────────┼─────────┼─────────────────────────┘
                │         │
┌───────────────┼─────────┼─────────────────────────┐
│  State Layer (Zustand)  │                         │
│  version counter        │                         │
│  actions → bump()       │                         │
└───────────────┼─────────┼─────────────────────────┘
                │         │
┌───────────────┼─────────┼─────────────────────────┐
│  Data Layer (CardStore)  │                        │
│  SQL CRUD  │  Stats  │  FSRS state                │
└───────────────┼─────────┼─────────────────────────┘
                │
┌───────────────┼───────────────────────────────────┐
│  Storage Layer                                    │
│  sql.js → SQLite schema → localStorage binary     │
└───────────────────────────────────────────────────┘
```

## Data Flow

### 1. App Startup

```
main.tsx
  │
  ├─ await initDB()
  │   ├─ sql.js WASM loaded
  │   ├─ localStorage read → SQLite DB deserialized
  │   ├─ CREATE TABLE IF NOT EXISTS (decks, cards, review_logs)
  │   └─ ALTER TABLE migration (category column)
  │
  ├─ initStore()
  │   └─ new CardStore(getDB())  ← DB handle injected
  │
  └─ ReactDOM.createRoot → <App />
```

### 2. Review Flow (rate a card)

```
User presses "1" (Again)
  │
  ▼
ReviewPage.rate(Rating.Again)
  │
  ├─ review(card, rating)             ← scheduler.ts (FSRS)
  │   └─ scheduler.next(card.fsrs, now, rating)
  │       Returns: { card: updated Card, log: ReviewLog }
  │
  ├─ cardStore.updateCardFSRS(card)    ← SQL UPDATE
  ├─ cardStore.insertReviewLog(...)    ← SQL INSERT
  │
  ├─ persist()                         ← localStorage.setItem(DB binary)
  │
  └─ bump()                            ← Zustand: version++
      │
      └─ All subscribed components re-render
          ReviewPage reads cardStore.getDueCards() → next card
```

### 3. Import Flow

```
User pastes JSON → Import
  │
  ▼
ImportModal.doImport()
  │
  ├─ JSON.parse → validate "cards" array
  │
  ├─ importCards(deckName, source, cards)  ← Zustand action
  │   ├─ cardStore.addCards(...)           ← SQL INSERT (deck + cards)
  │   └─ set({ version: version + 1 })     ← trigger re-render
  │
  └─ persist()                             ← save DB to localStorage
```

### 4. Component Read Pattern

```
Components read data in two ways:

A) Reactive reads (need re-render on mutation):
   useStore(s => s.version)   ← subscribe to version counter
   Then read cardStore.*() directly in render

B) Static reads (no re-render needed):
   cardStore.getDecks()       ← one-time read
   cardStore.getCategories()  ← one-time read
```

## SQLite Schema

```sql
decks (id, name, source, created_at)

cards (
  id, deck_id, question, answer, tags, category,
  created_at,
  fsrs_due, fsrs_stability, fsrs_difficulty,
  fsrs_elapsed_days, fsrs_scheduled_days,
  fsrs_reps, fsrs_lapses, fsrs_state,
  fsrs_last_review, fsrs_learning_steps
)

review_logs (
  id, card_id, rating, state, due,
  stability, difficulty,
  elapsed_days, last_elapsed_days,
  scheduled_days, learning_steps, review
)
```

## File Map

```
src/
├── main.tsx              # Entry: initDB → initStore → render App
├── App.tsx               # Page router (state-based, no react-router)
├── db.ts                 # sql.js init, schema, migrations, persist()
├── store.ts              # CardStore class: SQL CRUD, stats queries
├── store-instance.ts     # Zustand store + cardStore singleton
├── scheduler.ts          # FSRS repeat() / next() wrapper
├── format.ts             # Date, cloze, labels
├── use-toast.ts          # Toast notification hook
├── style.css             # CSS entry (imports styles/*)
├── vite-env.d.ts         # Vite type declarations
├── styles/
│   ├── tokens.css        # CSS variables, fonts, body, grain
│   ├── shared.css        # Header, nav, buttons, modal, toast, badges
│   ├── review.css        # Card display, rating buttons
│   ├── browse.css        # Search, card list
│   └── stats.css         # Charts, distribution bars
└── components/
    ├── ReviewPage.tsx    # Review UI + category filter + keyboard
    ├── BrowsePage.tsx    # Card browser + search + export
    ├── StatsPage.tsx     # Daily chart + category/rating distribution
    └── ImportModal.tsx   # JSON import dialog
```

## Dev Commands

```bash
cd fsrs-flashcards
pnpm install
pnpm dev          # http://localhost:5173
pnpm build        # production build → dist/
```

## Debug

```js
// Browser console
localStorage.removeItem('fsrs-sqlite-db')  // reset database
location.reload()
```
