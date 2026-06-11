import { create } from 'zustand';
import { CardQuery } from './services/CardQuery';
import { CardMutation } from './services/CardMutation';
import type { Flashcard, Deck, CardInput } from './services/types';

export const cardQuery = new CardQuery();
export const cardMutation = new CardMutation();

interface FlashcardState {
  version: number;
  importCards: (deckName: string, source: string, cards: CardInput[]) => Promise<number>;
  deleteCard: (id: string) => Promise<void>;
  deleteDeck: (name: string) => Promise<number>;
  bump: () => void;
  togglePauseCategory: (category: string) => Promise<void>;
}

export const useStore = create<FlashcardState>((set) => ({
  version: 0,

  importCards: async (deckName, source, cards) => {
    const count = await cardMutation.addCards(deckName, source, cards);
    set(s => ({ version: s.version + 1 }));
    return count;
  },

  deleteCard: async (id) => {
    await cardMutation.deleteCard(id);
    set(s => ({ version: s.version + 1 }));
  },

  deleteDeck: async (name) => {
    const n = await cardMutation.deleteCardsByDeck(name);
    set(s => ({ version: s.version + 1 }));
    return n;
  },

  bump: () => set(s => ({ version: s.version + 1 })),

  togglePauseCategory: async (category) => {
    await cardMutation.togglePauseCategory(category);
    set(s => ({ version: s.version + 1 }));
  },
}));

export type { Flashcard, Deck, CardInput };
