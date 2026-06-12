import React from 'react';
import { ReviewPage } from './components/ReviewPage';
import { BrowsePage } from './components/BrowsePage';
import { StatsPage } from './components/StatsPage';
import { SettingsPage } from './components/SettingsPage';
import { ImportModal } from './components/ImportModal';
import { useToast } from './hooks/useToast';

type Page = 'review' | 'browse' | 'stats' | 'settings';

export const App: React.FC = () => {
  const [page, setPage] = React.useState<Page>('review');
  const { toasts, toast } = useToast();

  return (
    <>
      <header>
        <h1>FSRS Flashcards</h1>
        <nav>
          {(['review', 'browse', 'stats', 'settings'] as Page[]).map(p => (
            <button key={p} className={page === p ? 'active' : ''} onClick={() => setPage(p)}>
              {p === 'review' ? 'Review' : p === 'browse' ? 'Cards' : p === 'stats' ? 'Stats' : 'Settings'}
            </button>
          ))}
        </nav>
      </header>

      <main>
        <div className={`page ${page === 'review' ? 'active' : ''}`} id="page-review">
          {page === 'review' && <ReviewPage />}
        </div>
        <div className={`page ${page === 'browse' ? 'active' : ''}`} id="page-browse">
          {page === 'browse' && <BrowsePage />}
        </div>
        <div className={`page ${page === 'stats' ? 'active' : ''}`} id="page-stats">
          {page === 'stats' && <StatsPage />}
        </div>
        <div className={`page ${page === 'settings' ? 'active' : ''}`} id="page-settings">
          {page === 'settings' && <SettingsPage />}
        </div>
      </main>

      <ImportModal onToast={toast} />

      <div className="toast" id="toast" style={{ opacity: toasts.length > 0 ? 1 : 0 }}>
        {toasts[toasts.length - 1]?.msg ?? ''}
      </div>
    </>
  );
};
