# Clawork Submission-Ready Test Log

## Test Window
- Date: **2026-02-08**
- Automated smoke timestamp (UTC): **2026-02-08T06:33:20.682Z**
- Workspace: `frontend/` on branch `lam_work`
- Baseline commit before these edits: `b3c8319545196fa2eac370a8883a080064523401`

## Environment Snapshot (non-secret)
- `NEXT_PUBLIC_DEFAULT_NETWORK`: set (Sepolia-first config)
- `NEXT_PUBLIC_SEPOLIA_RPC`: set
- `NEXT_PUBLIC_YELLOW_CLEARNODE`: set
- `NEXT_PUBLIC_SUPABASE_URL`: set
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: set
- `SUPABASE_SECRET_KEY`: set
- `NEXT_PUBLIC_SEPOLIA_IDENTITY_REGISTRY`: set
- `NEXT_PUBLIC_SEPOLIA_REPUTATION_REGISTRY`: set
- `NEXT_PUBLIC_SEPOLIA_ENS_REGISTRY`: set
- `YELLOW_MOCK_MODE=true`
- `YELLOW_SERVER_PRIVATE_KEY`: missing

## Automated API Test Evidence
- Artifact: `docs/hackmoney2026/test-artifacts/api_smoke_full_20260208_143314.json`
- Command:
  - `cd frontend && DEMO_BASE_URL=http://127.0.0.1:3001 npm run demo:api-smoke`
- Result: **20 passed / 0 failed**

### API Case Results
| # | Endpoint | Method | Expected | Result |
|---|---|---|---|---|
| 1 | `/api/waitlist` | GET | `400 INVALID_EMAIL` | PASS |
| 2 | `/api/waitlist` | POST | `200 success=true` | PASS |
| 3 | `/api/waitlist?email=...` | GET | `200 exists=true` | PASS |
| 4 | `/api/agents` | POST | `200 + agentId` | PASS |
| 5 | `/api/agents?limit=5` | GET | `200 agents[]` | PASS |
| 6 | `/api/agents/:id` | GET | `200 id match` | PASS |
| 7 | `/api/agents/:id` | PATCH | `200 success=true` | PASS |
| 8 | `/api/agents` | PATCH | `200 success=true` | PASS |
| 9 | `/api/agents/:id/reputation` | GET | `200 success=true` | PASS |
| 10 | `/api/bounties` | POST | `200 + bountyId` | PASS |
| 11 | `/api/bounties?limit=5` | GET | `200 bounties[]` | PASS |
| 12 | `/api/bounties/:id` | GET | `200 status OPEN` | PASS |
| 13 | `/api/bounties/:id/claim` | POST | `200 success=true` | PASS |
| 14 | `/api/bounties/:id/submit` | POST | `200 success=true` | PASS |
| 15 | `/api/bounties/:id/approve` | POST | `200 status COMPLETED` | PASS |
| 16 | `/api/bounties/:id` | GET | `200 status COMPLETED` | PASS |
| 17 | `/api/bounties` | POST | `200 + bountyId` | PASS |
| 18 | `/api/bounties/:id/claim` | POST | `200 success=true` | PASS |
| 19 | `/api/bounties/:id/dispute` | POST | `200 + disputeId` | PASS |
| 20 | `/api/bounties/:id` | GET | `200 disputeStatus=PENDING` | PASS |

## Sepolia Chain Evidence
- Artifact: `docs/hackmoney2026/test-artifacts/sepolia_chain_checks_20260208_143115.txt`
- Chain ID RPC response: `0xaa36a7` (Ethereum Sepolia)

### Address Deployment Check (`eth_getCode` length)
- `0x8004A818BFB912233c491871b3d84c89A494BD9e` (ERC-8004 Identity Registry): `262` (deployed)
- `0x8004B663056A597Dffe9eCcC1965A193B7388713` (ERC-8004 Reputation Registry): `262` (deployed)
- `0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e` (ENS Registry): `6350` (deployed)
- `0x019B65A265EB3363822f2752141b3dF16131b262` (Yellow Custody): `48424` (deployed)
- `0x7c7ccbc98469190849BCC6c926307794fDfB11F2` (Yellow Adjudicator): `14106` (deployed)
- `0xc7E6827ad9DA2c89188fAEd836F9285E6bFdCCCC` (Yellow Broker): `2` (no contract bytecode)
- `0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb` (Yellow Test USD): `5130` (deployed)

### Token Metadata Check (`eth_call`)
- Token decimals call returned `0x...06` => **6 decimals**
- Token name call returned hex for **"Yellow Test USD"**
- Token symbol call returned hex for **"ytest.USD"**

## Wallet-by-Wallet Demo Signoff
| Wallet | Required Live Action | Status |
|---|---|---|
| `W1` Poster | Create bounty -> approve completion | API pass; UI wallet signoff pending |
| `W2` Agent | Register -> claim -> submit -> ENS text write | API pass; ENS wallet signoff pending |
| `W1/W2` | Dispute path to `PENDING` | API pass; UI signoff pending |
| `W4` Observer | Verify statuses and ENS text records | Pending manual run |

## Known Gaps / Risks
- Yellow is currently running in **mock mode** (`YELLOW_MOCK_MODE=true`), so payout settlement tx hashes are simulated in local demo.
- `YELLOW_SERVER_PRIVATE_KEY` is not configured, so server-side SDK signer path cannot be validated in non-mock mode yet.
- ENS write flow requires live wallet signatures; this cannot be completed via headless API smoke.

## Submission Verdict
- **Backend/API readiness:** PASS (20/20 smoke cases).
- **Chain/address readiness for Sepolia:** PASS with one warning (Yellow Broker address has no bytecode).
- **Live demo readiness:** CONDITIONAL PASS, pending wallet-executed ENS write and non-mock Yellow signer setup if you want real settlement tx evidence.
