import { createRoot } from 'react-dom/client';
import { initDB, persist } from './db';
import { initStore, cardMutation } from './store-instance';
import { App } from './App';
import './style.css';

async function autoImport() {
  try {
    const res = await fetch('/api/auto-imports');
    if (!res.ok) return;
    const imports: { deck: string; source: string; cards: { question: string; answer: string; tags: string[]; category?: string }[] }[] = await res.json();
    let total = 0;
    for (const imp of imports) {
      if (imp.cards.length > 0) {
        total += cardMutation.addCards(imp.deck, imp.source, imp.cards);
      }
    }
    if (total > 0) {
      persist();
      console.log(`[auto-import] Imported ${total} cards`);
    }
  } catch {
    // auto-import endpoint only exists in dev mode
  }
}

async function boot() {
  await initDB();
  initStore();
  await autoImport();
  const root = createRoot(document.getElementById('root')!);
  root.render(<App />);
}

boot().catch(err => {
  document.body.innerHTML = `<div class="empty-state" style="padding:64px"><div>Failed to load: ${(err as Error).message}</div></div>`;
  console.error(err);
});
