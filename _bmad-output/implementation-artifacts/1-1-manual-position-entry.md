# Story 1.1: Manual Position Entry

**Epic:** 1 — Portfolio Foundation  
**Status:** in-progress

## Goal

Allow users to manually add stock/ETF positions (ticker, quantity, average price, currency, source) to build a portfolio snapshot without broker integration.

## Acceptance Criteria

**Given** user is on the portfolio page  
**When** they click "Dodaj pozycję" and fill ticker, qty, avg price, currency  
**Then** position is saved to local state and visible in the portfolio list  
**And** inline validation rejects: empty ticker, qty ≤ 0, negative price, missing currency  
**And** duplicate ticker from same source shows merge prompt

## Technical Approach

### New files
- `frontend/types/position.ts` — Position type definition
- `frontend/hooks/usePositions.ts` — positions CRUD with localStorage persistence
- `frontend/components/portfolio/PositionList.tsx` — table of positions
- `frontend/components/portfolio/PositionForm.tsx` — add/edit form with inline validation
- `frontend/components/portfolio/MergePrompt.tsx` — duplicate confirmation dialog

### Modified files
- `frontend/pages/PortfolioPage.tsx` — add positions section above existing wizard
- `frontend/__tests__/positions.test.ts` — unit tests for usePositions + validation logic

### State shape
```typescript
interface Position {
  id: string;          // nanoid-style unique id
  ticker: string;      // uppercase ticker symbol
  quantity: number;    // number of units
  avgPrice: number;    // average purchase price
  currency: string;    // position currency: USD | EUR | GBP | PLN
  source: string;      // always 'manual' for this story
  addedAt: number;     // Unix timestamp ms
}
```

### Constraints
- Positions stored in localStorage under key `njord_positions_v1`
- No backend calls — pure client-side state
- Page owns state, passes via props
- Source = 'manual' hardcoded for this story
