import React, { useState } from 'react';
import { cardQuery, useStore } from '../store-instance';
import { renderCloze, formatDate, stateLabel, stateClass } from '../format';
import { persist } from '../db';

export const BrowsePage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [deckFilter, setDeckFilter] = useState('');

  useStore(s => s.version); // re-render on mutations

  const decks = cardQuery.getDecks();
  const sql = search || deckFilter
    ? `WHERE ${[
        search ? '(c.question LIKE ? OR c.answer LIKE ? OR c.tags LIKE ? OR d.name LIKE ?)' : '',
        deckFilter ? 'd.id = ?' : '',
      ].filter(Boolean).join(' AND ')}`
    : '';
  const params: (string | number)[] = [];
  if (search) { const q = `%${search}%`; params.push(q, q, q, q); }
  if (deckFilter) params.push(deckFilter);
  const cards = cardQuery.getAllCards(sql, params);

  const doDelete = (id: string) => {
    if (!confirm('Delete this card?')) return;
    useStore.getState().deleteCard(id);
    persist();
  };

  const doDeleteDeck = (name: string, count: number) => {
    if (!confirm(`Delete deck "${name}" and all ${count} cards? This cannot be undone.`)) return;
    useStore.getState().deleteDeck(name);
    if (deckFilter && decks.find(d => d.name === name)?.id === deckFilter) {
      setDeckFilter('');
    }
    persist();
  };

  const doExport = () => {
    const all = cardQuery.getAllCards();
    const decksExport: Record<string, { source: string; cards: { question: string; answer: string; tags: string[]; category: string }[] }> = {};
    for (const c of all) {
      if (!decksExport[c.deck]) decksExport[c.deck] = { source: '', cards: [] };
      decksExport[c.deck].cards.push({ question: c.question, answer: c.answer, tags: c.tags, category: c.category });
    }
    for (const d of cardQuery.getDecks()) {
      if (decksExport[d.name]) decksExport[d.name].source = d.source;
    }
    const json = JSON.stringify({ decks: decksExport, exported: new Date().toISOString() }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fsrs-cards-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="toolbar">
        <input type="text" className="search-input" placeholder="Search cards..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="deck-filter" value={deckFilter} onChange={e => setDeckFilter(e.target.value)}>
          <option value="">All Decks</option>
          {decks.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <button className="btn primary" onClick={() => document.getElementById('import-modal')!.classList.add('active')}>Import</button>
        <button className="btn" onClick={doExport}>Export</button>
      </div>

      {decks.length > 0 && (
        <div className="deck-list">
          {decks.map(d => {
            const count = cards.filter(c => c.deckId === d.id).length;
            return (
              <span key={d.id} className="deck-item">
                <span className="deck-name">{d.name}</span>
                <span className="deck-count">{count} cards</span>
                <button className="btn small danger" onClick={() => doDeleteDeck(d.name, count)}>Delete Deck</button>
              </span>
            );
          })}
        </div>
      )}

      {cards.length === 0 && !search && !deckFilter ? (
        <div className="empty-state" style={{ display: 'flex' }}>
          <div className="icon">📭</div>
          <div>No cards yet</div>
          <button className="btn primary" onClick={() => document.getElementById('import-modal')!.classList.add('active')}>Import Cards</button>
        </div>
      ) : cards.length === 0 ? (
        <div className="empty-state"><div>No matching cards</div></div>
      ) : (
        <div className="card-list">
          {cards.map(c => (
            <div key={c.id} className="card-item">
              <div className="info">
                <div className="q" dangerouslySetInnerHTML={{ __html: renderCloze(c.question, true) }} />
                <div className="a">{c.answer}</div>
                <div className="meta">
                  <span>{c.deck}</span>
                  <span className={`state-badge ${stateClass(c.fsrs.state)}`}>{stateLabel(c.fsrs.state)}</span>
                  <span>Due: {formatDate(c.fsrs.due)}</span>
                  {c.category && <span className="tag">{c.category}</span>}
                  {c.tags.map(t => <span key={t} className="tag">{t}</span>)}
                </div>
              </div>
              <div className="actions">
                <button className="btn small danger" onClick={() => doDelete(c.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};
