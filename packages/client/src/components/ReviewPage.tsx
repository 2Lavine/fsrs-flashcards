import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Rating } from 'ts-fsrs';
import type { Grade } from 'ts-fsrs';
import { cardQuery, cardMutation, useStore } from '../store-instance';
import type { Flashcard } from '@fsrs/shared';
import { preview, review as doReview } from '../services/SchedulerService';
import { formatDate, renderCloze, ratingLabel } from '../format';
import { useReviewHotkeys } from '../hooks/useReviewHotkeys';
import { useHistory } from '../hooks/useHistory';
import { cardPresets } from '../services/preset-loader';
import { llmStorage } from '../services/llm-storage';
import { useTaskQueue } from '../services/task-queue';
import { toast } from '../hooks/useToast';
import { openImportModal } from './ImportModal';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { Skeleton } from './ui/skeleton';

const ratingStyles: Record<number, string> = {
  [Rating.Again]: 'border-red-500/30 hover:border-red-500 hover:bg-red-500/10 hover:text-red-400',
  [Rating.Hard]: 'border-amber-500/30 hover:border-amber-500 hover:bg-amber-500/10 hover:text-amber-400',
  [Rating.Good]: 'border-emerald-500/30 hover:border-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-400',
  [Rating.Easy]: 'border-sky-500/30 hover:border-sky-500 hover:bg-sky-500/10 hover:text-sky-400',
};

export const ReviewPage: React.FC = () => {
  const [category, setCategory] = useState('');
  const [deckId, setDeckId] = useState('');
  const [card, setCard] = useState<Flashcard | null>(null);
  const [previewCache, setPreviewCache] = useState<ReturnType<typeof preview> | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const [showAllCats, setShowAllCats] = useState(false);
  const [dueCards, setDueCards] = useState<Flashcard[]>([]);
  const enqueue = useTaskQueue(s => s.enqueue);
  const [customOpen, setCustomOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');

  type StatsData = { total: number; due: number; new: number; learning: number; review: number; totalReviews: number; today: number; avgDifficulty: string };
  const [stats, setStats] = useState<StatsData>({ total: 0, due: 0, new: 0, learning: 0, review: 0, totalReviews: 0, today: 0, avgDifficulty: '-' });
  const [decks, setDecks] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [pausedCategories, setPausedCategories] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  const history = useHistory();
  const version = useStore(s => s.version);
  const bump = useStore(s => s.bump);

  useEffect(() => {
    Promise.all([
      cardQuery.getStats().then(setStats),
      cardQuery.getDecks().then(setDecks),
      cardQuery.getPausedCategories().then(setPausedCategories),
    ]).then(() => setLoaded(true));
  }, [version]);

  useEffect(() => {
    cardQuery.getCategoriesByDeck(deckId || undefined).then(cats => {
      setCategories(cats);
      if (category && !cats.includes(category)) setCategory('');
    });
  }, [version, deckId]);

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
    cardMutation.recordReview(card.id, card.fsrs, r, result.log);
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
    cardMutation.deleteCard(card.id);
    setCard(null); setPreviewCache(null); setRevealed(false);
    cardQuery.getDueCards(category || undefined, pausedCategories, deckId || undefined).then(cards => {
      const next = cards[0] ?? null;
      setCard(next); setPreviewCache(next ? preview(next) : null);
      setStats(s => ({ ...s, due: Math.max(0, s.due - 1), total: s.total - 1 }));
    });
  }, [card, category, pausedCategories, deckId]);

  const handleAi = async (presetIdx: number) => {
    if (!card) return;
    const configs = await llmStorage.getAll();
    const config = configs[0];
    if (!config?.baseURL) { toast('Please configure LLM settings first'); return; }
    const cats = await cardQuery.getCategoriesByDeck(card.deckId || undefined);
    enqueue(config, presetIdx, {
      question: card.question,
      answer: card.answer,
      deck: card.deck,
      category: card.category,
      tags: card.tags,
    }, { categories: cats });
  };

  const handleCustomAi = async () => {
    if (!card || !customPrompt.trim()) return;
    const configs = await llmStorage.getAll();
    const config = configs[0];
    if (!config?.baseURL) { toast('Please configure LLM settings first'); return; }
    const cats = await cardQuery.getCategoriesByDeck(card.deckId || undefined);
    enqueue(config, -1, {
      question: card.question,
      answer: card.answer,
      deck: card.deck,
      category: card.category,
      tags: card.tags,
    }, { customPrompt: customPrompt.trim(), categories: cats });
    setCustomOpen(false);
    setCustomPrompt('');
  };

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
    <div className="flex flex-col gap-6">
      {!loaded ? (
        <>
          <div className="flex justify-between">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="flex flex-col items-center gap-1">
                <Skeleton className="h-7 w-10" />
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </div>
          <Skeleton className="h-48 rounded-lg" />
        </>
      ) : (
        <>
          {/* Stats Bar */}
          <div className="flex justify-between text-center">
            {[
              { num: stats.due, lbl: 'Due', cls: 'text-amber-400' },
              { num: stats.new, lbl: 'New' },
              { num: stats.learning, lbl: 'Learning' },
              { num: stats.review, lbl: 'Review' },
              { num: stats.today, lbl: 'Today' },
          { num: stats.total, lbl: 'Total' },
        ].map(s => (
          <div key={s.lbl} className="flex flex-col items-center gap-0.5">
            <span className={`text-xl font-bold tabular-nums ${s.cls ?? ''}`}>{s.num}</span>
            <span className="text-xs text-muted-foreground">{s.lbl}</span>
          </div>
        ))}
      </div>

      {/* Deck Filter */}
      {decks.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <Badge variant={deckId === '' ? 'default' : 'outline'} className="cursor-pointer" onClick={() => { setDeckId(''); setShowAllCats(false); }}>All Decks</Badge>
          {decks.map(d => (
            <Badge key={d.id} variant={deckId === d.id ? 'default' : 'outline'} className="cursor-pointer" onClick={() => { setDeckId(d.id); setShowAllCats(false); }}>{d.name}</Badge>
          ))}
        </div>
      )}

      {/* Category Filter */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <Badge variant={category === '' ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setCategory('')}>All</Badge>
          {(showAllCats ? categories : categories.slice(0, 8)).map(c => {
            const paused = pausedCategories.includes(c);
            return (
              <Badge
                key={c}
                variant={category === c ? 'default' : 'outline'}
                className={`cursor-pointer ${paused ? 'opacity-50 line-through' : ''}`}
              >
                <span onClick={() => setCategory(c)}>{c}</span>
                <span className="ml-1.5 text-xs opacity-60 hover:opacity-100" onClick={e => { e.stopPropagation(); togglePause(c); }}>
                  {paused ? '▶' : '⏸'}
                </span>
              </Badge>
            );
          })}
          {categories.length > 8 && (
            <Badge variant="outline" className="cursor-pointer" onClick={() => setShowAllCats(!showAllCats)}>
              {showAllCats ? '收起' : `+${categories.length - 8} more`}
            </Badge>
          )}
        </div>
      )}

      {/* Card Stage */}
      <div className="flex flex-col gap-4">
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {history.length > 0 && <Button variant="outline" size="sm" onClick={handleUndo}>Undo</Button>}
          {cardPresets.map((p, i) => (
            <Button key={p.key} variant="outline" size="sm" onClick={() => handleAi(i)}>{p.label}</Button>
          ))}
          <Button variant="outline" size="sm" onClick={() => setCustomOpen(!customOpen)}>Custom</Button>
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={handleDelete}>Delete</Button>
        </div>

        {/* Custom Prompt */}
        {customOpen && card && (
          <div className="flex flex-col gap-2">
            <Textarea
              placeholder={`Describe how to rewrite this card...\nUse {question} and {answer} as placeholders.\nOutput JSON: {"cards":[{"question":"...","answer":"...","category":"..."}]}`}
              value={customPrompt}
              onChange={e => setCustomPrompt(e.target.value)}
              rows={4}
            />
            <div className="flex gap-2 justify-end">
              <Button size="sm" onClick={handleCustomAi} disabled={!customPrompt.trim()}>Generate</Button>
              <Button variant="outline" size="sm" onClick={() => { setCustomOpen(false); setCustomPrompt(''); }}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Card Display */}
        {!card ? (
          stats.total === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <span className="text-4xl opacity-20">📝</span>
              <span>No cards yet</span>
              <Button onClick={openImportModal}>Import Cards</Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <span className="text-4xl opacity-20">🎉</span>
              <span>All caught up!</span>
            </div>
          )
        ) : (
          <>
            <div
              className="relative border rounded-lg p-8 pt-10 pb-12 min-h-[200px] cursor-pointer"
              onClick={() => !revealed && setRevealed(true)}
            >
              {!revealed && <div className="text-xs text-muted-foreground absolute top-3 left-1/2 -translate-x-1/2">Tap or Space to reveal</div>}
              {card.deck && <span className="absolute top-3 right-4 text-xs text-muted-foreground">{card.deck}</span>}
              {card.category && <span className="absolute top-3 left-4 text-xs text-muted-foreground">{card.category}</span>}
              <div className="text-lg leading-relaxed" dangerouslySetInnerHTML={{ __html: renderCloze(card.question, revealed) }} />
              {revealed && (
                <div className="mt-6 pt-6 border-t text-base leading-relaxed text-muted-foreground" dangerouslySetInnerHTML={{ __html: renderCloze(card.answer, true) }} />
              )}
            </div>

            {revealed && previewCache && (
              <div className="grid grid-cols-4 gap-2">
                {[
                  { key: Rating.Again, cls: 'again', label: ratingLabel(1), hint: '1', desc: formatDate(previewCache[1]?.card.due), style: ratingStyles[Rating.Again] },
                  { key: Rating.Hard, cls: 'hard', label: ratingLabel(2), hint: '2', desc: formatDate(previewCache[2]?.card.due), style: ratingStyles[Rating.Hard] },
                  { key: Rating.Good, cls: 'good', label: ratingLabel(3), hint: '3', desc: formatDate(previewCache[3]?.card.due), style: ratingStyles[Rating.Good] },
                  { key: Rating.Easy, cls: 'easy', label: ratingLabel(4), hint: '4', desc: formatDate(previewCache[4]?.card.due), style: ratingStyles[Rating.Easy] },
                ].map(r => (
                  <Button
                    key={r.key}
                    variant="outline"
                    className={`flex-col h-auto py-3 px-2 gap-0.5 ${r.style} ${highlighted === r.key ? 'ring-2 ring-ring' : ''}`}
                    onClick={() => handleRate(r.key as Grade)}
                  >
                    <span className="text-xs opacity-50">{r.hint}</span>
                    <span className="font-semibold text-sm">{r.label}</span>
                    <span className="text-xs opacity-50">{r.desc}</span>
                  </Button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
        </>
      )}
    </div>
  );
};
