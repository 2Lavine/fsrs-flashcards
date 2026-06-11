import { State } from 'ts-fsrs';

export function formatDate(d: Date | undefined | null): string {
  if (!d || isNaN(d.getTime())) return '-';
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const absDiff = Math.abs(diff);
  const mins = Math.round(absDiff / 60000);
  const hrs = Math.round(absDiff / 3600000);
  const days = Math.round(absDiff / 86400000);

  if (mins < 1) return 'now';
  if (mins < 60) return (diff > 0 ? 'in ' : '') + mins + 'm' + (diff < 0 ? ' ago' : '');
  if (hrs < 24) return (diff > 0 ? 'in ' : '') + hrs + 'h' + (diff < 0 ? ' ago' : '');
  if (days < 30) return (diff > 0 ? 'in ' : '') + days + 'd' + (diff < 0 ? ' ago' : '');
  return d.toLocaleDateString();
}

export function stateLabel(s: number): string {
  const labels: Record<number, string> = {
    [State.New]: 'New',
    [State.Learning]: 'Learning',
    [State.Review]: 'Review',
    [State.Relearning]: 'Relearning',
  };
  return labels[s] ?? 'Unknown';
}

export function stateClass(s: number): string {
  const classes: Record<number, string> = {
    [State.New]: 'new',
    [State.Learning]: 'learning',
    [State.Review]: 'review',
    [State.Relearning]: 'relearning',
  };
  return classes[s] ?? '';
}

export function ratingLabel(r: number): string {
  const labels: Record<number, string> = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' };
  return labels[r] ?? String(r);
}

export function ratingClass(r: number): string {
  const classes: Record<number, string> = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' };
  return classes[r] ?? '';
}

export function renderCloze(text: string, revealed: boolean): string {
  return text.replace(/\{\{c\d+::([^}]+)\}\}/g, (_, answer: string) => {
    if (revealed) return `<span class="cloze">${answer}</span>`;
    return `<span class="cloze-hidden">[...]</span>`;
  });
}

export function uid(): string {
  return crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
}
