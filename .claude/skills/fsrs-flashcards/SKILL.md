---
name: fsrs-flashcards
description: Generate spaced-repetition flashcards from any text input. When the user shares text, notes, articles, or any learning material and asks for flashcards/cards/卡片, generates high-quality Q&A pairs optimized for FSRS-based review. Also provides a built-in web review app for daily card practice with the FSRS scheduling algorithm.
---

# FSRS Flashcards Skill

Transform any text into well-formulated flashcards for spaced repetition learning.

## Output Format

Cards follow a JSON structure. Full schema and examples: [references/format.md](references/format.md).

Cloze cards use `{{c1::answer}}` syntax in the question field. The review app renders them natively — hidden until Space is pressed, then revealed with highlighting.

## Density Control

Card count is determined by three factors: **genre baseline × density level × 5-year filter**.

### 1. Genre Baseline (Propositional Density)

Different genres carry radically different densities of atomic, testable facts (Kintsch, 1998). Do NOT treat all words equally.

| Genre | Propositions / 1000 words | Examples |
|-------|---------------------------|----------|
| Conversation / interview | 15–25 | Podcasts, transcripts, Q&A |
| Narrative / memoir | 10–20 | Stories, personal essays, case studies |
| Expository / article | 25–40 | Blog posts, essays, journalism |
| Textbook / technical | 40–70 | Academic papers, documentation, manuals |

Identify the genre before estimating target count. Mixed input (e.g., lecture with stories) should use the dominant genre.

### 2. Density Level → Capture Rate

| Level | Capture rate | What gets through |
|-------|-------------|-------------------|
| `low` | ~25% | Only foundational, "must-know" propositions |
| `medium` | ~50% | Key concepts + important supporting details (default) |
| `high` | ~75% | All significant facts, nuances, sub-points |
| `verbose` | ~90% | Nearly every extractable fact, including edge cases |

### 3. Target Estimation (mandatory)

After identifying genre and density, compute the target range:

```
target_min = propositions_low × capture_rate_low × (word_count / 1000)
target_max = propositions_high × capture_rate_high × (word_count / 1000)
```

Round to nearest 5. This range is a **soft guardrail**, not a quota — never pad to hit a number.

Example: 2000-word interview at medium density
→ 15–25 props/1K × 50% × 2 = **15–25 cards**

Example: 500-word textbook passage at high density
→ 40–70 props/1K × 75% × 0.5 = **15–26 cards**

### 4. The 5-Year Filter (Hard Upper Bound)

> Precision is more important than recall. A false positive (card for a fact not worth remembering) costs future review time and erodes trust in the deck.

Before finalizing each card, ask: **"Will the learner still need this fact in 5 years?"**
- If no → skip, regardless of density level
- This filter hits harder at `low`/`medium`, but applies at all levels

Infer density from context when not stated:
- Short text (< 200 words), "快速", "大概", "overview" → `low`
- Full article/chapter, "全面", "详细", "exam" → `high` or `verbose`
- Default → `medium`

## Card Formulation Rules

Based on the SuperMemo Twenty Rules of Formulating Knowledge. These are the core quality standards for every card you generate.

### 1. Understand Before Memorizing (Rules 1–3)

- **Never** formulate a card for content you don't truly understand. If the source text is ambiguous, skip it rather than guess.
- Build a mental picture of the topic first. Identify the foundational concepts, then extract cards starting from basics → intermediate → details.
- If the source contains advanced content that depends on prerequisites, flag it: "This card assumes knowledge of X."

### 2. Minimum Information Principle (Rule 4)

> This is the most important rule. Simple = easy to recall consistently.

- **One fact, one card.** Split a complex idea into N atomic cards.
- A good card should be answerable in **3–5 seconds** during review. If it requires reasoning, split it.
- Bad: "Explain the Krebs cycle." Good: "What is the first step of the Krebs cycle?" "What enzyme catalyzes step 1?" etc.

### 3. Cloze Deletion (Rule 5)

> Cloze is the fastest way to convert textbook text into flashcards.

- Use `{{c1::answer}}` for definitions, formulas, dates, key terms in context.
- For multi-part facts, use overlapping clozes (c1, c2) in the same question.
- Example: "The {{c1::FSRS}} algorithm models memory using {{c2::stability}}, {{c2::difficulty}}, and {{c2::retrievability}}."
- When using multi-part clozes, put the answers in the answer field separated by `;`.

### 4. Use Imagery (Rule 6)

- Where a diagram or visual would help, **suggest it in the answer**: "(建议配图：细胞结构示意图)"
- For cards that benefit from spatial memory, describe the visual layout in words.

### 5. Mnemonic Techniques (Rule 7)

- For hard-to-remember sequences or lists, include a mnemonic in the answer.
- Example: answer = "ROYGBIV (red, orange, yellow, green, blue, indigo, violet). 记忆口诀: 赤橙黄绿青蓝紫"
- Use sparingly — about 1–5% of cards.

### 6. Avoid Sets (Rule 9)

> This is non-negotiable. Sets are a memory death trap.

- **Never** ask "What are the X types of Y?" or "List the Z components of W."
- Split every set into individual cards — one card per member.
- If the set has >5 members, only cardify the most important ones (governed by density).

### 7. Avoid Enumerations (Rule 10)

> Ordered lists are easier than sets, but still difficult.

- For ordered sequences (steps, phases, rankings), use overlapping cloze deletions.
- Example for "5 phases of mitosis": create 5 cloze cards, each hiding one phase in context.
- Alternatively, group and label: "Phase 1–3 of mitosis are called ___" vs "Phase 4–5 are called ___".

### 8. Combat Interference (Rule 11)

- When two concepts are easily confused, **explicitly distinguish them** in the answer.
- Example: "注意：mitosis（有丝分裂）产生两个相同的子细胞，而 meiosis（减数分裂）产生四个不同的配子。区分关键词：same vs different, 2 vs 4."
- Vary question templates for similar concepts — don't ask "What is X?" for every term.

### 9. Optimize Wording (Rule 12)

> Every word must earn its place.

- Delete filler words, redundant modifiers, and passive voice (unless required by context).
- Question should be the shortest possible string that unambiguously identifies the fact.
- Answer should be the shortest possible string that accurately answers the question.
- Example: Bad: "What is the name of the process by which plants convert sunlight into energy?" Good: "What process do plants use to convert sunlight into energy?"

### 10. Refer to Other Memories (Rule 13)

- Anchor new concepts to familiar ones in the answer.
- Example: "类似于日常生活中的...", "这与之前学过的 X 相关", "对比：Y 是相反的概念"
- This builds a web of associations that dramatically improves retention.

### 11. Personalize and Provide Examples (Rule 14)

- Every definition card should include a concrete example in the answer.
- Format: "[定义]。例如：[具体例子]。"
- Prefer examples from everyday experience when the source lacks them.
- Personalization is one of the most effective memory tools available.

### 12. Emotional States (Rule 15)

- For critical or easy-to-forget cards, use vivid or surprising examples.
- Use sparingly — overuse causes interference between emotional anchors.

### 13. Context Cues Simplify Wording (Rule 16)

- Use the `category` field to provide domain context, reducing the need for verbose questions.
- Example: category `"biology/cell"` allows the question to be "功能是什么？" instead of "细胞膜的功能是什么？"
- Category hierarchy uses `/` separator: `"trading/psychology"`, `"biology/cell/mitochondria"`.

### 14. Redundancy is Welcome (Rule 17)

- The same fact approached from different angles strengthens memory — this does NOT violate the minimum information principle.
- Example: One card asks "What is X?" (definition), another asks "What happens if X fails?" (consequence), a third asks "How does X relate to Y?" (relationship).
- Active recall (Q→A) and passive recognition (cloze) are complementary — use both.

### 15. Provide Sources (Rule 18)

- Include a `source_quote` field with the exact sentence from the original text that supports the card.
- This anchors the card to reality and prevents fabricated facts.
- If the source text does not explicitly support a claim, reconsider whether the card should exist.
- Note: currently the import API does not store source_quote — it serves as a reference for the user to verify accuracy.

### 18a. Source Excerpts (cropped, Markdown)

- The top-level `source` field must contain **LLM-cropped source excerpts** — the relevant passages from the original input that support the generated cards.
- NOT a one-line description (e.g. "Cell structure lecture notes"), and NOT the verbatim full text.
- Format as **Markdown** to preserve structure: headings, lists, code blocks, inline formatting.
- Length: **≤ 8000 characters**.
- The LLM knows which passages matter — select the specific segments that back the generated cards, not the entire input.

### 16. Date Stamping (Rule 19)

- For time-sensitive knowledge (economic data, software versions, current events), note the vintage in the answer.
- Example: "(2024 年数据)", "(截至 2025 年 6 月)", "(React 19+)"

### 17. Prioritize — Precision Over Recall (Rule 20)

- You cannot cardify everything. Use density levels to prioritize.
- At every density level, prefer: foundational concepts > applied facts > edge cases > trivia.
- **False positive principle**: a card for a fact not worth remembering costs future review time and dilutes the deck's trustworthiness. A missed fact is invisible; a bad card is actively harmful.
- When in doubt, apply the 5-year test: "Will the learner still need this card in 5 years?" If no, skip.
- This is **not** a quota system — never inflate cards to hit a target number. Fewer, higher-quality cards beat more, lower-quality ones.

## Card Quality Checklist

After generating, validate every card:

- [ ] One fact only? Split if not.
- [ ] Answerable in 3–5 seconds? Simplify if not.
- [ ] Only one correct answer? Rephrase if ambiguous.
- [ ] No sets or enumerations > 3 items? Split if found.
- [ ] Similar concepts explicitly distinguished? Add if missing.
- [ ] Every word earns its place? Trim if not.
- [ ] Example included for definitions? Add if missing.
- [ ] source_quote anchors to original text? Drop if you cannot find support.

## Question Types

1. **Direct**: "What is X?" / "Why does Y happen?" / "How does Z work?"
2. **Cloze**: "The {{c1::mitochondria}} produce {{c2::ATP}} through {{c3::aerobic respiration}}."
3. **Comparison**: "What is the key difference between X and Y?"
4. **Cause-effect**: "What happens to X when Y occurs?"
5. **Application**: "Given [scenario], what should you do?"

## Generation Process

1. **Determine density** — check explicit request, infer from context, default to medium.
2. **Identify genre** — classify as conversation / narrative / expository / textbook. Look up propositional density range.
3. **Estimate target count** — compute `(props_per_1K × capture_rate × word_count / 1000)`. Round to nearest 5. This is a guardrail, not a quota.
4. **Parse input** — identify key concepts, facts, definitions, domain, source language.
5. **Extract atomic facts** — each fact stands alone. Filter by density level, then apply the 5-year test as a hard cutoff.
6. **Compare to target** — if actual count falls significantly outside the estimated range, re-check: am I over-cardifying trivia? Am I skipping significant concepts? Adjust, but never pad.
7. **Crop source excerpts** — from the original input, select the relevant passages that support the generated cards. Format as Markdown (≤ 8000 chars). Place in the `source` field.
8. **Formulate cards** — choose question type per fact, apply all 17 rules.
9. **Add metadata** — 2–4 tags, 1 category (with `/` hierarchy).
10. **Self-validate** — run the quality checklist on every card.
11. **Output JSON** — valid, parseable JSON code block.

## Importing Cards

After generating, auto-import via `curl`. Full API details: [references/api.md](references/api.md).

If the API is unreachable, output the JSON for manual import via the app's Import button.
