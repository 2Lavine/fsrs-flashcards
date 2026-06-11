import React, { useState, useRef } from 'react';
import { useStore } from '../store-instance';
import { persist } from '../db';

interface Props {
  onToast: (msg: string) => void;
}

export const ImportModal: React.FC<Props> = ({ onToast }) => {
  const [json, setJson] = useState('');
  const overlayRef = useRef<HTMLDivElement>(null);
  const importCards = useStore(s => s.importCards);

  const doImport = () => {
    if (!json.trim()) return;
    try {
      const data = JSON.parse(json);
      if (!data.cards || !Array.isArray(data.cards)) {
        onToast('Invalid format: expected "cards" array');
        return;
      }
      const count = importCards(data.deck || 'Default', data.source || '', data.cards);
      persist();
      setJson('');
      overlayRef.current?.classList.remove('active');
      onToast(`Imported ${count} cards to "${data.deck || 'Default'}"`);
    } catch (e) {
      onToast('Invalid JSON: ' + (e as Error).message);
    }
  };

  return (
    <div className="modal-overlay" id="import-modal" ref={overlayRef} onClick={e => { if (e.target === overlayRef.current) overlayRef.current.classList.remove('active'); }}>
      <div className="modal">
        <h2>Import Cards</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text2)' }}>
          Paste JSON output from Claude (with "deck", "source", and "cards" fields).
        </p>
        <textarea
          value={json}
          onChange={e => setJson(e.target.value)}
          placeholder='{"deck": "My Deck", "source": "...", "cards": [...]}'
        />
        <div className="actions">
          <button className="btn" onClick={() => overlayRef.current?.classList.remove('active')}>Cancel</button>
          <button className="btn primary" onClick={doImport}>Import</button>
        </div>
      </div>
    </div>
  );
};
