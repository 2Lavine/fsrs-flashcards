import React from 'react';
import { useTaskQueue } from '../services/task-queue';
import type { AiTask } from '../services/task-queue';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader } from './ui/card';
import { Badge } from './ui/badge';
import { Loader2 } from 'lucide-react';

const statusColors: Record<string, string> = {
  running: 'border-l-amber-500',
  done: 'border-l-emerald-500',
  error: 'border-l-red-500',
};

const TaskCard: React.FC<{ task: AiTask }> = ({ task }) => {
  const { dismiss, addCards } = useTaskQueue();

  return (
    <Card className={`border-l-2 ${statusColors[task.status]}`}>
      <CardHeader className="flex-row items-center gap-3 pb-2">
        <Badge variant="outline" className="shrink-0 text-xs">{task.presetLabel}</Badge>
        <span className="text-sm text-muted-foreground truncate flex-1">{task.question}</span>
        <Button variant="ghost" size="sm" onClick={() => dismiss(task.id)} className="h-6 w-6 p-0">×</Button>
      </CardHeader>

      {task.status === 'running' && (
        <CardContent className="flex items-center gap-2 text-xs text-muted-foreground pb-3">
          <Loader2 className="animate-spin h-3 w-3" />
          <span>Generating...</span>
        </CardContent>
      )}

      {task.status === 'error' && (
        <CardContent className="text-xs text-destructive pb-3">{task.error}</CardContent>
      )}

      {task.status === 'done' && task.cards.length > 0 && (
        <CardContent className="flex flex-col gap-2 pb-3">
          {task.cards.map((c, i) => (
            <Card key={i} className="bg-muted/50">
              <CardContent className="p-3">
                <div className="font-semibold text-sm mb-1">{c.question}</div>
                <div className="text-xs text-muted-foreground">{c.answer}</div>
                {c.category && (
                  <Badge variant="secondary" className="mt-2 text-xs">{c.category}</Badge>
                )}
              </CardContent>
            </Card>
          ))}
          <Button variant="default" size="sm" onClick={() => addCards(task.id)}>
            Import {task.cards.length} card{task.cards.length > 1 ? 's' : ''}
          </Button>
        </CardContent>
      )}
    </Card>
  );
};

export const AiCardList: React.FC = () => {
  const tasks = useTaskQueue(s => s.tasks);

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <span className="text-4xl opacity-20">📭</span>
        <span>No AI tasks yet</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {tasks.map(t => <TaskCard key={t.id} task={t} />)}
    </div>
  );
};
