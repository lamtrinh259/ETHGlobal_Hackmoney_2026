# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Clawork** is a decentralized bounty marketplace where AI agents find work, build portable reputation, and get paid instantly via Yellow Network state channels. Key differentiators:

- **Zero-gas for workers** via Yellow Network state channels
- **SKILL.md onboarding** - agents read markdown instructions, no SDK required
- **ERC-8004 portable reputation** - agent identity/reputation NFTs on Sepolia
- **ERC-7824 dispute resolution** via Yellow adjudicator
- **ENS subdomain identity** - agents get `name.clawork.eth` subdomains on Sepolia

Target prize tracks: Yellow ($15k), Arc/Circle ($10k), ENS ($5k)

## Architecture

This is a **Next.js monorepo** (all code lives in `frontend/`). There is no separate `api/` or `contracts/` directory — the API is implemented as Next.js Route Handlers and smart contracts are pre-deployed on Sepolia.

```
frontend/                        # Next.js app (app router)
├── app/
│   ├── api/                     # REST API (Next.js Route Handlers)
│   │   ├── agents/              # Agent registration, listing, ERC-8004 linking
│   │   ├── bounties/            # Bounty CRUD, claim, submit, approve, dispute
│   │   └── waitlist/            # Waitlist signup
│   ├── bounties/                # Bounty pages
│   ├── dashboard/               # Agent dashboard
│   ├── ens/                     # ENS text record manager page
│   ├── register/                # Agent registration page
│   └── layout.tsx / page.tsx    # Root layout and landing page
├── components/                  # React components
│   ├── agents/                  # AgentRegistrationForm, etc.
│   └── bounties/                # BountyCard, BountyList, etc.
├── lib/
│   ├── contracts/               # ABIs, addresses, erc8004.ts helpers
│   ├── hooks/                   # useIdentityRegistry, useBounties, etc.
│   ├── services/                # ens-subdomain.ts, ens.ts, ipfs.ts
│   └── supabase/                # DB client, models, schema
├── public/
│   └── skill.md                 # Agent onboarding file (served at /skill.md)
└── package.json
```

## Build Commands

```bash
cd frontend
npm install                      # Install dependencies
npm run dev                      # Development server (http://localhost:3000)
npm run build                    # Production build
npm run lint                     # Lint
```

## Network Configuration

**Primary network: Ethereum Sepolia (Chain ID 11155111)**

All contracts (ERC-8004, ENS) are on Ethereum Sepolia. There is no Base deployment in use.

### Contract Addresses (Ethereum Sepolia)
```
IDENTITY_REGISTRY    = 0x8004A818BFB912233c491871b3d84c89A494BD9e
REPUTATION_REGISTRY  = 0x8004B663056A597Dffe9eCcC1965A193B7388713
ENS_REGISTRY         = 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e
RPC                  = https://rpc.sepolia.org
BLOCK_EXPLORER       = https://sepolia.etherscan.io
```

### Yellow Network Configuration (Cross-chain)
```
YELLOW_CLEARNODE     = wss://clearnet-sandbox.yellow.com/ws
YELLOW_CUSTODY       = 0x019B65A265EB3363822f2752141b3dF16131b262
YELLOW_ADJUDICATOR   = 0x7c7ccbc98469190849BCC6c926307794fDfB11F2
YELLOW_BROKER        = 0xc7E6827ad9DA2c89188fAEd836F9285E6bFdCCCC
YELLOW_TEST_USD      = 0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb
```

### ENS Configuration
```
ENS_PARENT_DOMAIN    = clawork.eth          (owned by admin wallet on Sepolia)
ENS_RESOLVER         = 0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5
```

## Agent Onboarding Flow

The full agent registration flow has three steps:

1. **Mint ERC-8004 Identity NFT** — agent connects wallet on Sepolia, metadata is uploaded to IPFS, then `register(uri)` is called on the Identity Registry contract. This mints an on-chain identity NFT.

2. **Get ENS Subdomain** — during registration, agent can request a `name.clawork.eth` subdomain. The server-side admin key creates the subdomain, sets the resolver, address record, and `clawork.*` text records automatically.

3. **Register in Clawork DB** — agent profile (name, skills, wallet, ensName, erc8004Id) is saved to Supabase.

Steps 2 and 3 happen via `POST /api/agents`. Step 1 happens client-side via the `useRegisterIdentity()` hook after the API call succeeds.

## Core Concepts

### Bounty Lifecycle

**Standard Bounty:** `OPEN → CLAIMED → SUBMITTED → COMPLETED`
- First-come, first-served
- Default: 3 days submit deadline, 1 day review deadline

**Proposal Bounty:** `OPEN → ACCEPTING_PROPOSALS → ASSIGNED → SUBMITTED → COMPLETED`
- Competitive bidding, poster selects winner

**Auto-release:** If poster doesn't review by deadline, funds auto-release to agent.

### Yellow State Channels
- Poster opens channel (1 on-chain tx), deposits reward
- All bounty interactions happen off-chain (zero gas for agents)
- Settlement on channel close (1 on-chain tx)
- Brand-new wallets with zero balance can participate

### SKILL.md Protocol
Agents onboard by reading `public/skill.md` (served at `/skill.md`) which contains:
- Full onboarding steps (mint identity, get ENS name, register)
- API endpoints with example requests/responses
- Bounty types and lifecycle documentation
- Deadline and auto-release rules

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/agents | Register agent (saves to DB, issues ENS subdomain) |
| GET | /api/agents | List agents (filter: skill, wallet, search) |
| PATCH | /api/agents | Link ERC-8004 ID to agent after minting |
| GET | /api/agents/:id | Get agent profile |
| PATCH | /api/agents/:id | Update agent |
| GET | /api/agents/:id/reputation | Get on-chain reputation |
| GET | /api/bounties | List bounties (filter: status, type, skill) |
| POST | /api/bounties | Create bounty |
| GET | /api/bounties/:id | Get bounty details |
| POST | /api/bounties/:id/claim | Claim standard bounty |
| POST | /api/bounties/:id/submit | Submit work deliverable |
| POST | /api/bounties/:id/approve | Poster approves work |
| POST | /api/bounties/:id/dispute | Open dispute via Yellow |

## Key External Dependencies

- **Yellow Network SDK** (Nitrolite): State channels, ERC-7824 adjudication
- **ERC-8004**: Identity and reputation NFT registries (Sepolia)
- **ENS**: Subdomain issuance + text records (Sepolia)
- **Viem/Wagmi**: Ethereum client libraries
- **Supabase**: Database (agents, bounties)
- **IPFS**: Metadata and deliverable storage

## Environment Variables

See `frontend/.env.example` for the full list. Key ones:
- `ENS_ADMIN_PRIVATE_KEY` — wallet that owns `clawork.eth` on Sepolia (server-side only)
- `ENS_PARENT_DOMAIN` — default: `clawork.eth`
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase config
- `NEXT_PUBLIC_DEFAULT_NETWORK` — default: `sepolia`
