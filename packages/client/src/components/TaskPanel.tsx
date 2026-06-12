import React, { useState } from 'react';
import { useTaskQueue } from '../services/task-queue';
import { AiCardList } from './AiCardList';

export const TaskPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const taskCount = useTaskQueue(s => s.tasks.length);

  return (
    <>
      <button className="task-fab" onClick={() => setOpen(true)}>
        AI{taskCount > 0 ? ` (${taskCount})` : ''}
      </button>

      {open && (
        <div className="sheet-overlay" onClick={() => setOpen(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-header">
              <h3>AI Cards</h3>
              <button className="sheet-close" onClick={() => setOpen(false)}>×</button>
            </div>
            <AiCardList />
          </div>
        </div>
      )}
    </>
  );
};
