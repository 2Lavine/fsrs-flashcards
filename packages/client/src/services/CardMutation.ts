import type { Card } from 'ts-fsrs';
import { api } from '../db';
import type { CardInput, ICardMutation } from '@fsrs/shared';

function fsrsPayload(fsrs: Card) {
  return {
    due: fsrs.due.toISOString(), stability: fsrs.stability, difficulty: fsrs.difficulty,
    elapsed_days: fsrs.elapsed_days, scheduled_days: fsrs.scheduled_days,
    reps: fsrs.reps, lapses: fsrs.lapses, state: fsrs.state,
    last_review: fsrs.last_review?.toISOString() ?? null,
    learning_steps: fsrs.learning_steps,
  };
}

export class CardMutation implements ICardMutation {
  async addCards(deckName: string, source: string, cards: CardInput[]) {
    const r = await api.importCards({ deck: deckName, source, cards });
    return r.imported;
  }

  async updateCardFSRS(_id: string, _fsrs: Card) {
    // No-op: recordReview() handles the write
  }

  async insertReviewLog(_cid: string, _rating: number, _result: unknown) {
    // No-op: review() handles both writes
  }

  async recordReview(id: string, fsrs: Card, rating: number, log: { elapsed_days: number; last_elapsed_days: number; scheduled_days: number; learning_steps: number; review: Date }) {
    await api.review({
      cardId: id, rating,
      fsrs: fsrsPayload(fsrs),
      log: { ...log, review: log.review.toISOString() },
    });
  }

  async deleteCard(id: string) { await api.deleteCard(id); }
  async deleteCardsByDeck(name: string) { await api.deleteDeck(name); return 1; }

  async undoReview(id: string, prevFSRS: { due: Date; stability: number; difficulty: number; elapsed_days: number; scheduled_days: number; reps: number; lapses: number; state: number; last_review?: Date; learning_steps: number }) {
    await api.undo({ cardId: id, prevFSRS: { ...prevFSRS, due: prevFSRS.due.toISOString(), last_review: prevFSRS.last_review?.toISOString() ?? null } });
  }

  async togglePauseCategory(cat: string) { await api.togglePause(cat); }
}
