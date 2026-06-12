import React, { useState, useEffect } from 'react';
import { useTaskQueue, type AiTask } from '../services/task-queue';
import { cardPresets } from '../services/preset-loader';
import { llmStorage } from '../services/llm-storage';
import { cardQuery, useStore } from '../store-instance';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader } from './ui/card';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Sparkles,
  Trash2,
  Download,
  Zap,
} from 'lucide-react';

const statusConfig: Record<string, { icon: React.ReactNode; label: string; borderClass: string }> = {
  running: {
    icon: <Loader2 className="h-4 w-4 animate-spin text-amber-500 shrink-0" />,
    label: 'Generating...',
    borderClass: 'border-l-amber-500',
  },
  done: {
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />,
    label: 'Complete',
    borderClass: 'border-l-emerald-500',
  },
  error: {
    icon: <XCircle className="h-4 w-4 text-red-500 shrink-0" />,
    label: 'Error',
    borderClass: 'border-l-red-500',
  },
};

const TaskCard: React.FC<{ task: AiTask }> = ({ task }) => {
  const { dismiss, addCards } = useTaskQueue();
  const cfg = statusConfig[task.status];

  return (
    <Card className={`border-l-2 ${cfg.borderClass}`}>
      <CardHeader className="flex-row items-center gap-3 pb-2">
        {cfg.icon}
        <Badge variant="outline" className="shrink-0 text-xs">
          {task.presetLabel}
        </Badge>
        <span className="text-xs text-muted-foreground">{cfg.label}</span>
        <span className="text-sm text-muted-foreground truncate flex-1">{task.question}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => dismiss(task.id)}
          className="h-6 w-6 p-0"
        >
          ×
        </Button>
      </CardHeader>

      {task.status === 'done' && task.cards.length > 0 && (
        <CardContent className="flex flex-col gap-2 pb-3">
          {task.cards.map((c, i) => (
            <Card key={i} className="bg-muted/50">
              <CardContent className="p-3">
                <div className="font-semibold text-sm mb-1">{c.question}</div>
                <div className="text-xs text-muted-foreground">{c.answer}</div>
                {c.category && (
                  <Badge variant="secondary" className="mt-2 text-xs">
                    {c.category}
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
          <Button
            variant="default"
            size="sm"
            onClick={() => addCards(task.id)}
            className="gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Import {task.cards.length} card{task.cards.length > 1 ? 's' : ''}
          </Button>
        </CardContent>
      )}

      {task.status === 'error' && (
        <CardContent className="text-xs text-destructive pb-3">{task.error}</CardContent>
      )}
    </Card>
  );
};

type Filter = 'all' | 'running' | 'done' | 'error';

export const AiCardsPage: React.FC = () => {
  const tasks = useTaskQueue(s => s.tasks);
  const enqueue = useTaskQueue(s => s.enqueue);
  const dismiss = useTaskQueue(s => s.dismiss);

  const [content, setContent] = useState('');
  const [presetIdx, setPresetIdx] = useState(0);
  const [deckId, setDeckId] = useState('');
  const [decks, setDecks] = useState<{ id: string; name: string }[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [configReady, setConfigReady] = useState(false);
  const version = useStore(s => s.version);

  useEffect(() => {
    cardQuery.getDecks().then(setDecks);
    llmStorage.getAll().then(cfgs => setConfigReady(cfgs.length > 0 && !!cfgs[0]?.baseURL));
  }, [version]);

  const handleGenerate = async () => {
    if (!content.trim()) return;
    const configs = await llmStorage.getAll();
    const config = configs[0];
    if (!config?.baseURL) return;
    const cats = await cardQuery.getCategoriesByDeck(deckId || undefined);
    enqueue(
      config,
      presetIdx,
      {
        question: content.trim(),
        answer: '',
        deck: decks.find(d => d.id === deckId)?.name || 'Default',
        category: '',
        tags: [],
      },
      { categories: cats },
    );
    setContent('');
  };

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);

  const counts = {
    all: tasks.length,
    running: tasks.filter(t => t.status === 'running').length,
    done: tasks.filter(t => t.status === 'done').length,
    error: tasks.filter(t => t.status === 'error').length,
  };

  const clearDone = () => {
    tasks.filter(t => t.status !== 'running').forEach(t => dismiss(t.id));
  };

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'running', label: 'Running' },
    { key: 'done', label: 'Done' },
    { key: 'error', label: 'Error' },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-400" />
            AI Card Studio
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Generate flashcards from topics, text, or custom prompts
          </p>
        </div>
        {counts.done + counts.error > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearDone}
            className="text-xs gap-1 text-muted-foreground hover:text-destructive shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear completed
          </Button>
        )}
      </div>

      {/* Generate Form */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <Textarea
            placeholder="Enter a topic, question, or paste text to generate flashcards..."
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={3}
            className="resize-none"
          />
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex flex-wrap gap-1.5">
              {cardPresets.map((p, i) => (
                <Badge
                  key={p.key}
                  variant={presetIdx === i ? 'default' : 'outline'}
                  className="cursor-pointer select-none"
                  onClick={() => setPresetIdx(i)}
                >
                  {p.label}
                </Badge>
              ))}
            </div>

            {decks.length > 0 && (
              <Select value={deckId} onValueChange={v => setDeckId(v === '_none' || v === null ? '' : v)}>
                <SelectTrigger className="h-7 text-xs w-32">
                  <SelectValue placeholder="Deck" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">No deck</SelectItem>
                  {decks.map(d => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={!content.trim() || !configReady}
              className="gap-1.5 shrink-0"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Generate
            </Button>
          </div>

          {!configReady && (
            <p className="text-xs text-muted-foreground">
              Configure an LLM provider in Settings to enable generation.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Task List */}
      <div>
        <div className="flex items-center gap-1 mb-4">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                filter === f.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              {f.label}
              {counts[f.key] > 0 && (
                <span
                  className={`inline-flex items-center justify-center h-4 min-w-4 rounded-full text-[10px] font-medium px-1 leading-none ${
                    filter === f.key ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {counts[f.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <Zap className="h-10 w-10 text-muted-foreground/20" />
            <span className="text-sm font-medium">
              {tasks.length === 0 ? 'No AI tasks yet' : `No ${filter} tasks`}
            </span>
            {tasks.length === 0 && (
              <p className="text-xs text-muted-foreground/60">
                Enter a topic above and click Generate to get started.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(t => (
              <TaskCard key={t.id} task={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
