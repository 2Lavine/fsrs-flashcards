import React, { useState, useEffect } from 'react';
import { useStore } from '../store-instance';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';

let openFn: (() => void) | null = null;

/** Call this to open the ImportModal from anywhere */
export function openImportModal() {
  openFn?.();
}

interface Props {
  onToast: (msg: string) => void;
}

export const ImportModal: React.FC<Props> = ({ onToast }) => {
  const [json, setJson] = useState('');
  const [open, setOpen] = useState(false);
  const importCards = useStore(s => s.importCards);

  useEffect(() => {
    openFn = () => setOpen(true);
    return () => { openFn = null; };
  }, []);

  const doImport = async () => {
    if (!json.trim()) return;
    try {
      const data = JSON.parse(json);
      if (!data.cards || !Array.isArray(data.cards)) {
        onToast?.('Invalid format: expected "cards" array');
        return;
      }
      const count = await importCards(data.deck || 'Default', data.source || '', data.cards);
      setJson('');
      setOpen(false);
      onToast?.(`Imported ${count} cards to "${data.deck || 'Default'}"`);
    } catch (e) {
      onToast?.('Invalid JSON: ' + (e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Cards</DialogTitle>
          <DialogDescription>
            Paste JSON output from Claude (with "deck", "source", and "cards" fields).
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={json}
          onChange={e => setJson(e.target.value)}
          placeholder='{"deck": "My Deck", "source": "...", "cards": [...]}'
          className="min-h-[180px] font-mono text-sm"
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={doImport}>Import</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
