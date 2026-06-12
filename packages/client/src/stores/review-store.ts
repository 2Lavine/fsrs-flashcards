import { create } from 'zustand';
import type { Grade } from 'ts-fsrs';
import { cardQuery, cardMutation } from '../store-instance';
import type { Flashcard } from '@fsrs/shared';
import { preview, review as doReview } from '../services/SchedulerService';

interface HistoryEntry {
  cardId: string;
  rating: number;
  prevFSRS: {
    due: Date;
    stability: number;
    difficulty: number;
    elapsed_days: number;
    scheduled_days: number;
    reps: number;
    lapses: number;
    state: number;
    last_review?: Date;
    learning_steps: number;
  };
}

interface StatsData {
  total: number; due: number; new: number; learning: number;
  review: number; totalReviews: number; today: number; avgDifficulty: string;
}

interface ReviewState {
  // Data
  card: Flashcard | null;
  dueCards: Flashcard[];
  previewCache: ReturnType<typeof preview> | null;
  stats: StatsData;
  decks: { id: string; name: string }[];
  categories: string[];
  pausedCategories: string[];

  // Filters
  category: string;
  deckId: string;
  showAllCats: boolean;

  // UI
  revealed: boolean;
  highlighted: number | null;
  loaded: boolean;
  deleting: boolean;

  // History
  historyLength: number;

  // Core actions
  init: () => Promise<void>;
  refreshDueCards: () => Promise<void>;

  // User actions
  setCategory: (cat: string) => void;
  setDeckId: (id: string) => void;
  setShowAllCats: (v: boolean) => void;
  reveal: () => void;
  rate: (grade: Grade) => void;
  undo: () => Promise<void>;
  deleteCurrentCard: () => Promise<void>;
  togglePauseCategory: (cat: string) => Promise<void>;

  // Raw state accessors for hotkeys
  getCard: () => Flashcard | null;
  getRevealed: () => boolean;
  getHistoryLength: () => number;
}

export const useReviewStore = create<ReviewState>((set, get) => {
  const _historyStack: HistoryEntry[] = [];

  function setCardState(cards: Flashcard[]) {
    const next = cards[0] ?? null;
    set({
      dueCards: cards,
      card: next,
      previewCache: next ? preview(next) : null,
      revealed: false,
      highlighted: null,
      deleting: false,
    });
  }

  return {
    // Initial state
    card: null,
    dueCards: [],
    previewCache: null,
    stats: { total: 0, due: 0, new: 0, learning: 0, review: 0, totalReviews: 0, today: 0, avgDifficulty: '-' },
    decks: [],
    categories: [],
    pausedCategories: [],
    category: '',
    deckId: '',
    showAllCats: false,
    revealed: false,
    highlighted: null,
    loaded: false,
    deleting: false,
    historyLength: 0,
    _historyStack,

    getCard: () => get().card,
    getRevealed: () => get().revealed,
    getHistoryLength: () => get().historyLength,

    init: async () => {
      const [stats, decks, paused] = await Promise.all([
        cardQuery.getStats(),
        cardQuery.getDecks(),
        cardQuery.getPausedCategories(),
      ]);
      set({ stats, decks, pausedCategories: paused, loaded: true });
    },

    refreshDueCards: async () => {
      const { category, deckId, pausedCategories } = get();
      const cards = await cardQuery.getDueCards(
        category || undefined,
        pausedCategories,
        deckId || undefined
      );
      setCardState(cards);
    },

    setCategory: (cat) => {
      set({ category: cat });
      get().refreshDueCards();
    },

    setDeckId: async (id) => {
      set({ deckId: id });
      const cats = await cardQuery.getCategoriesByDeck(id || undefined);
      const { category } = get();
      set({
        categories: cats,
        category: category && !cats.includes(category) ? '' : category,
      });
      get().refreshDueCards();
    },

    setShowAllCats: (v) => set({ showAllCats: v }),
    reveal: () => set({ revealed: true }),

    rate: (grade) => {
      const { card, previewCache } = get();
      if (!card || !previewCache) return;

      const prevFSRS = {
        ...card.fsrs,
        due: new Date(card.fsrs.due),
        last_review: card.fsrs.last_review ? new Date(card.fsrs.last_review) : undefined,
      };
      const result = doReview(card, grade);
      card.fsrs = result.card;
      cardMutation.recordReview(card.id, card.fsrs, grade, result.log);

      // Push history
      _historyStack.push({ cardId: card.id, rating: grade, prevFSRS });
      set({ historyLength: _historyStack.length });

      // Advance queue
      const queue = get().dueCards.slice(1);
      setCardState(queue);

      // Update stats locally
      set(s => ({
        stats: {
          ...s.stats,
          due: Math.max(0, s.stats.due - 1),
          today: s.stats.today + 1,
          totalReviews: s.stats.totalReviews + 1,
        },
      }));
    },

    undo: async () => {
      if (_historyStack.length === 0) return;
      const last = _historyStack.pop()!;
      set({ historyLength: _historyStack.length });

      await cardMutation.undoReview(last.cardId, last.prevFSRS);
      set({ highlighted: last.rating });
      get().refreshDueCards();
    },

    deleteCurrentCard: async () => {
      const { card, category, deckId, pausedCategories } = get();
      if (!card) return;
      set({ card: null, previewCache: null, revealed: false, deleting: true });
      await cardMutation.deleteCard(card.id);
      const cards = await cardQuery.getDueCards(
        category || undefined,
        pausedCategories,
        deckId || undefined
      );
      setCardState(cards);
      set(s => ({
        stats: {
          ...s.stats,
          due: Math.max(0, s.stats.due - 1),
          total: Math.max(0, s.stats.total - 1),
        },
      }));
    },

    togglePauseCategory: async (cat) => {
      await cardMutation.togglePauseCategory(cat);
      const paused = await cardQuery.getPausedCategories();
      set({ pausedCategories: paused });
      get().refreshDueCards();
    },
  };
});
