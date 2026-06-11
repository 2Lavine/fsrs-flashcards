import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Rating } from 'ts-fsrs';
import type { Grade } from 'ts-fsrs';
import { cardQuery, cardMutation, useStore } from '../store-instance';
import type { Flashcard } from '../services/types';
import { preview, review as doReview } from '../services/SchedulerService';
import { formatDate, renderCloze, ratingLabel } from '../format';
import { useReviewHotkeys } from '../hooks/useReviewHotkeys';
import { useHistory } from '../hooks/useHistory';

export const ReviewPage: React.FC = () => {
  const [category, setCategory] = useState('');
  const [deckId, setDeckId] = useState('');
  const [card, setCard] = useState<Flashcard | null>(null);
  const [previewCache, setPreviewCache] = useState<ReturnType<typeof preview> | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const [showAllCats, setShowAllCats] = useState(false);
  const [dueCards, setDueCards] = useState<Flashcard[]>([]);

  // Async data
  const [stats, setStats] = useState<ReturnType<typeof cardQuery.getStats> extends Promise<infer T> ? T : never>({ total: 0, due: 0, new: 0, learning: 0, review: 0, totalReviews: 0, today: 0, avgDifficulty: '-' });
  const [decks, setDecks] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [pausedCategories, setPausedCategories] = useState<string[]>([]);

  const history = useHistory();
  const version = useStore(s => s.version);
  const bump = useStore(s => s.bump);

  // Load data when version changes
  useEffect(() => {
    cardQuery.getStats().then(setStats);
    cardQuery.getDecks().then(setDecks);
    cardQuery.getPausedCategories().then(setPausedCategories);
  }, [version]);

  useEffect(() => {
    cardQuery.getCategoriesByDeck(deckId || undefined).then(cats => {
      setCategories(cats);
      if (category && !cats.includes(category)) setCategory('');
    });
  }, [version, deckId]);

  // Fetch due cards when version/category/deck changes
  useEffect(() => {
    cardQuery.getDueCards(category || undefined, pausedCategories, deckId || undefined).then(cards => {
      setDueCards(cards);
      const next = cards[0] ?? null;
      setCard(next);
      setPreviewCache(next ? preview(next) : null);
      setRevealed(false);
      setHighlighted(null);
    });
  }, [version, category, deckId]);

  // Advance to next card locally — no API call
  const advance = useCallback((afterCards?: Flashcard[]) => {
    const queue = afterCards ?? dueCards.slice(1);
    setDueCards(queue);
    const next = queue[0] ?? null;
    setCard(next);
    setPreviewCache(next ? preview(next) : null);
    setRevealed(false);
  }, [dueCards]);

  const handleRate = useCallback((r: Grade) => {
    if (!card || !previewCache) return;
    const prevFSRS = { ...card.fsrs, due: new Date(card.fsrs.due), last_review: card.fsrs.last_review ? new Date(card.fsrs.last_review) : undefined };
    const result = doReview(card, r);
    card.fsrs = result.card;
    cardMutation.recordReview(card.id, card.fsrs, r, result);
    history.push({ cardId: card.id, rating: r, prevFSRS });
    advance();
    setStats(s => ({ ...s, due: Math.max(0, s.due - 1), today: s.today + 1, totalReviews: s.totalReviews + 1 }));
  }, [card, previewCache, history, advance]);

  const handleUndo = useCallback(async () => {
    const last = history.pop();
    if (!last) return;
    await cardMutation.undoReview(last.cardId, last.prevFSRS);
    setHighlighted(last.rating);
    bump();
  }, [history, bump]);

  const handleDelete = useCallback(async () => {
    if (!card) return;
    cardMutation.deleteCard(card.id); // fire-and-forget
    // Advance locally
    setCard(null); setPreviewCache(null); setRevealed(false);
    cardQuery.getDueCards(category || undefined, pausedCategories, deckId || undefined).then(cards => {
      const next = cards[0] ?? null;
      setCard(next); setPreviewCache(next ? preview(next) : null);
      setStats(s => ({ ...s, due: Math.max(0, s.due - 1), total: s.total - 1 }));
    });
  }, [card, category, pausedCategories, deckId]);

  // Refs for keyboard
  const cardRef = useRef(card); cardRef.current = card;
  const revealedRef = useRef(revealed); revealedRef.current = revealed;
  const historyRef = useRef(history); historyRef.current = history;

  useReviewHotkeys([
    { keys: '1', enabled: () => !!cardRef.current && revealedRef.current, handler: () => handleRate(1 as Grade) },
    { keys: '2', enabled: () => !!cardRef.current && revealedRef.current, handler: () => handleRate(2 as Grade) },
    { keys: '3', enabled: () => !!cardRef.current && revealedRef.current, handler: () => handleRate(3 as Grade) },
    { keys: '4', enabled: () => !!cardRef.current && revealedRef.current, handler: () => handleRate(4 as Grade) },
    { keys: 'mod+z', enabled: () => historyRef.current.length > 0, handler: () => { const l = historyRef.current.pop(); if (l) { cardMutation.undoReview(l.cardId, l.prevFSRS); bump(); } } },
    { keys: 'a', enabled: () => historyRef.current.length > 0, handler: () => { const l = historyRef.current.pop(); if (l) { cardMutation.undoReview(l.cardId, l.prevFSRS); bump(); } } },
    { keys: 'space', enabled: () => !!cardRef.current && !revealedRef.current, handler: () => setRevealed(true) },
    { keys: 'd', enabled: () => !!cardRef.current, handler: () => { const c = cardRef.current; if (c) { cardMutation.deleteCard(c.id); bump(); } } },
  ]);

  const togglePause = (cat: string) => { useStore.getState().togglePauseCategory(cat); };

  return (
    <>
      <div className="stats-bar">
        <div className="stat"><div className="num due">{stats.due}</div><div className="lbl">Due</div></div>
        <div className="stat"><div className="num">{stats.new}</div><div className="lbl">New</div></div>
        <div className="stat"><div className="num">{stats.learning}</div><div className="lbl">Learning</div></div>
        <div className="stat"><div className="num">{stats.review}</div><div className="lbl">Review</div></div>
        <div className="stat"><div className="num accent">{stats.today}</div><div className="lbl">Today</div></div>
        <div className="stat"><div className="num">{stats.total}</div><div className="lbl">Total</div></div>
      </div>

      {decks.length > 1 && (
        <div className="category-filter">
          <span className={`category-chip ${deckId === '' ? 'active' : ''}`} onClick={() => { setDeckId(''); setShowAllCats(false); }}>All Decks</span>
          {decks.map(d => <span key={d.id} className={`category-chip ${deckId === d.id ? 'active' : ''}`} onClick={() => { setDeckId(d.id); setShowAllCats(false); }}>{d.name}</span>)}
        </div>
      )}

      {categories.length > 0 && (
        <div className="category-filter">
          <span className={`category-chip ${category === '' ? 'active' : ''}`} onClick={() => setCategory('')}>All</span>
          {(showAllCats ? categories : categories.slice(0, 8)).map(c => (
            <span key={c} className={`category-chip ${category === c ? 'active' : ''} ${pausedCategories.includes(c) ? 'paused' : ''}`}>
              <span onClick={() => setCategory(c)}>{c}</span>
              <span className="pause-toggle" onClick={e => { e.stopPropagation(); togglePause(c); }}>{pausedCategories.includes(c) ? '▶' : '⏸'}</span>
            </span>
          ))}
          {categories.length > 8 && (
            <span className="category-chip" onClick={() => setShowAllCats(!showAllCats)}>
              {showAllCats ? '收起' : `+${categories.length - 8} more`}
            </span>
          )}
        </div>
      )}

      <div className="card-stage">
        <div className="review-actions">
          {history.length > 0 && <button className="btn small" onClick={handleUndo} title="Undo (A or Ctrl+Z)">Undo</button>}
          <button className="btn small danger" onClick={handleDelete} title="Delete (D)">Delete</button>
        </div>

        {!card ? (
          stats.total === 0 ? (
            <div className="empty-state">
              <div className="icon">📝</div>
              <div>No cards yet</div>
              <button className="btn primary" onClick={() => document.getElementById('import-modal')!.classList.add('active')}>Import Cards</button>
            </div>
          ) : (
            <div className="empty-state"><div className="icon">🎉</div><div>All caught up!</div></div>
          )
        ) : (
          <>
            <div className={`flashcard ${revealed ? 'revealed' : ''}`} onClick={() => !revealed && setRevealed(true)}>
              {!revealed && <div className="hint">Tap or Space to reveal</div>}
              {card.deck && <div className="deck-tag">{card.deck}</div>}
              {card.category && <div className="deck-tag" style={{ right: 'auto', left: 18, top: 16 }}>{card.category}</div>}
              <div dangerouslySetInnerHTML={{ __html: renderCloze(card.question, revealed) }} />
              {revealed && <div className="answer-divider" dangerouslySetInnerHTML={{ __html: renderCloze(card.answer, true) }} />}
            </div>
            {revealed && previewCache && (
              <div className="ratings">
                {[
                  { key: Rating.Again, cls: 'again', label: ratingLabel(1), hint: '1', desc: formatDate(previewCache[1]?.card.due) },
                  { key: Rating.Hard, cls: 'hard', label: ratingLabel(2), hint: '2', desc: formatDate(previewCache[2]?.card.due) },
                  { key: Rating.Good, cls: 'good', label: ratingLabel(3), hint: '3', desc: formatDate(previewCache[3]?.card.due) },
                  { key: Rating.Easy, cls: 'easy', label: ratingLabel(4), hint: '4', desc: formatDate(previewCache[4]?.card.due) },
                ].map(r => (
                  <button key={r.key} className={`${r.cls} ${highlighted === r.key ? 'highlighted' : ''}`} onClick={() => handleRate(r.key as Grade)}>
                    <span className="key-hint">{r.hint}</span>{r.label}<span className="days">{r.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};
