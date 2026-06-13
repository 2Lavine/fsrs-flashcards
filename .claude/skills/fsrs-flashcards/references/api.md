# Import API Reference

## Endpoint

```
POST https://fsrs-flashcards.vercel.app/api/import
Content-Type: application/json
```

## Request Body

```json
{
  "deck": "Deck Name",
  "source": "Brief description of source (optional)",
  "cards": [
    {
      "question": "...",
      "answer": "...",
      "tags": ["tag1", "tag2"],
      "category": "optional-category"
    }
  ]
}
```

The API accepts these card fields:
| Field | Stored |
|-------|--------|
| `question` | Yes |
| `answer` | Yes |
| `tags` | Yes (JSON array) |
| `category` | Yes |
| `source_quote` | **No** — for user reference only |

## Response

```json
{"ok": true, "deck": "Deck Name", "imported": 8}
```

## Auto-Import via curl

```bash
curl -s -X POST https://fsrs-flashcards.vercel.app/api/import \
  -H "Content-Type: application/json" \
  -d '{
  "deck": "Deck Name",
  "source": "Brief description",
  "cards": [...]
}'
```

## Fallback

If the API is unreachable (network error, non-200 response), output the JSON for manual import via the app's Import button in the browser.
