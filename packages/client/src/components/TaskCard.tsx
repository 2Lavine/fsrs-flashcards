import React, { useState } from 'react';
import { useTaskQueue, type AiTask } from '../services/task-queue';
import {
  CheckCircle2,
  ChevronDown,
  Download,
  Loader2,
  XCircle,
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader } from './ui/card';

const statusConfig: Record<string, { icon: React.ReactNode; label: string }> = {
  running: {
    icon: <Loader2 className="h-4 w-4 animate-spin text-amber-500 shrink-0" />,
    label: 'Generating...',
  },
  done: {
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />,
    label: 'Complete',
  },
  error: {
    icon: <XCircle className="h-4 w-4 text-red-500 shrink-0" />,
    label: 'Error',
  },
  imported: {
    icon: <Download className="h-4 w-4 text-blue-500 shrink-0" />,
    label: 'Imported',
  },
};

export const TaskCard: React.FC<{ task: AiTask }> = ({ task }) => {
  const { dismiss, addCards, addCard } = useTaskQueue();
  const cfg = statusConfig[task.status];
  const [expanded, setExpanded] = useState(false);
  const hasDetails = task.status === 'done' || task.status === 'error' || task.status === 'imported';

  return (
    <Card>
      <CardHeader
        className={`!flex !flex-row items-center gap-3 ${hasDetails ? 'cursor-pointer' : ''}`}
        onClick={() => hasDetails && setExpanded(!expanded)}
      >
        {cfg.icon}
        <Badge variant="outline" className="shrink-0 text-xs">
          {task.presetLabel}
        </Badge>
        <span className="text-xs text-muted-foreground">{cfg.label}</span>
        <span className="text-sm text-muted-foreground truncate flex-1">
          {task.question}
        </span>
        {hasDetails && (
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            dismiss(task.id);
          }}
          className="h-6 w-6 p-0"
        >
          ×
        </Button>
      </CardHeader>

      {expanded &&
        (task.status === 'done' || task.status === 'imported') &&
        task.cards.length > 0 && (
          <CardContent className="flex flex-col gap-2 pb-3">
            {task.cards.map((c, i) => {
              const imported = task.importedIndices.includes(i);
              return (
              <Card key={i} size="sm" className={`bg-muted/50 ${imported ? 'opacity-50' : ''}`}>
                <CardContent className="px-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-semibold text-sm mb-1">{c.question}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.answer}
                      </div>
                      {c.category && (
                        <Badge variant="secondary" className="mt-2 text-xs">
                          {c.category}
                        </Badge>
                      )}
                    </div>
                    {imported ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    ) : task.status === 'done' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-emerald-500"
                        onClick={() => addCard(task.id, i)}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
              );
            })}
            {task.status === 'done' && task.cards.some((_, i) => !task.importedIndices.includes(i)) && (
              <Button
                variant="default"
                size="sm"
                onClick={() => addCards(task.id)}
                className="gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                Import {task.cards.filter((_, i) => !task.importedIndices.includes(i)).length} card
                {task.cards.filter((_, i) => !task.importedIndices.includes(i)).length > 1 ? 's' : ''}
              </Button>
            )}
            {task.status === 'imported' && (
              <Badge
                variant="outline"
                className="self-start gap-1 text-xs text-blue-600 border-blue-300"
              >
                <CheckCircle2 className="h-3 w-3" />
                Imported {task.cards.length} card
                {task.cards.length > 1 ? 's' : ''} to {task.deck}
              </Badge>
            )}
          </CardContent>
        )}

      {expanded && task.status === 'error' && (
        <CardContent className="text-xs text-destructive pb-3">
          {task.error}
        </CardContent>
      )}
    </Card>
  );
};
