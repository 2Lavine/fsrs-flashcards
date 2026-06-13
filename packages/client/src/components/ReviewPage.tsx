import React, { useEffect } from "react";
import type { Grade } from "ts-fsrs";
import { Rating } from "ts-fsrs";
import { formatDate, ratingLabel, renderCloze } from "../format";
import { useReviewHotkeys } from "../hooks/useReviewHotkeys";
import { toast } from "../hooks/useToast";
import { llmStorage } from "../services/llm-storage";
import { cardPresets } from "../services/preset-loader";
import { useTaskQueue } from "../services/task-queue";
import { cardQuery } from "../store-instance";
import { useReviewStore } from "../stores/review-store";
import { openImportModal } from "./ImportModal";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

const ratingStyles: Record<number, string> = {
  [Rating.Again]:
    "border-red-500/30 hover:border-red-500 hover:bg-red-500/10 hover:text-red-400",
  [Rating.Hard]:
    "border-amber-500/30 hover:border-amber-500 hover:bg-amber-500/10 hover:text-amber-400",
  [Rating.Good]:
    "border-emerald-500/30 hover:border-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-400",
  [Rating.Easy]:
    "border-sky-500/30 hover:border-sky-500 hover:bg-sky-500/10 hover:text-sky-400",
};

export const ReviewPage: React.FC = () => {
  const s = useReviewStore();
  const enqueue = useTaskQueue((s) => s.enqueue);
  const [customPrompt, setCustomPrompt] = React.useState('');

  useEffect(() => {
    s.init();
  }, []);

  useReviewHotkeys([
    {
      keys: "1",
      enabled: () => !!s.getCard() && s.getRevealed(),
      handler: () => s.rate(1 as Grade),
    },
    {
      keys: "2",
      enabled: () => !!s.getCard() && s.getRevealed(),
      handler: () => s.rate(2 as Grade),
    },
    {
      keys: "3",
      enabled: () => !!s.getCard() && s.getRevealed(),
      handler: () => s.rate(3 as Grade),
    },
    {
      keys: "4",
      enabled: () => !!s.getCard() && s.getRevealed(),
      handler: () => s.rate(4 as Grade),
    },
    {
      keys: "mod+z",
      enabled: () => s.getHistoryLength() > 0,
      handler: () => s.undo(),
    },
    {
      keys: "a",
      enabled: () => s.getHistoryLength() > 0,
      handler: () => s.undo(),
    },
    {
      keys: "space",
      enabled: () => !!s.getCard() && !s.getRevealed(),
      handler: () => s.reveal(),
    },
    {
      keys: "d",
      enabled: () => !!s.getCard(),
      handler: () => s.deleteCurrentCard(),
    },
  ]);

  const handleAi = async (presetIdx: number) => {
    const card = s.card;
    if (!card) return;
    const configs = await llmStorage.getAll();
    const config = configs[0];
    if (!config?.baseURL) {
      toast("Please configure LLM settings first");
      return;
    }
    const cats = await cardQuery.getCategoriesByDeck(card.deckId || undefined);
    enqueue(
      config,
      presetIdx,
      {
        question: card.question,
        answer: card.answer,
        deck: card.deck,
        category: card.category,
        tags: card.tags,
      },
      { categories: cats },
    );
  };

  const handleCustomAi = async () => {
    const card = s.card;
    if (!card || !customPrompt.trim()) return;
    const configs = await llmStorage.getAll();
    const config = configs[0];
    if (!config?.baseURL) { toast('Please configure LLM settings first'); return; }
    const cats = await cardQuery.getCategoriesByDeck(card.deckId || undefined);
    enqueue(config, -1, {
      question: card.question, answer: card.answer,
      deck: card.deck, category: card.category, tags: card.tags,
    }, { customPrompt: customPrompt.trim(), categories: cats });
    setCustomPrompt('');
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {!s.loaded ? (
        <>
          <div className="flex justify-between">
            {[1, 2, 3, 4, 5, 6].map((i) => (
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
              { num: s.stats.due, lbl: "Due", cls: "text-amber-400" },
              { num: s.stats.new, lbl: "New" },
              { num: s.stats.learning, lbl: "Learning" },
              { num: s.stats.review, lbl: "Review" },
              { num: s.stats.today, lbl: "Today" },
              { num: s.stats.total, lbl: "Total" },
            ].map((st) => (
              <div key={st.lbl} className="flex flex-col items-center gap-0.5">
                <span
                  className={`text-xl font-bold tabular-nums ${st.cls ?? ""}`}
                >
                  {st.num}
                </span>
                <span className="text-xs text-muted-foreground">{st.lbl}</span>
              </div>
            ))}
          </div>

          {/* Deck Filter */}
          {s.decks.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <Badge
                variant={s.deckId === "" ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => s.setDeckId("")}
              >
                All Decks
              </Badge>
              {s.decks.map((d) => (
                <Badge
                  key={d.id}
                  variant={s.deckId === d.id ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => s.setDeckId(d.id)}
                >
                  {d.name}
                </Badge>
              ))}
            </div>
          )}

          {/* Category Filter */}
          {s.categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <Badge
                variant={s.category === "" ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => s.setCategory("")}
              >
                All
              </Badge>
              {(s.showAllCats ? s.categories : s.categories.slice(0, 8)).map(
                (c) => {
                  const paused = s.pausedCategories.includes(c);
                  return (
                    <Badge
                      key={c}
                      variant={s.category === c ? "default" : "outline"}
                      className={`cursor-pointer ${paused ? "opacity-50 line-through" : ""}`}
                    >
                      <span onClick={() => s.setCategory(c)}>{c}</span>
                      <span
                        className="ml-1.5 text-xs opacity-60 hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          s.togglePauseCategory(c);
                        }}
                      >
                        {paused ? "▶" : "⏸"}
                      </span>
                    </Badge>
                  );
                },
              )}
              {s.categories.length > 8 && (
                <Badge
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => s.setShowAllCats(!s.showAllCats)}
                >
                  {s.showAllCats ? "收起" : `+${s.categories.length - 8} more`}
                </Badge>
              )}
            </div>
          )}

          {/* Card Stage */}
          <div className="flex flex-col gap-4">
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              {s.historyLength > 0 && (
                <Button variant="outline" size="sm" onClick={s.undo}>
                  Undo
                </Button>
              )}
              {cardPresets.map((p, i) => (
                <Button
                  key={p.key}
                  variant="outline"
                  size="sm"
                  onClick={() => handleAi(i)}
                >
                  {p.label}
                </Button>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={s.deleteCurrentCard}
              >
                Delete
              </Button>
            </div>

            {/* Card Display */}
            {s.deleting ? (
              <Skeleton className="h-48 rounded-lg" />
            ) : !s.card ? (
              s.stats.total === 0 ? (
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
                  onClick={() => !s.revealed && s.reveal()}
                >
                  {!s.revealed && (
                    <div className="text-xs text-muted-foreground absolute top-3 left-1/2 -translate-x-1/2">
                      Tap or Space to reveal
                    </div>
                  )}
                  {s.card.deck && (
                    <span className="absolute top-3 right-4 text-xs text-muted-foreground">
                      {s.card.deck}
                    </span>
                  )}
                  {s.card.category && (
                    <span className="absolute top-3 left-4 text-xs text-muted-foreground">
                      {s.card.category}
                    </span>
                  )}
                  <div
                    className="text-lg leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: renderCloze(s.card.question, s.revealed),
                    }}
                  />
                  {s.revealed && (
                    <div
                      className="mt-6 pt-6 border-t text-base leading-relaxed text-muted-foreground"
                      dangerouslySetInnerHTML={{
                        __html: renderCloze(s.card.answer, true),
                      }}
                    />
                  )}
                </div>

                {/* Source Content */}
                {s.card.source && (
                  <details open className="border rounded-lg p-4 bg-muted/30 text-sm text-muted-foreground mt-4">
                    <summary className="cursor-pointer font-medium text-foreground">
                      Source
                    </summary>
                    <div className="mt-2 max-h-64 overflow-y-auto [&_h1]:text-base [&_h1]:font-semibold [&_h1]:my-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:my-1.5 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:my-1 [&_pre]:bg-muted-foreground/10 [&_pre]:p-3 [&_pre]:rounded [&_pre]:overflow-x-auto [&_pre]:my-2 [&_pre]:text-xs [&_code]:bg-muted-foreground/10 [&_code]:px-1 [&_code]:rounded [&_code]:text-xs [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1 [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:my-2 [&_a]:underline [&_a]:text-foreground/80 [&_p]:my-1 [&_hr]:border-border [&_hr]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:my-2 [&_th]:border [&_th]:border-border [&_th]:p-1.5 [&_th]:text-left [&_th]:bg-muted-foreground/10 [&_td]:border [&_td]:border-border [&_td]:p-1.5 [&_img]:max-w-full [&_img]:rounded">
                      <ReactMarkdown rehypePlugins={[rehypeSanitize]} remarkPlugins={[remarkGfm]}>
                        {s.card.source}
                      </ReactMarkdown>
                    </div>
                  </details>
                )}

                {s.revealed && s.previewCache && (
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      {
                        key: Rating.Again,
                        cls: "again",
                        label: ratingLabel(1),
                        hint: "1",
                        desc: formatDate(s.previewCache[1]?.card.due),
                        style: ratingStyles[Rating.Again],
                      },
                      {
                        key: Rating.Hard,
                        cls: "hard",
                        label: ratingLabel(2),
                        hint: "2",
                        desc: formatDate(s.previewCache[2]?.card.due),
                        style: ratingStyles[Rating.Hard],
                      },
                      {
                        key: Rating.Good,
                        cls: "good",
                        label: ratingLabel(3),
                        hint: "3",
                        desc: formatDate(s.previewCache[3]?.card.due),
                        style: ratingStyles[Rating.Good],
                      },
                      {
                        key: Rating.Easy,
                        cls: "easy",
                        label: ratingLabel(4),
                        hint: "4",
                        desc: formatDate(s.previewCache[4]?.card.due),
                        style: ratingStyles[Rating.Easy],
                      },
                    ].map((r) => (
                      <Button
                        key={r.key}
                        variant="outline"
                        className={`flex-col h-auto py-3 px-2 gap-0.5 ${r.style} ${s.highlighted === r.key ? "ring-2 ring-ring" : ""}`}
                        onClick={() => s.rate(r.key as Grade)}
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

          {/* Custom Prompt — always visible */}
          <div className="flex flex-col gap-2">
            <textarea
              className="flex min-h-[80px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              placeholder='Ask anything — the LLM will turn it into flashcards. Use {question} and {answer} to reference the current card.'
              value={customPrompt}
              onChange={e => setCustomPrompt(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2 justify-end">
              <Button size="sm" onClick={handleCustomAi} disabled={!s.card || !customPrompt.trim()}>Generate</Button>
              <Button variant="outline" size="sm" onClick={() => setCustomPrompt('')}>Clear</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
