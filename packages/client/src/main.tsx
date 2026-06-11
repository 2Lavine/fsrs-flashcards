import { createRoot } from 'react-dom/client';
import {} from './db';
import { App } from './App';
import './style.css';

async function boot() {
  
  const root = createRoot(document.getElementById('root')!);
  root.render(<App />);
}

boot().catch(err => {
  document.body.innerHTML = `<div class="empty-state" style="padding:64px"><div>Failed to load: ${(err as Error).message}</div></div>`;
  console.error(err);
});
