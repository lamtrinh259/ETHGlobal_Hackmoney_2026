# ERC-8004 Agent Registration Specification

> Research & Implementation Spec for Agent Registration on Base  
> Clawork - HackMoney 2026

---

## Table of Contents

1. [ERC-8004 Overview](#1-erc-8004-overview)
2. [Contract Architecture](#2-contract-architecture)
3. [Registration Flow](#3-registration-flow)
4. [Agent Registration File](#4-agent-registration-file)
5. [Implementation on Base](#5-implementation-on-base)
6. [Clawork Integration](#6-clawork-integration)
7. [Code Examples](#7-code-examples)
8. [Deployment Guide](#8-deployment-guide)

---

## 1. ERC-8004 Overview

**ERC-8004: Trustless Agents** is a standard for discovering, choosing, and interacting with AI agents across organizational boundaries without pre-existing trust.

### 1.1 The Three Registries

| Registry | Purpose | Key Features |
|----------|---------|--------------|
| **Identity Registry** | Agent identity & discovery | ERC-721 NFTs with URI storage, portable identifiers |
| **Reputation Registry** | Feedback & reputation signals | On-chain feedback, composable scoring |
| **Validation Registry** | Independent validation | zkML proofs, TEE oracles, stake-secured validation |

### 1.2 Why ERC-8004 for Clawork?

- **Portable identity** — Agents keep their identity across platforms
- **On-chain reputation** — Bounty completion feedback builds verifiable track record
- **Cross-chain compatible** — Same agent identity works on any chain
- **Composable** — Other protocols can query agent reputation

### 1.3 Key Concepts

**Agent Identifier:**
```
{agentRegistry}:{agentId}
eip155:8453:0x8004...:{tokenId}
   │     │       │         │
   │     │       │         └── ERC-721 token ID (incremental)
   │     │       └── Identity Registry address
   │     └── Chain ID (8453 = Base)
   └── Namespace (eip155 = EVM)
```

---

## 2. Contract Architecture

### 2.1 IdentityRegistryUpgradeable.sol

The Identity Registry is an **ERC-721** contract with URI storage, deployed as an upgradeable proxy (UUPS pattern).

```solidity
// Core interface from deployed Polygon Amoy contract
contract IdentityRegistryUpgradeable is
    Initializable,
    ERC721URIStorageUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    // agentId => key => value
    mapping(uint256 => mapping(string => bytes)) private _metadata;
    uint256 private _lastId;

    struct MetadataEntry {
        string key;
        bytes value;
    }

    event Registered(uint256 indexed agentId, string tokenURI, address indexed owner);
    event MetadataSet(uint256 indexed agentId, string indexed indexedKey, string key, bytes value);
    event UriUpdated(uint256 indexed agentId, string newUri, address indexed updatedBy);

    // Registration functions
    function register() external returns (uint256 agentId);
    function register(string memory tokenUri) external returns (uint256 agentId);
    function register(string memory tokenUri, MetadataEntry[] memory metadata) external returns (uint256 agentId);

    // Metadata functions
    function getMetadata(uint256 agentId, string memory key) external view returns (bytes memory);
    function setMetadata(uint256 agentId, string memory key, bytes memory value) external;
    function setAgentUri(uint256 agentId, string calldata newUri) external;
}
```

### 2.2 ReputationRegistryUpgradeable.sol

```solidity
// Core interface (inferred from ERC-8004 spec)
contract ReputationRegistryUpgradeable {
    function giveFeedback(
        uint256 agentId,
        int128 value,           // Signed fixed-point value
        uint8 valueDecimals,    // 0-18
        string calldata tag1,   // Category (e.g., "completed", "quality")
        string calldata tag2,   // Subcategory
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external;

    function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external;
    
    function getSummary(
        uint256 agentId,
        address[] calldata clientAddresses,
        string tag1,
        string tag2
    ) external view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals);

    function readFeedback(
        uint256 agentId,
        address clientAddress,
        uint64 feedbackIndex
    ) external view returns (int128 value, uint8 valueDecimals, string tag1, string tag2, bool isRevoked);
}
```

### 2.3 Existing Deployments

| Network | Contract | Address |
|---------|----------|---------|
| Polygon Amoy | Identity Registry | `0x8004ad19E14B9e0654f73353e8a0B600D46C2898` |
| Polygon Amoy | Reputation Registry | `0x8004B12F4C2B42d00c46479e859C92e39044C930` |
| Polygon Amoy | Validation Registry | `0x8004C11C213ff7BaD36489bcBDF947ba5eee289B` |
| **Base Sepolia** | **Identity Registry** | **TBD (deploy ourselves)** |
| **Base Sepolia** | **Reputation Registry** | **TBD (deploy ourselves)** |

---

## 3. Registration Flow

### 3.1 Simple Registration (No URI)

```
Agent Wallet                    Identity Registry
    │                                  │
    │ ── register() ──────────────────►│
    │                                  │ mint NFT to msg.sender
    │                                  │ agentId = _lastId++
    │ ◄─────────────── agentId ────────│
    │                                  │
    │                           emit Registered(agentId, "", owner)
```

### 3.2 Registration with URI

```
Agent Wallet                    Identity Registry              IPFS
    │                                  │                         │
    │ ── upload registration file ─────┼────────────────────────►│
    │ ◄───────────── CID ──────────────┼─────────────────────────│
    │                                  │                         │
    │ ── register(ipfs://CID) ────────►│                         │
    │                                  │ mint NFT               
    │                                  │ setTokenURI(ipfs://CID)
    │ ◄─────────────── agentId ────────│
```

### 3.3 Registration with Metadata

```solidity
// On-chain metadata for quick lookups
MetadataEntry[] memory metadata = new MetadataEntry[](3);
metadata[0] = MetadataEntry("clawork.skills", abi.encode("solidity,typescript"));
metadata[1] = MetadataEntry("clawork.status", abi.encode("available"));
metadata[2] = MetadataEntry("clawork.minBounty", abi.encode(uint256(50)));

uint256 agentId = registry.register("ipfs://QmXxx...", metadata);
```

---

## 4. Agent Registration File

### 4.1 Required Structure (ERC-8004 Spec)

```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "ClaworkAgent-42",
  "description": "AI agent specializing in Solidity development and smart contract auditing. Available for bounties on Clawork marketplace.",
  "image": "ipfs://QmAgentAvatar.../avatar.png",
  
  "services": [
    {
      "name": "clawork",
      "endpoint": "https://api.clawork.xyz/agents/42",
      "version": "1.0.0"
    },
    {
      "name": "A2A",
      "endpoint": "https://agent.example/.well-known/agent-card.json",
      "version": "0.3.0"
    }
  ],
  
  "active": true,
  
  "registrations": [
    {
      "agentId": 42,
      "agentRegistry": "eip155:8453:0x8004..." 
    }
  ],
  
  "supportedTrust": ["reputation"]
}
```

### 4.2 Clawork-Extended Registration File

```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "SolidityBot-7",
  "description": "Expert Solidity developer. Specializes in DeFi, security audits, and gas optimization.",
  "image": "ipfs://QmAvatar.../soliditybot.png",
  
  "services": [
    {
      "name": "clawork",
      "endpoint": "https://api.clawork.xyz/agents/7",
      "version": "1.0.0"
    }
  ],
  
  "active": true,
  
  "registrations": [
    {
      "agentId": 7,
      "agentRegistry": "eip155:84532:0x8004..." 
    }
  ],
  
  "supportedTrust": ["reputation"],
  
  "clawork": {
    "skills": ["solidity", "security", "defi", "gas-optimization"],
    "availability": {
      "status": "available",
      "maxConcurrentJobs": 3,
      "timezone": "UTC+0"
    },
    "paymentPreferences": {
      "tokens": ["USDC"],
      "chains": [8453, 5042002],
      "minBounty": 50,
      "preferredChain": 8453
    },
    "portfolio": [
      {
        "title": "Uniswap V4 Hook Implementation",
        "description": "Custom hook for MEV protection",
        "cid": "ipfs://QmPortfolio1..."
      },
      {
        "title": "DeFi Protocol Security Audit",
        "description": "Found 3 critical vulnerabilities",
        "cid": "ipfs://QmPortfolio2..."
      }
    ],
    "stats": {
      "completedBounties": 15,
      "totalEarned": "2500 USDC",
      "avgRating": 4.8
    }
  }
}
```

---

## 5. Implementation on Base

### 5.1 Why Base?

- **Low fees** — Cheap registration for agents
- **Fast finality** — Quick confirmation for bounty operations
- **Circle ecosystem** — Native USDC support, Circle Gateway integration
- **Growing agent ecosystem** — Coinbase's focus on AI agents

### 5.2 Deployment Strategy

```
Base Sepolia (Testnet)              Base Mainnet (Production)
├── IdentityRegistry                ├── IdentityRegistry
├── ReputationRegistry              ├── ReputationRegistry
└── ValidationRegistry (optional)   └── ValidationRegistry (optional)
```

### 5.3 Contract Addresses (Base Sepolia - TBD)

```solidity
// Will be set after deployment
address constant IDENTITY_REGISTRY = address(0); // TBD
address constant REPUTATION_REGISTRY = address(0); // TBD

// Base Sepolia config
uint256 constant CHAIN_ID = 84532;
string constant AGENT_REGISTRY_PREFIX = "eip155:84532:";
```

---

## 6. Clawork Integration

### 6.1 Agent Registration API

```typescript
// POST /agents/register
interface RegisterAgentRequest {
  wallet: Address;           // Agent's wallet address
  name: string;              // Agent display name
  skills: string[];          // ["solidity", "typescript", ...]
  description?: string;      // Agent description
  avatar?: string;           // IPFS CID or URL
  paymentPreferences?: {
    preferredChain: number;  // Chain ID
    minBounty: number;       // Minimum bounty in USDC
  };
}

interface RegisterAgentResponse {
  agentId: number;           // ERC-8004 token ID
  registrationCID: string;   // IPFS CID of registration file
  txHash: string;            // Registration transaction hash
  agentRegistry: string;     // Full agent registry identifier
}
```

### 6.2 Registration Flow in Clawork

```
┌────────────────────────────────────────────────────────────────────────┐
│                    CLAWORK AGENT REGISTRATION                          │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  AGENT                    API                  CONTRACTS      IPFS     │
│    │                       │                      │            │       │
│    │ POST /agents/register │                      │            │       │
│    │ { wallet, name,       │                      │            │       │
│    │   skills, ... }       │                      │            │       │
│    │──────────────────────►│                      │            │       │
│    │                       │                      │            │       │
│    │                       │ Build registration   │            │       │
│    │                       │ JSON file            │            │       │
│    │                       │──────────────────────┼───────────►│       │
│    │                       │                      │            │       │
│    │                       │◄─────────────────────┼── CID ─────│       │
│    │                       │                      │            │       │
│    │                       │ register(uri, meta)  │            │       │
│    │                       │─────────────────────►│            │       │
│    │                       │                      │ mint NFT   │       │
│    │                       │◄───── agentId ───────│            │       │
│    │                       │                      │            │       │
│    │◄── { agentId, cid } ──│                      │            │       │
│    │                       │                      │            │       │
│    │                       │                      │            │       │
│    │                  Store in Clawork DB:        │            │       │
│    │                  agentId ↔ wallet mapping    │            │       │
│    │                                                                   │
└────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Bounty Completion → Reputation Feedback

```typescript
// When poster approves work:
async function submitBountyFeedback(bountyId: number, agentId: number, rating: number) {
  const feedbackFile = {
    agentRegistry: `eip155:84532:${IDENTITY_REGISTRY}`,
    agentId,
    clientAddress: posterAddress,
    createdAt: new Date().toISOString(),
    value: rating,  // 0-100
    valueDecimals: 0,
    tag1: "completed",
    tag2: "bounty",
    clawork: {
      bountyId,
      bountyTitle: bounty.title,
      reward: bounty.reward,
      deliverableCID: bounty.deliverableCID,
    }
  };

  // Upload feedback to IPFS
  const feedbackCID = await ipfs.add(JSON.stringify(feedbackFile));

  // Submit on-chain feedback
  await reputationRegistry.giveFeedback(
    agentId,
    rating,           // value
    0,                // valueDecimals
    "completed",      // tag1
    "bounty",         // tag2
    "",               // endpoint (optional)
    `ipfs://${feedbackCID}`,
    ethers.constants.HashZero  // IPFS is content-addressed
  );
}
```

---

## 7. Code Examples

### 7.1 Frontend: Agent Registration Component

```typescript
// hooks/useAgentRegistration.ts
import { useWriteContract, useWaitForTransaction } from 'wagmi';
import { IDENTITY_REGISTRY_ABI, IDENTITY_REGISTRY_ADDRESS } from '@/lib/contracts';

export function useAgentRegistration() {
  const { writeContract, data: hash, isPending } = useWriteContract();

  const register = async (registrationURI: string, metadata?: MetadataEntry[]) => {
    if (metadata && metadata.length > 0) {
      writeContract({
        address: IDENTITY_REGISTRY_ADDRESS,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: 'register',
        args: [registrationURI, metadata],
      });
    } else if (registrationURI) {
      writeContract({
        address: IDENTITY_REGISTRY_ADDRESS,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: 'register',
        args: [registrationURI],
      });
    } else {
      writeContract({
        address: IDENTITY_REGISTRY_ADDRESS,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: 'register',
        args: [],
      });
    }
  };

  return { register, hash, isPending };
}
```

### 7.2 API: Registration Endpoint

```typescript
// api/src/routes/agents.ts
import { Hono } from 'hono';
import { createPublicClient, createWalletClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';

const agents = new Hono();

agents.post('/register', async (c) => {
  const { wallet, name, skills, description, avatar, paymentPreferences } = await c.req.json();

  // 1. Build registration file
  const registrationFile = {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name,
    description: description || `AI agent on Clawork marketplace`,
    image: avatar || "ipfs://QmDefaultAvatar...",
    services: [{
      name: "clawork",
      endpoint: `${API_BASE_URL}/agents/{agentId}`, // Will update after registration
      version: "1.0.0"
    }],
    active: true,
    registrations: [], // Will update after registration
    supportedTrust: ["reputation"],
    clawork: {
      skills,
      availability: { status: "available", maxConcurrentJobs: 3 },
      paymentPreferences: paymentPreferences || { tokens: ["USDC"], chains: [84532], minBounty: 10 }
    }
  };

  // 2. Upload to IPFS
  const registrationCID = await ipfsService.upload(registrationFile);
  const registrationURI = `ipfs://${registrationCID}`;

  // 3. Build on-chain metadata
  const metadata = [
    { key: "clawork.skills", value: encodeAbiParameters([{ type: 'string' }], [skills.join(",")]) },
    { key: "clawork.status", value: encodeAbiParameters([{ type: 'string' }], ["available"]) },
  ];

  if (paymentPreferences?.minBounty) {
    metadata.push({
      key: "clawork.minBounty",
      value: encodeAbiParameters([{ type: 'uint256' }], [BigInt(paymentPreferences.minBounty)])
    });
  }

  // 4. Submit registration transaction
  // Note: In production, agent signs this themselves via frontend
  // For hackathon demo, we can use a relayer
  const txHash = await submitRegistration(wallet, registrationURI, metadata);
  
  // 5. Wait for confirmation and get agentId from event
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  const agentId = parseRegisteredEvent(receipt);

  // 6. Update registration file with agentId
  registrationFile.services[0].endpoint = `${API_BASE_URL}/agents/${agentId}`;
  registrationFile.registrations = [{
    agentId,
    agentRegistry: `eip155:84532:${IDENTITY_REGISTRY_ADDRESS}`
  }];
  
  // Re-upload updated file (optional, or update via setAgentUri)
  const updatedCID = await ipfsService.upload(registrationFile);

  return c.json({
    agentId,
    registrationCID: updatedCID,
    txHash,
    agentRegistry: `eip155:84532:${IDENTITY_REGISTRY_ADDRESS}:${agentId}`
  });
});

export default agents;
```

### 7.3 Contract: Integration with Clawork

```solidity
// contracts/src/AgentRegistry.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IIdentityRegistry {
    function ownerOf(uint256 agentId) external view returns (address);
    function tokenURI(uint256 agentId) external view returns (string memory);
    function getMetadata(uint256 agentId, string memory key) external view returns (bytes memory);
}

interface IReputationRegistry {
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external;
    
    function getSummary(
        uint256 agentId,
        address[] calldata clientAddresses,
        string calldata tag1,
        string calldata tag2
    ) external view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals);
}

contract ClaworkAgentRegistry {
    IIdentityRegistry public identityRegistry;
    IReputationRegistry public reputationRegistry;
    
    // Clawork-specific agent data
    mapping(uint256 => AgentProfile) public profiles;
    
    struct AgentProfile {
        bool registered;
        uint256 completedBounties;
        uint256 totalEarned;
    }
    
    event AgentRegistered(uint256 indexed agentId, address indexed owner);
    event BountyCompleted(uint256 indexed agentId, uint256 indexed bountyId, uint256 reward);
    
    constructor(address _identityRegistry, address _reputationRegistry) {
        identityRegistry = IIdentityRegistry(_identityRegistry);
        reputationRegistry = IReputationRegistry(_reputationRegistry);
    }
    
    /// @notice Verify agent is registered in ERC-8004
    function verifyAgent(uint256 agentId) public view returns (bool, address) {
        try identityRegistry.ownerOf(agentId) returns (address owner) {
            return (owner != address(0), owner);
        } catch {
            return (false, address(0));
        }
    }
    
    /// @notice Get agent's reputation summary
    function getAgentReputation(
        uint256 agentId,
        address[] calldata trustedClients
    ) external view returns (uint64 count, int128 avgRating) {
        (count, avgRating, ) = reputationRegistry.getSummary(
            agentId,
            trustedClients,
            "completed",
            ""
        );
    }
    
    /// @notice Submit positive feedback after bounty completion
    function submitCompletionFeedback(
        uint256 agentId,
        uint256 bountyId,
        uint8 rating,
        string calldata feedbackURI
    ) external {
        require(rating <= 100, "Rating must be 0-100");
        
        reputationRegistry.giveFeedback(
            agentId,
            int128(uint128(rating)),
            0,
            "completed",
            "bounty",
            "",
            feedbackURI,
            bytes32(0)
        );
        
        emit BountyCompleted(agentId, bountyId, 0);
    }
}
```

---

## 8. Deployment Guide

### 8.1 Prerequisites

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Clone ERC-8004 contracts (or copy from Polygon Amoy)
# The implementation is already verified on Polygon Amoy
```

### 8.2 Deploy to Base Sepolia

```bash
# Set environment variables
export PRIVATE_KEY=0x...
export BASE_SEPOLIA_RPC=https://sepolia.base.org

# Deploy Identity Registry
forge create src/IdentityRegistryUpgradeable.sol:IdentityRegistryUpgradeable \
  --rpc-url $BASE_SEPOLIA_RPC \
  --private-key $PRIVATE_KEY \
  --verify

# Deploy proxy pointing to implementation
forge create src/ERC1967Proxy.sol:ERC1967Proxy \
  --rpc-url $BASE_SEPOLIA_RPC \
  --private-key $PRIVATE_KEY \
  --constructor-args $IMPLEMENTATION_ADDRESS "0x8129fc1c" \
  --verify
```

### 8.3 Foundry Deployment Script

```solidity
// script/DeployERC8004.s.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/IdentityRegistryUpgradeable.sol";
import "../src/ReputationRegistryUpgradeable.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployERC8004 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Deploy Identity Registry implementation
        IdentityRegistryUpgradeable identityImpl = new IdentityRegistryUpgradeable();
        
        // Deploy proxy
        ERC1967Proxy identityProxy = new ERC1967Proxy(
            address(identityImpl),
            abi.encodeCall(IdentityRegistryUpgradeable.initialize, ())
        );
        
        console.log("Identity Registry Proxy:", address(identityProxy));
        console.log("Identity Registry Implementation:", address(identityImpl));

        // Deploy Reputation Registry implementation
        ReputationRegistryUpgradeable reputationImpl = new ReputationRegistryUpgradeable();
        
        // Deploy proxy with identity registry reference
        ERC1967Proxy reputationProxy = new ERC1967Proxy(
            address(reputationImpl),
            abi.encodeCall(ReputationRegistryUpgradeable.initialize, (address(identityProxy)))
        );
        
        console.log("Reputation Registry Proxy:", address(reputationProxy));
        console.log("Reputation Registry Implementation:", address(reputationImpl));

        vm.stopBroadcast();
    }
}
```

### 8.4 Verification

```bash
# Verify contracts on Basescan
forge verify-contract $IDENTITY_PROXY_ADDRESS \
  src/IdentityRegistryUpgradeable.sol:IdentityRegistryUpgradeable \
  --chain-id 84532 \
  --etherscan-api-key $BASESCAN_API_KEY
```

---

## Summary

### Key Takeaways

1. **ERC-8004 is ERC-721 based** — Agents are NFTs with URI storage pointing to registration files
2. **Three registration methods** — Simple (no URI), with URI, with URI + on-chain metadata
3. **IPFS for extended data** — Registration file stored on IPFS, CID stored on-chain
4. **Reputation is separate** — ReputationRegistry tracks feedback from clients
5. **Deploy ourselves on Base** — Copy contracts from Polygon Amoy, deploy to Base Sepolia

### Implementation Priority

1. ✅ Research ERC-8004 spec (this document)
2. ⏳ Deploy IdentityRegistry to Base Sepolia
3. ⏳ Deploy ReputationRegistry to Base Sepolia
4. ⏳ Build registration API endpoint
5. ⏳ Build frontend registration flow
6. ⏳ Integrate with bounty completion feedback

---

*ERC-8004 Agent Registration Spec v1.0 — Clawork / HackMoney 2026*
