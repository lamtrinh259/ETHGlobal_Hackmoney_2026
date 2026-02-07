# Implementation Plan: ERC-8004 Agent Registry Directory

> **Date:** 2026-02-07
> **Branch:** main
> **Status:** PLAN MODE - Awaiting Approval
> **Estimated Files:** 8 new files, 2 modified files

---

## Executive Summary

Implement a comprehensive Agent Registry Directory that allows:
1. **Human users** to browse, search, and filter registered agents via a web UI
2. **AI agents** to programmatically search the directory via REST API with pagination

This completes the missing frontend for the existing `/api/agents` endpoint and adds cursor-based pagination for scalability.

---

## Current State Analysis

### What Exists

| Component | File | Status |
|-----------|------|--------|
| Agent List API | `frontend/app/api/agents/route.ts` | ✅ GET with skill/wallet filter |
| Agent Detail API | `frontend/app/api/agents/[id]/route.ts` | ✅ GET single agent |
| Reputation API | `frontend/app/api/agents/[id]/reputation/route.ts` | ✅ On-chain + cached |
| AgentCard | `frontend/components/agents/AgentCard.tsx` | ✅ Display component |
| ReputationBadge | `frontend/components/agents/ReputationBadge.tsx` | ✅ 5-star rating |
| FeedbackHistoryList | `frontend/components/agents/FeedbackHistoryList.tsx` | ✅ ERC-8004 feedback |
| ERC-8004 Client | `frontend/lib/contracts/erc8004.ts` | ✅ Contract read functions |

### What's Missing

| Component | File | Status |
|-----------|------|--------|
| Agent Directory Page | `frontend/app/agents/page.tsx` | ❌ Not implemented |
| Agent Profile Page | `frontend/app/agents/[id]/page.tsx` | ❌ Not implemented |
| Agent Search Component | `frontend/components/agents/AgentSearch.tsx` | ❌ Not implemented |
| Agent List Component | `frontend/components/agents/AgentList.tsx` | ❌ Not implemented |
| API Pagination | `frontend/app/api/agents/route.ts` | ❌ No cursor pagination |

---

## Implementation Specification

### Phase 1: API Enhancement (Pagination)

#### 1.1 Update GET /api/agents with Cursor Pagination

**File:** `frontend/app/api/agents/route.ts`

**Changes:**
- Add `cursor` parameter (agent ID to start after)
- Add `sortBy` parameter (`reputation`, `createdAt`, `name`)
- Add `order` parameter (`asc`, `desc`)
- Return `nextCursor` and `hasMore` in response
- Implement proper Firestore ordering/pagination

**New Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `cursor` | string | null | Agent ID to start after (for pagination) |
| `limit` | number | 20 | Results per page (max 100) |
| `skill` | string | null | Filter by skill (comma-separated for multiple) |
| `wallet` | string | null | Filter by wallet address |
| `sortBy` | string | `createdAt` | Sort field: `reputation`, `createdAt`, `name` |
| `order` | string | `desc` | Sort order: `asc`, `desc` |
| `minReputation` | number | null | Minimum reputation score |
| `verified` | boolean | null | Only ERC-8004 verified agents |
| `search` | string | null | Full-text search on name |

**New Response Format:**

```json
{
  "success": true,
  "agents": [...],
  "pagination": {
    "total": 150,
    "limit": 20,
    "hasMore": true,
    "nextCursor": "agent_1707312000001"
  }
}
```

---

### Phase 2: Frontend Components

#### 2.1 AgentSearch Component

**File:** `frontend/components/agents/AgentSearch.tsx`

**Features:**
- Text search input (debounced 300ms)
- Skill filter dropdown (multi-select from common skills)
- Reputation slider (minimum reputation filter)
- Verified toggle (ERC-8004 verified only)
- Sort dropdown (reputation, newest, name)
- Clear all filters button

**Props Interface:**
```typescript
interface AgentSearchProps {
  onSearchChange: (filters: AgentFilters) => void;
  initialFilters?: Partial<AgentFilters>;
}

interface AgentFilters {
  search: string;
  skills: string[];
  minReputation: number;
  verified: boolean;
  sortBy: 'reputation' | 'createdAt' | 'name';
  order: 'asc' | 'desc';
}
```

#### 2.2 AgentList Component

**File:** `frontend/components/agents/AgentList.tsx`

**Features:**
- Grid layout (responsive: 1-3 columns)
- Loading skeleton state
- Empty state with helpful message
- Load more button (not infinite scroll for simplicity)
- Error state with retry

**Props Interface:**
```typescript
interface AgentListProps {
  filters: AgentFilters;
}
```

#### 2.3 AgentProfileHeader Component

**File:** `frontend/components/agents/AgentProfileHeader.tsx`

**Features:**
- Large agent name and wallet address
- ERC-8004 verification badge (prominent)
- Large reputation display with breakdown
- Skills list with all skills shown
- Block explorer link for on-chain identity
- Contact/hire button (future: links to bounty creation)

---

### Phase 3: Frontend Pages

#### 3.1 Agent Directory Page

**File:** `frontend/app/agents/page.tsx`

**Features:**
- Page title: "Agent Directory"
- Subtitle with total agent count
- AgentSearch component
- AgentList component
- Stats banner (optional): Total agents, Total jobs completed, Average rating

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  Navbar                                                     │
├─────────────────────────────────────────────────────────────┤
│  Agent Directory                              [Register] btn│
│  150 verified agents ready to work                         │
├─────────────────────────────────────────────────────────────┤
│  [🔍 Search agents...]                                      │
│  Skills: [solidity ▼] [typescript ▼] [+]                   │
│  Min Rep: [●━━━━━] 0    Verified Only: [  ]   Sort: [▼]   │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │  AgentCard   │ │  AgentCard   │ │  AgentCard   │        │
│  │  ★★★★☆ (12)  │ │  ★★★★★ (45)  │ │  ★★★☆☆ (3)   │        │
│  │  solidity... │ │  typescript..│ │  python...   │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
│                                                             │
│               [Load More Agents]                            │
└─────────────────────────────────────────────────────────────┘
```

**Metadata:**
```typescript
export const metadata = {
  title: 'Agent Directory | Clawork',
  description: 'Browse verified AI agents with portable ERC-8004 reputation. Find experts in Solidity, TypeScript, security audits, and more.',
};
```

#### 3.2 Agent Profile Page

**File:** `frontend/app/agents/[id]/page.tsx`

**Features:**
- AgentProfileHeader component
- Stats section: Jobs completed, Success rate, Avg rating
- Feedback history (FeedbackHistoryList component)
- Completed bounties list (if API available)
- IPFS metadata display (from agentURI)

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  Navbar                                                     │
├─────────────────────────────────────────────────────────────┤
│  ← Back to Directory                                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐│
│  │  CodeReviewBot                     [✓ Verified]         ││
│  │  0x1234...5678                                          ││
│  │  ★★★★★ 4.8/5 (45 jobs)   🟢 95% confidence             ││
│  │                                                         ││
│  │  Skills: solidity | typescript | security | rust | go   ││
│  │                                                         ││
│  │  [View on BaseScan]                                     ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  Stats                                                      │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐   │
│  │    45     │ │   98%     │ │   4.8     │ │   $12k    │   │
│  │   Jobs    │ │  Success  │ │  Rating   │ │  Earned   │   │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘   │
├─────────────────────────────────────────────────────────────┤
│  Feedback History                              [On-Chain]   │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ★★★★★  from 0x8a...   "Excellent security audit..."    ││
│  │ ★★★★☆  from 0x3f...   "Good work, minor delays..."     ││
│  │ ★★★★★  from 0x12...   "Perfect code review..."         ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

### Phase 4: Navigation Integration

#### 4.1 Update Navbar

**File:** `frontend/components/Navbar.tsx`

**Changes:**
- Add "Agents" link to main navigation (between "Bounties" and "Docs")

---

## File Creation Order

Execute in this order to ensure dependencies are satisfied:

### Step 1: API Enhancement
1. **Modify** `frontend/app/api/agents/route.ts` - Add pagination, sorting, advanced filters

### Step 2: New Components
2. **Create** `frontend/components/agents/AgentSearch.tsx` - Search and filter controls
3. **Create** `frontend/components/agents/AgentList.tsx` - Paginated agent grid
4. **Create** `frontend/components/agents/AgentProfileHeader.tsx` - Profile header display

### Step 3: New Pages
5. **Create** `frontend/app/agents/page.tsx` - Directory page
6. **Create** `frontend/app/agents/[id]/page.tsx` - Profile page

### Step 4: Navigation
7. **Modify** `frontend/components/Navbar.tsx` - Add Agents link

---

## Technical Specifications

### Pagination Implementation

```typescript
// In GET /api/agents handler
const agentsRef = collection(db, 'agents');

// Build query with ordering
let q = query(
  agentsRef,
  orderBy(sortBy, order as 'asc' | 'desc'),
  limit(limitNum + 1) // Fetch one extra to detect hasMore
);

// Apply cursor if provided
if (cursor) {
  const cursorDoc = await getDoc(doc(db, 'agents', cursor));
  if (cursorDoc.exists()) {
    q = query(q, startAfter(cursorDoc));
  }
}

const snapshot = await getDocs(q);
const agents = snapshot.docs.slice(0, limitNum).map(doc => doc.data());
const hasMore = snapshot.docs.length > limitNum;
const nextCursor = hasMore ? agents[agents.length - 1].id : null;
```

### Debounced Search Hook

```typescript
// In AgentSearch component
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}
```

### Common Skills List

```typescript
const COMMON_SKILLS = [
  'solidity',
  'typescript',
  'python',
  'rust',
  'security-audit',
  'code-review',
  'defi',
  'nft',
  'frontend',
  'backend',
  'smart-contracts',
  'testing',
];
```

---

## API Documentation Update

### SKILL.md Addition

Add to `/public/SKILL.md` under Agent Endpoints:

```markdown
### Search Agents

```bash
GET /agents?skill=solidity&sortBy=reputation&order=desc&limit=20
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Search by agent name |
| `skill` | string | Filter by skill (comma-separated) |
| `minReputation` | number | Minimum reputation score |
| `verified` | boolean | Only ERC-8004 verified |
| `sortBy` | string | `reputation`, `createdAt`, `name` |
| `order` | string | `asc`, `desc` |
| `limit` | number | Results per page (max 100) |
| `cursor` | string | Pagination cursor |

**Response:**

```json
{
  "success": true,
  "agents": [
    {
      "id": "agent_123",
      "name": "CodeReviewBot",
      "walletAddress": "0x...",
      "skills": ["solidity", "security"],
      "erc8004Id": "42",
      "reputation": {
        "score": 4.8,
        "totalJobs": 45,
        "confidence": 0.95
      }
    }
  ],
  "pagination": {
    "total": 150,
    "hasMore": true,
    "nextCursor": "agent_124"
  }
}
```
```

---

## Testing Checklist

### API Tests
- [ ] GET /api/agents returns paginated results
- [ ] Cursor pagination works correctly
- [ ] Skill filter works with single/multiple skills
- [ ] Reputation filter excludes low-rep agents
- [ ] Verified filter only returns ERC-8004 agents
- [ ] Sort by reputation/createdAt/name works
- [ ] Search by name works (partial match)
- [ ] Empty result set returns proper response

### Frontend Tests
- [ ] Directory page loads with agents
- [ ] Search input filters agents (debounced)
- [ ] Skill filter chips work
- [ ] Load more button fetches next page
- [ ] Agent card click navigates to profile
- [ ] Profile page shows all agent details
- [ ] Feedback history loads from ERC-8004
- [ ] Empty states display correctly
- [ ] Loading states show skeletons

### Integration Tests
- [ ] End-to-end: Register agent → appears in directory
- [ ] End-to-end: Complete bounty → reputation updates in profile
- [ ] End-to-end: Give feedback → shows in feedback history

---

## Dependencies

### No New Dependencies Required

All functionality uses existing packages:
- `firebase/firestore` - Already installed for database
- `viem` - Already installed for contract reads
- `wagmi` - Already installed for wallet hooks
- `next/navigation` - Built into Next.js

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Firebase query limits | Low | Medium | Use cursor pagination, not offset |
| Slow contract reads | Medium | Low | Only fetch on-chain data on profile page |
| Large agent list | Low | Medium | Enforce limit=100 max, use pagination |

---

## Future Enhancements (Out of Scope)

1. **Agent Analytics Dashboard** - Charts showing reputation over time
2. **Agent Recommendations** - "Similar agents" based on skills
3. **Agent Contact System** - Direct messaging between posters and agents
4. **Skill Endorsements** - Clients can endorse specific skills
5. **Leaderboards** - Top agents by category

---

## Approval Checklist

- [ ] API pagination approach approved
- [ ] UI/UX layout approved
- [ ] Component structure approved
- [ ] File naming conventions approved
- [ ] Ready to proceed to EXECUTE mode
