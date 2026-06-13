import React, { useState, useEffect } from 'react';
import { cardQuery, useStore } from '../store-instance';
import type { Flashcard, Deck } from '@fsrs/shared';
import { renderCloze, formatDate, stateLabel } from '../format';
import { openImportModal } from './ImportModal';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

export const BrowsePage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [deckFilter, setDeckFilter] = useState('');
  const [decks, setDecks] = useState<Deck[]>([]);
  const [cards, setCards] = useState<Flashcard[]>([]);

  const version = useStore(s => s.version);

  useEffect(() => { cardQuery.getDecks().then(setDecks); }, [version]);

  useEffect(() => {
    const sql = search || deckFilter
      ? `WHERE ${[search ? '(c.question LIKE ? OR c.answer LIKE ? OR c.tags LIKE ? OR d.name LIKE ?)' : '', deckFilter ? 'd.id = ?' : ''].filter(Boolean).join(' AND ')}`
      : '';
    const params: (string | number)[] = [];
    if (search) { const q = `%${search}%`; params.push(q, q, q, q); }
    if (deckFilter) params.push(deckFilter);
    cardQuery.getAllCards(sql, params).then(setCards);
  }, [version, search, deckFilter]);

  const doDelete = (id: string) => {
    if (!confirm('Delete this card?')) return;
    useStore.getState().deleteCard(id);
  };

  const doDeleteDeck = (name: string, count: number) => {
    if (!confirm(`Delete deck "${name}" and all ${count} cards?`)) return;
    useStore.getState().deleteDeck(name);
  };

  const doExport = async () => {
    const all = await cardQuery.getAllCards();
    const decksExport: Record<string, { source: string; cards: { question: string; answer: string; tags: string[]; category: string }[] }> = {};
    for (const c of all) {
      if (!decksExport[c.deck]) decksExport[c.deck] = { source: '', cards: [] };
      decksExport[c.deck].cards.push({ question: c.question, answer: c.answer, tags: c.tags, category: c.category });
    }
    const allDecks = await cardQuery.getDecks();
    for (const d of allDecks) {
      if (decksExport[d.name]) decksExport[d.name].source = d.source;
    }
    const json = JSON.stringify({ decks: decksExport, exported: new Date().toISOString() }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = 'fsrs-cards-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex gap-2">
        <Input
          className="flex-1"
          placeholder="Search cards..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <Select value={deckFilter} onValueChange={(v) => setDeckFilter(v ?? "")}>
          <SelectTrigger>
            <SelectValue placeholder="All Decks" />
          </SelectTrigger>
          <SelectContent>
            {decks.map(d => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={openImportModal}>Import</Button>
        <Button variant="outline" onClick={doExport}>Export</Button>
      </div>

      {/* Deck List */}
      {decks.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {decks.map(d => {
            const count = cards.filter(c => c.deckId === d.id).length;
            return (
              <div key={d.id} className="flex items-center gap-2 text-sm border rounded-lg px-3 py-1.5">
                <span className="font-medium">{d.name}</span>
                <span className="text-muted-foreground text-xs">{count} cards</span>
                <Button variant="ghost" size="sm" className="text-destructive h-auto px-1 py-0" onClick={() => doDeleteDeck(d.name, count)}>Delete Deck</Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Cards */}
      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <span className="text-4xl opacity-20">📭</span>
          <span>No cards yet</span>
          <Button onClick={openImportModal}>Import Cards</Button>
        </div>
      ) : (
        <div className="columns-3 gap-3">
          {cards.map(c => (
            <div key={c.id} className="break-inside-avoid mb-3 border rounded-lg p-4">
              <div className="font-medium text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: renderCloze(c.question, true) }} />
              <div className="text-sm text-muted-foreground mt-1">{c.answer}</div>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="text-xs text-muted-foreground">{c.deck}</span>
                <Badge variant="outline" className="text-xs">{stateLabel(c.fsrs.state)}</Badge>
                <span className="text-xs text-muted-foreground">Due: {formatDate(c.fsrs.due)}</span>
                {c.category && <Badge variant="secondary" className="text-xs">{c.category}</Badge>}
                {c.tags.map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
              </div>
              <Button variant="ghost" size="sm" className="text-destructive mt-2 h-6 text-xs" onClick={() => doDelete(c.id)}>Delete</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
