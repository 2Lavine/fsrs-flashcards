import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Rating } from 'ts-fsrs';
import type { Grade } from 'ts-fsrs';
import { cardQuery, cardMutation, useStore } from '../store-instance';
import type { Flashcard } from '../services/types';
import { preview, review as doReview } from '../services/SchedulerService';
import { formatDate, renderCloze, ratingLabel } from '../format';
import { persist } from '../db';
import { useReviewHotkeys } from '../hooks/useReviewHotkeys';
import { useHistory } from '../hooks/useHistory';

export const ReviewPage: React.FC = () => {
  const [category, setCategory] = useState('');
  const [deckId, setDeckId] = useState('');
  const [card, setCard] = useState<Flashcard | null>(null);
  const [previewCache, setPreviewCache] = useState<ReturnType<typeof preview> | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const history = useHistory();

  const version = useStore(s => s.version);
  const bump = useStore(s => s.bump);

  const undoingRef = useRef(false);

  const pickCard = useCallback(() => {
    const paused = cardQuery.getPausedCategories();
    const due = cardQuery.getDueCards(category || undefined, paused, deckId || undefined);
    const next = due[0] ?? null;
    setCard(next);
    setPreviewCache(next ? preview(next) : null);
    if (undoingRef.current) {
      undoingRef.current = false;
      // Keep revealed=true so answer + highlighted rating shows
    } else {
      setRevealed(false);
      setHighlighted(null);
    }
  }, [category, deckId]);

  useEffect(() => { pickCard(); }, [version, pickCard]);

  const handleRate = useCallback((r: Grade) => {
    if (!card || !previewCache) return;
    const prevFSRS = { ...card.fsrs, due: new Date(card.fsrs.due), last_review: card.fsrs.last_review ? new Date(card.fsrs.last_review) : undefined };
    const result = doReview(card, r);
    card.fsrs = result.card;
    cardMutation.updateCardFSRS(card);
    cardMutation.insertReviewLog(card, r, result);
    history.push({ cardId: card.id, rating: r, prevFSRS });
    persist();
    bump();
  }, [card, previewCache, bump, history]);

  const handleUndo = useCallback(() => {
    const last = history.pop();
    if (!last) return;
    cardMutation.undoReview(last.cardId, last.prevFSRS);
    setHighlighted(last.rating);
    undoingRef.current = true;
    persist();
    bump();
  }, [history, bump]);

  const handleDelete = useCallback(() => {
    if (!card) return;
    cardMutation.deleteCard(card.id);
    persist();
    bump();
  }, [card, bump]);

  // Refs so keyboard listener always has latest values
  const cardRef = useRef(card);
  const revealedRef = useRef(revealed);
  const historyRef = useRef(history);
  cardRef.current = card;
  revealedRef.current = revealed;
  historyRef.current = history;

  const doRate = (r: Grade) => {
    const c = cardRef.current;
    if (!c) return;
    const prevFSRS = { ...c.fsrs, due: new Date(c.fsrs.due), last_review: c.fsrs.last_review ? new Date(c.fsrs.last_review) : undefined };
    const result = doReview(c, r);
    c.fsrs = result.card;
    cardMutation.updateCardFSRS(c);
    cardMutation.insertReviewLog(c, r, result);
    historyRef.current.push({ cardId: c.id, rating: r, prevFSRS });
    persist();
    bump();
  };

  // Keyboard shortcuts
  useReviewHotkeys([
    {
      keys: '1',
      enabled: () => !!cardRef.current && revealedRef.current,
      handler: () => doRate(1 as Grade),
    },
    {
      keys: '2',
      enabled: () => !!cardRef.current && revealedRef.current,
      handler: () => doRate(2 as Grade),
    },
    {
      keys: '3',
      enabled: () => !!cardRef.current && revealedRef.current,
      handler: () => doRate(3 as Grade),
    },
    {
      keys: '4',
      enabled: () => !!cardRef.current && revealedRef.current,
      handler: () => doRate(4 as Grade),
    },
    {
      keys: 'mod+z',
      enabled: () => historyRef.current.length > 0,
      handler: () => {
        const last = historyRef.current.pop();
        if (!last) return;
        cardMutation.undoReview(last.cardId, last.prevFSRS);
        setHighlighted(last.rating);
        undoingRef.current = true;
        persist();
        bump();
      },
    },
    {
      keys: 'a',
      enabled: () => historyRef.current.length > 0,
      handler: () => {
        const last = historyRef.current.pop();
        if (!last) return;
        cardMutation.undoReview(last.cardId, last.prevFSRS);
        setHighlighted(last.rating);
        undoingRef.current = true;
        persist();
        bump();
      },
    },
    {
      keys: 'space',
      enabled: () => !!cardRef.current && !revealedRef.current,
      handler: () => setRevealed(true),
    },
    {
      keys: 'd',
      enabled: () => !!cardRef.current,
      handler: () => { const c = cardRef.current; if (c) { cardMutation.deleteCard(c.id); persist(); bump(); } },
    },
  ]);

  const stats = cardQuery.getStats();
  const decks = cardQuery.getDecks();
  const categoryTree = cardQuery.getCategoryTree();
  const pausedCategories = cardQuery.getPausedCategories();

  const togglePause = (cat: string) => {
    useStore.getState().togglePauseCategory(cat);
    persist();
  };

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

      {card && stats.due > 0 && (
        <div className="today-progress">
          <div className="today-progress-fill" style={{ width: `${Math.min(100, (stats.today / (stats.due + stats.today)) * 100)}%` }} />
        </div>
      )}

      {decks.length > 1 && (
        <div className="category-filter">
          <span className={`category-chip ${deckId === '' ? 'active' : ''}`} onClick={() => setDeckId('')}>All Decks</span>
          {decks.map(d => (
            <span key={d.id} className={`category-chip ${deckId === d.id ? 'active' : ''}`} onClick={() => setDeckId(d.id)}>{d.name}</span>
          ))}
        </div>
      )}

      {categoryTree.length > 0 && (
        <div className="category-filter">
          <span className={`category-chip ${category === '' ? 'active' : ''}`} onClick={() => setCategory('')}>All</span>
          {categoryTree.map(root => {
            const rootPaused = pausedCategories.includes(root.name);
            const hasChildren = root.children.length > 0;
            return (
              <span key={root.name} className="category-group">
                <span className={`category-chip ${category === root.name ? 'active' : ''} ${rootPaused ? 'paused' : ''}`}>
                  <span onClick={() => setCategory(root.name)}>{root.name}</span>
                  <span className="category-count">{root.count}</span>
                  <span className="pause-toggle" onClick={(e) => { e.stopPropagation(); togglePause(root.name); }} title={rootPaused ? 'Resume' : 'Pause'}>
                    {rootPaused ? '▶' : '⏸'}
                  </span>
                </span>
                {category !== '' && category !== root.name && hasChildren && (
                  <span className="subcategory-chips">
                    {root.children.map(child => {
                      const childPaused = pausedCategories.includes(child.fullPath);
                      return (
                        <span key={child.fullPath} className={`category-chip sub ${category === child.fullPath ? 'active' : ''} ${childPaused ? 'paused' : ''}`}>
                          <span onClick={() => setCategory(child.fullPath)}>{child.name}</span>
                          <span className="category-count">{child.count}</span>
                          <span className="pause-toggle" onClick={(e) => { e.stopPropagation(); togglePause(child.fullPath); }} title={childPaused ? 'Resume' : 'Pause'}>
                            {childPaused ? '▶' : '⏸'}
                          </span>
                        </span>
                      );
                    })}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      )}

      <div className="card-stage">
        <div className="review-actions">
          {history.length > 0 && (
            <button className="btn small" onClick={handleUndo} title="Undo (Ctrl+Z or A)">Undo</button>
          )}
          <button className="btn small danger" onClick={handleDelete} title="Delete (D)">Delete</button>
        </div>
        {!card ? (
          stats.total === 0 ? (
            <div className="empty-state">
              <div className="icon">📝</div>
              <div>No cards yet</div>
              <div style={{ fontSize: '0.85rem' }}>Generate some flashcards with Claude, then import them here.</div>
              <button className="btn primary" onClick={() => document.getElementById('import-modal')!.classList.add('active')}>Import Cards</button>
            </div>
          ) : (
            <div className="empty-state">
              <div className="icon">🎉</div>
              <div>All caught up{category ? ` in "${category}"` : ''}!</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text2)' }}>{stats.total} cards total · {stats.totalReviews} reviews</div>
            </div>
          )
        ) : (
          <>
            <div
              className={`flashcard ${revealed ? 'revealed' : ''}`}
              onClick={() => !revealed && setRevealed(true)}
            >
              {!revealed && <div className="hint">Tap or Space to reveal</div>}
              {card.deck && <div className="deck-tag">{card.deck}</div>}
              {card.category && <div className="deck-tag" style={{ right: 'auto', left: 18, top: 16 }}>{card.category}</div>}
              <div dangerouslySetInnerHTML={{ __html: renderCloze(card.question, revealed) }} />
              {revealed && (
                <div className="answer-divider" dangerouslySetInnerHTML={{ __html: renderCloze(card.answer, true) }} />
              )}
            </div>

            {revealed && previewCache && (
              <div className="ratings">
                {[
                  { key: Rating.Again, cls: 'again', label: ratingLabel(1), hint: '1', desc: formatDate(previewCache[1]?.card.due) },
                  { key: Rating.Hard, cls: 'hard', label: ratingLabel(2), hint: '2', desc: formatDate(previewCache[2]?.card.due) },
                  { key: Rating.Good, cls: 'good', label: ratingLabel(3), hint: '3', desc: formatDate(previewCache[3]?.card.due) },
                  { key: Rating.Easy, cls: 'easy', label: ratingLabel(4), hint: '4', desc: formatDate(previewCache[4]?.card.due) },
                ].map(r => (
                  <button
                    key={r.key}
                    className={`${r.cls} ${highlighted === r.key ? 'highlighted' : ''}`}
                    onClick={() => handleRate(r.key as Grade)}
                  >
                    <span className="key-hint">{r.hint}</span>
                    {r.label}
                    <span className="days">{r.desc}</span>
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
