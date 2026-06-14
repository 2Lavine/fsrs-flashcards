import { describe, it, expect } from 'vitest';
import { renderCloze, renderClozeAsMarkdown } from '../format';

describe('renderCloze (legacy HTML)', () => {
  it('escapes plain text', () => {
    expect(renderCloze('hello <world>', false)).toBe('hello &lt;world&gt;');
  });

  it('replaces cloze markers with revealed span', () => {
    expect(renderCloze('a {{c1::foo}} b', true)).toBe('a <span class="cloze">foo</span> b');
  });

  it('replaces cloze markers with hidden span when not revealed', () => {
    expect(renderCloze('a {{c1::foo}} b', false)).toBe('a <span class="cloze-hidden">[...]</span> b');
  });

  it('escapes HTML inside cloze answer to prevent injection', () => {
    expect(renderCloze('{{c1::<script>}}', true)).toBe('<span class="cloze">&lt;script&gt;</span>');
  });
});

describe('renderClozeAsMarkdown', () => {
  it('passes plain text through unchanged', () => {
    expect(renderClozeAsMarkdown('hello world', false)).toBe('hello world');
  });

  it('replaces cloze with raw HTML span (revealed)', () => {
    expect(renderClozeAsMarkdown('a {{c1::foo}} b', true))
      .toBe('a <span class="cloze">foo</span> b');
  });

  it('replaces cloze with raw HTML span (hidden)', () => {
    expect(renderClozeAsMarkdown('a {{c1::foo}} b', false))
      .toBe('a <span class="cloze-hidden">[…]</span> b');
  });

  it('HTML-escapes cloze inner content', () => {
    expect(renderClozeAsMarkdown('{{c1::<script>}}', true))
      .toBe('<span class="cloze">&lt;script&gt;</span>');
  });

  it('handles multiple cloze markers', () => {
    expect(renderClozeAsMarkdown('{{c1::a}} and {{c2::b}}', true))
      .toBe('<span class="cloze">a</span> and <span class="cloze">b</span>');
  });

  it('handles multiline cloze (non-greedy)', () => {
    expect(renderClozeAsMarkdown('{{c1::line1\nline2}}', true))
      .toBe('<span class="cloze">line1\nline2</span>');
  });

  it('leaves markdown syntax untouched (caller runs markdown pipeline)', () => {
    const out = renderClozeAsMarkdown('**bold** and `code`', false);
    expect(out).toBe('**bold** and `code`');
  });
});
