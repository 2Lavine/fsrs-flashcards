import {
  CheckCircle2,
  ChevronDown,
  Download,
  Loader2,
  XCircle,
  Zap,
} from "lucide-react";
import React, { useState } from "react";
import { useTaskQueue, type AiTask } from "../services/task-queue";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";

const statusConfig: Record<string, { icon: React.ReactNode }> = {
  running: {
    icon: <Loader2 className="h-3 w-3 animate-spin text-amber-500 shrink-0" />,
  },
  done: {
    icon: <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />,
  },
  error: { icon: <XCircle className="h-3 w-3 text-red-500 shrink-0" /> },
};

const MiniTask: React.FC<{ task: AiTask; onClick?: () => void }> = ({
  task,
  onClick,
}) => {
  const { dismiss, addCards } = useTaskQueue();
  const cfg = statusConfig[task.status];
  const [expanded, setExpanded] = useState(false);
  const hasCards = task.status === "done" && task.cards.length > 0;

  return (
    <div
      className={`pl-3 py-2.5 group/row hover:bg-accent/50 transition-colors cursor-pointer`}
      onClick={() => {
        if (hasCards) setExpanded(!expanded);
        else onClick?.();
      }}
    >
      <div className="flex items-center gap-1.5">
        {cfg.icon}
        <span className="text-xs font-medium truncate flex-1">
          {task.presetLabel}
        </span>
        {hasCards && (
          <span className="text-[10px] text-muted-foreground shrink-0">
            {task.cards.length}c
          </span>
        )}
        {hasCards && (
          <ChevronDown
            className={`h-3 w-3 text-muted-foreground shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            dismiss(task.id);
          }}
          className="h-5 w-5 p-0 opacity-0 group-hover/row:opacity-100 shrink-0 text-muted-foreground hover:text-foreground"
        >
          ×
        </Button>
      </div>

      {task.status === "running" && (
        <p className="text-[11px] text-muted-foreground mt-0.5 ml-5 truncate">
          {task.question}
        </p>
      )}

      {expanded && hasCards && (
        <div className="mt-2 flex flex-col gap-1.5">
          {task.cards.map((c, i) => (
            <Card key={i} size="sm">
              <CardContent className="px-3">
                <p className="text-[11px] font-medium leading-snug">
                  {c.question}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                  {c.answer}
                </p>
                {c.category && (
                  <Badge
                    variant="secondary"
                    className="mt-1 text-[9px] h-4 px-1"
                  >
                    {c.category}
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
          <Button
            variant="default"
            size="sm"
            className="mt-1 h-6 text-xs gap-1"
            onClick={(e) => {
              e.stopPropagation();
              addCards(task.id);
            }}
          >
            <Download className="h-3 w-3" />
            Import {task.cards.length}
          </Button>
        </div>
      )}

      {!expanded && task.status === "done" && task.cards.length === 0 && (
        <p className="text-[11px] text-muted-foreground mt-0.5 ml-5">
          No cards generated
        </p>
      )}

      {task.status === "error" && (
        <p className="text-[11px] text-destructive/80 mt-0.5 ml-5 truncate">
          {task.error}
        </p>
      )}
    </div>
  );
};

export const AiTaskPanel: React.FC<{ onTaskClick?: () => void }> = ({
  onTaskClick,
}) => {
  const allTasks = useTaskQueue((s) => s.tasks);
  const tasks = allTasks.filter((t) => t.status !== "imported");
  const runningCount = tasks.filter((t) => t.status === "running").length;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b shrink-0 flex items-center gap-2">
        <h3 className="text-sm font-semibold">AI Tasks</h3>
        {runningCount > 0 && (
          <span className="inline-flex items-center justify-center h-4.5 min-w-4.5 rounded-full bg-amber-500/15 text-amber-400 text-[11px] font-medium px-1.5 leading-none">
            {runningCount}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-muted-foreground gap-2">
            <Zap className="h-8 w-8 text-muted-foreground/20" />
            <p className="text-xs font-medium">No AI tasks</p>
            <p className="text-[11px] text-center text-muted-foreground/60 leading-relaxed">
              Generate cards from the
              <br />
              Review page or AI Studio
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {tasks.map((t) => (
              <MiniTask key={t.id} task={t} onClick={onTaskClick} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
