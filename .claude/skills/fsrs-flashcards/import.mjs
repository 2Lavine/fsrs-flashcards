#!/usr/bin/env node
/**
 * Auto-import script for FSRS Flashcards.
 * Takes JSON from stdin and writes it to the web app's auto-import directory.
 *
 * Usage:
 *   echo '{"deck":"...","cards":[...]}' | node .claude/skills/fsrs-flashcards/import.mjs
 *   node .claude/skills/fsrs-flashcards/import.mjs < cards.json
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Collect stdin
const chunks = [];
process.stdin.setEncoding('utf-8');
process.stdin.on('data', (chunk) => chunks.push(chunk));
process.stdin.on('end', () => {
  const raw = chunks.join('').trim();
  if (!raw) {
    console.error('Error: no JSON input received on stdin');
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error('Error: invalid JSON input:', e.message);
    process.exit(1);
  }

  // Support both {deck, source, cards} and {decks: {...}} formats
  const imports = [];
  if (data.cards) {
    imports.push({ deck: data.deck || 'Default', source: data.source || '', cards: data.cards });
  } else if (data.decks) {
    for (const [name, d] of Object.entries(data.decks)) {
      imports.push({ deck: name, source: d.source || '', cards: d.cards || [] });
    }
  } else {
    console.error('Error: expected {deck, source, cards} or {decks: {...}} format');
    process.exit(1);
  }

  // skill is at <project>/.claude/skills/fsrs-flashcards/import.mjs
  // Three dirnames up = project root
  const projectRoot = dirname(dirname(dirname(__dirname)));
  const importDir = join(projectRoot, 'public', 'auto-import');
  if (!existsSync(importDir)) {
    mkdirSync(importDir, { recursive: true });
  }

  let count = 0;
  for (const imp of imports) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${imp.deck.replace(/[^a-zA-Z0-9一-鿿_-]/g, '_')}-${ts}.json`;
    const filepath = join(importDir, filename);
    writeFileSync(filepath, JSON.stringify(imp, null, 2), 'utf-8');
    count += imp.cards.length;
    console.log(`  ${imp.deck}: ${imp.cards.length} cards → ${filename}`);
  }

  console.log(`Imported ${count} cards total. Refresh the web app to see them.`);
});
