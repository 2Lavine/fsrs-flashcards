# Output Format Reference

## JSON Schema

```json
{
  "deck": "Deck Name",
  "source": "Brief description of source text",
  "cards": [
    {
      "question": "What is the capital of France?",
      "answer": "Paris",
      "tags": ["geography", "europe"],
      "category": "Geography",
      "source_quote": "Paris is the capital and largest city of France."
    }
  ]
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `deck` | Yes | Deck name. If the deck doesn't exist, it's auto-created. |
| `source` | No | Human-readable description of where this batch came from. |
| `cards` | Yes | Array of card objects (min 1). |
| `cards[].question` | Yes | Question text. Use `{{c1::answer}}` syntax for cloze cards. |
| `cards[].answer` | Yes | Answer text. For multi-cloze, separate answers with `;`. |
| `cards[].tags` | No | Array of 2–4 tags for organization and filtering. |
| `cards[].category` | No | Category with `/` hierarchy. Groups cards for focused review. |
| `cards[].source_quote` | No | Exact sentence from source text backing this card. Reference only — not stored by API. |

## Cloze Format

```
question: "The {{c1::FSRS}} algorithm uses {{c2::stability}}, {{c2::difficulty}}, and {{c2::retrievability}}."
answer:   "FSRS; stability; difficulty; retrievability"
```

- `{{c1::...}}` — hidden text, revealed on Space press
- Multiple `c1` markers in the same question are revealed simultaneously
- `c2`, `c3`, etc. — sequential reveals (each press reveals the next group)
- The review app renders cloze with `[...]` placeholder before reveal, highlighted text after

## Examples

### Example 1: Basic Concepts

**Input:** "今天讲了细胞结构。细胞主要由细胞膜、细胞质和细胞核组成。细胞膜控制物质进出细胞，细胞核含有遗传物质DNA。线粒体是细胞的能量工厂，通过有氧呼吸产生ATP。"

**Output:**
```json
{
  "deck": "Cell Biology",
  "source": "Cell structure lecture notes",
  "cards": [
    {
      "question": "{{c1::细胞膜}}的主要功能是什么？",
      "answer": "控制物质进出细胞",
      "tags": ["biology", "cell"],
      "category": "biology/cell",
      "source_quote": "细胞膜控制物质进出"
    },
    {
      "question": "细胞核中含有哪种遗传物质？",
      "answer": "DNA",
      "tags": ["biology", "cell"],
      "category": "biology/cell",
      "source_quote": "细胞核含有遗传物质DNA"
    },
    {
      "question": "细胞质是细胞膜和细胞核之间的__？__",
      "answer": "填充物质（包含细胞器和细胞液）",
      "tags": ["biology", "cell"],
      "category": "biology/cell",
      "source_quote": "细胞主要由细胞膜、细胞质和细胞核组成"
    },
    {
      "question": "{{c1::线粒体}}被称为什么？通过什么过程产生什么？",
      "answer": "细胞的能量工厂，通过有氧呼吸产生ATP",
      "tags": ["biology", "mitochondria"],
      "category": "biology/cell/mitochondria",
      "source_quote": "线粒体是细胞的能量工厂，通过有氧呼吸产生ATP。"
    }
  ]
}
```

> Note: the original "三部分组成" set card was split into 3 individual cards, plus a relationship card. Each card tests one specific fact.

### Example 2: Technical Concept with Comparisons

**Input:** "FSRS is a spaced repetition algorithm that uses a three-component model of memory: stability, difficulty, and retrievability. Stability (S) increases with each successful review. Difficulty (D) adjusts based on review outcomes. Retrievability (R) decays over time according to a forgetting curve. Unlike SM-2 which only uses a single difficulty factor, FSRS tracks stability independently."

**Output:**
```json
{
  "deck": "Spaced Repetition",
  "source": "FSRS algorithm explanation",
  "cards": [
    {
      "question": "What are the three components of the FSRS memory model?",
      "answer": "Stability (S), Difficulty (D), and Retrievability (R)",
      "tags": ["fsrs", "memory-model"],
      "category": "srs/fsrs",
      "source_quote": "FSRS is a spaced repetition algorithm that uses a three-component model of memory: stability, difficulty, and retrievability."
    },
    {
      "question": "What happens to {{c1::stability (S)}} after each successful review?",
      "answer": "Stability increases with each successful review",
      "tags": ["fsrs", "stability"],
      "category": "srs/fsrs",
      "source_quote": "Stability (S) increases with each successful review."
    },
    {
      "question": "How does {{c1::difficulty (D)}} change in FSRS?",
      "answer": "Difficulty adjusts based on review outcomes — increases after failures, decreases after successes",
      "tags": ["fsrs", "difficulty"],
      "category": "srs/fsrs",
      "source_quote": "Difficulty (D) adjusts based on review outcomes."
    },
    {
      "question": "What happens to {{c1::retrievability (R)}} over time?",
      "answer": "Retrievability decays according to a forgetting curve",
      "tags": ["fsrs", "retrievability"],
      "category": "srs/fsrs",
      "source_quote": "Retrievability (R) decays over time according to a forgetting curve."
    },
    {
      "question": "What is the key difference between FSRS and SM-2?",
      "answer": "SM-2 uses a single difficulty factor; FSRS tracks stability independently from difficulty, giving more precise scheduling",
      "tags": ["fsrs", "sm2", "comparison"],
      "category": "srs/comparison",
      "source_quote": "Unlike SM-2 which only uses a single difficulty factor, FSRS tracks stability independently."
    }
  ]
}
```

### Example 3: High Density (Comprehensive)

**Input:** "Python decorators are functions that modify other functions. The syntax is @decorator_name above a function definition. Under the hood, `@log` before `def foo():` is equivalent to `foo = log(foo)`. Decorators can stack: `@a @b def f():` means `f = a(b(f))`. Common uses: logging, timing, access control, caching."

**Output:**
```json
{
  "deck": "Python",
  "source": "Python decorators explanation",
  "cards": [
    {
      "question": "What is a Python decorator?",
      "answer": "A function that modifies the behavior of another function. It takes a function as input and returns a modified version.",
      "tags": ["python", "decorator"],
      "category": "python/decorators",
      "source_quote": "Python decorators are functions that modify other functions."
    },
    {
      "question": "What is the syntax for applying a decorator in Python?",
      "answer": "@decorator_name placed on the line above a function definition",
      "tags": ["python", "decorator", "syntax"],
      "category": "python/decorators",
      "source_quote": "The syntax is @decorator_name above a function definition."
    },
    {
      "question": "What is `@log` before `def foo():` equivalent to?",
      "answer": "foo = log(foo)",
      "tags": ["python", "decorator"],
      "category": "python/decorators",
      "source_quote": "Under the hood, @log before def foo(): is equivalent to foo = log(foo)."
    },
    {
      "question": "What does `@a` followed by `@b` before `def f():` mean?",
      "answer": "f = a(b(f)) — decorators are applied bottom-up: b first, then a",
      "tags": ["python", "decorator", "stacking"],
      "category": "python/decorators",
      "source_quote": "Decorators can stack: @a @b def f(): means f = a(b(f))."
    },
    {
      "question": "{{c1::logging}}, {{c1::timing}}, {{c1::access control}}, and {{c1::caching}} are common use cases for Python decorators.",
      "answer": "logging; timing; access control; caching",
      "tags": ["python", "decorator", "use-cases"],
      "category": "python/decorators",
      "source_quote": "Common uses: logging, timing, access control, caching."
    }
  ]
}
```
