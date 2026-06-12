import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const decks = sqliteTable('decks', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  source: text('source').default(''),
  createdAt: text('created_at').notNull(),
});

export const cards = sqliteTable('cards', {
  id: text('id').primaryKey(),
  deckId: text('deck_id').notNull().references(() => decks.id),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  tags: text('tags').default('[]'),
  category: text('category').default(''),
  createdAt: text('created_at').notNull(),
  // FSRS fields
  fsrsDue: text('fsrs_due').notNull(),
  fsrsStability: real('fsrs_stability').default(0),
  fsrsDifficulty: real('fsrs_difficulty').default(0),
  fsrsElapsedDays: integer('fsrs_elapsed_days').default(0),
  fsrsScheduledDays: integer('fsrs_scheduled_days').default(0),
  fsrsReps: integer('fsrs_reps').default(0),
  fsrsLapses: integer('fsrs_lapses').default(0),
  fsrsState: integer('fsrs_state').default(0),
  fsrsLastReview: text('fsrs_last_review'),
  fsrsLearningSteps: integer('fsrs_learning_steps').default(0),
});

export const reviewLogs = sqliteTable('review_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  cardId: text('card_id').notNull().references(() => cards.id),
  rating: integer('rating').notNull(),
  state: integer('state').notNull(),
  due: text('due').notNull(),
  stability: real('stability').notNull(),
  difficulty: real('difficulty').notNull(),
  elapsedDays: integer('elapsed_days').notNull(),
  lastElapsedDays: integer('last_elapsed_days').notNull(),
  scheduledDays: integer('scheduled_days').notNull(),
  learningSteps: integer('learning_steps').notNull(),
  review: text('review').notNull(),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
