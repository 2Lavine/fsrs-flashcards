import { create } from 'zustand';
import { getDB } from './db';
import { SqlCardQuery } from './services/SqlCardQuery';
import { SqlCardMutation } from './services/SqlCardMutation';
import type { Flashcard, Deck, ReviewEntry, CardInput } from './services/types';

let cardQuery: SqlCardQuery;
let cardMutation: SqlCardMutation;

export function initStore(): void {
  const db = getDB();
  cardQuery = new SqlCardQuery(db);
  cardMutation = new SqlCardMutation(db);
}

interface FlashcardState {
  version: number;
  importCards: (deckName: string, source: string, cards: CardInput[]) => number;
  deleteCard: (id: string) => void;
  deleteDeck: (name: string) => number;
  bump: () => void;
  togglePauseCategory: (category: string) => void;
}

export const useStore = create<FlashcardState>((set) => ({
  version: 0,

  importCards: (deckName, source, cards) => {
    const count = cardMutation.addCards(deckName, source, cards);
    set(s => ({ version: s.version + 1 }));
    return count;
  },

  deleteCard: (id) => {
    cardMutation.deleteCard(id);
    set(s => ({ version: s.version + 1 }));
  },

  deleteDeck: (name) => {
    const count = cardMutation.deleteCardsByDeck(name);
    set(s => ({ version: s.version + 1 }));
    return count;
  },

  bump: () => set(s => ({ version: s.version + 1 })),

  togglePauseCategory: (category) => {
    cardMutation.togglePauseCategory(category);
    set(s => ({ version: s.version + 1 }));
  },
}));

export { cardQuery, cardMutation, type Flashcard, type Deck, type ReviewEntry, type CardInput };
