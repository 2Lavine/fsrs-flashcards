import React from 'react';
import { useTaskQueue } from '../services/task-queue';
import type { AiTask } from '../services/task-queue';

const TaskCard: React.FC<{ task: AiTask }> = ({ task }) => {
  const { dismiss, addCards } = useTaskQueue();

  return (
    <div className={`ai-task-item ${task.status}`}>
      <div className="ai-task-head">
        <span className="ai-task-preset">{task.presetLabel}</span>
        <span className="ai-task-q">{task.question}</span>
        <button className="btn small danger" onClick={() => dismiss(task.id)}>×</button>
      </div>

      {task.status === 'running' && (
        <div className="ai-task-loader"><div className="spinner" /><span>Generating...</span></div>
      )}

      {task.status === 'error' && (
        <div className="ai-task-error">{task.error}</div>
      )}

      {task.status === 'done' && task.cards.length > 0 && (
        <div className="ai-task-result">
          {task.cards.map((c, i) => (
            <div key={i} className="ai-result-card">
              <div className="ai-result-q">{c.question}</div>
              <div className="ai-result-a">{c.answer}</div>
              {c.category && <span className="tag">{c.category}</span>}
            </div>
          ))}
          <button className="btn small primary" onClick={() => addCards(task.id)}>
            Import {task.cards.length} card{task.cards.length > 1 ? 's' : ''}
          </button>
        </div>
      )}
    </div>
  );
};

export const AiCardList: React.FC = () => {
  const tasks = useTaskQueue(s => s.tasks);
  if (tasks.length === 0) return <div className="empty-state"><div className="icon">📭</div><div>No AI tasks yet</div></div>;

  return (
    <div className="ai-task-list">
      {tasks.map(t => <TaskCard key={t.id} task={t} />)}
    </div>
  );
};
