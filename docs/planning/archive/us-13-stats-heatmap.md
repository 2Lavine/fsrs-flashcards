# US-13 Stats Heatmap & By-Deck Breakdown [done]

As a learner, I want a monthly review heatmap and deck-level statistics, so I can visualize my review consistency and track progress per deck.

## Scenario

### Heatmap
- Given I have review history across multiple days
- When I open the Stats page
- Then I see a GitHub-style heatmap grid showing the past month of review activity
- Each cell represents one day, color intensity reflects review count
- Hovering a cell shows the date and exact count

### By Deck
- Given I have cards in multiple decks
- When I view the statistics section
- Then I see card counts and review counts grouped by deck (not by category)
- Each deck shows as a progress bar with count and percentage

## Tech

- New endpoint: `GET /api/daily-counts?days=30` — returns daily review counts for the past N days
- New endpoint: `GET /api/deck-counts` — returns card count per deck
- Heatmap: 7-row grid (Mon–Sun), 4-5 columns for the month, color scale from muted to brand
- Replace "By Category" section with "By Deck"
