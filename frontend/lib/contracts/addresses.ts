// Contract addresses for ERC-8004 + Clawork integrations
// This file is safe to import on both client and server

// Network types
export type SupportedNetwork = "sepolia" | "baseSepolia" | "base";

// ERC-8004 Contract addresses per network
export const ERC8004_CONTRACTS = {
  // Ethereum Sepolia (primary hackathon deployment) - Chain ID 11155111
  sepolia: {
    IDENTITY_REGISTRY:
      (process.env.NEXT_PUBLIC_SEPOLIA_IDENTITY_REGISTRY ||
        "0x8004A818BFB912233c491871b3d84c89A494BD9e") as `0x${string}`,
    REPUTATION_REGISTRY:
      (process.env.NEXT_PUBLIC_SEPOLIA_REPUTATION_REGISTRY ||
        "0x8004B663056A597Dffe9eCcC1965A193B7388713") as `0x${string}`,
  },
  // Base Sepolia (testnet) - Chain ID 84532
  baseSepolia: {
    IDENTITY_REGISTRY:
      (process.env.NEXT_PUBLIC_BASE_SEPOLIA_IDENTITY_REGISTRY ||
        "0x8004A818BFB912233c491871b3d84c89A494BD9e") as `0x${string}`,
    REPUTATION_REGISTRY:
      (process.env.NEXT_PUBLIC_BASE_SEPOLIA_REPUTATION_REGISTRY ||
        "0x8004B663056A597Dffe9eCcC1965A193B7388713") as `0x${string}`,
  },
  // Base Mainnet - Chain ID 8453
  base: {
    IDENTITY_REGISTRY:
      (process.env.NEXT_PUBLIC_BASE_IDENTITY_REGISTRY ||
        "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432") as `0x${string}`,
    REPUTATION_REGISTRY:
      (process.env.NEXT_PUBLIC_BASE_REPUTATION_REGISTRY ||
        "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63") as `0x${string}`,
  },
} as const;

// Default network for the application
const configuredDefaultNetwork = process.env.NEXT_PUBLIC_DEFAULT_NETWORK as
  | SupportedNetwork
  | undefined;
export const DEFAULT_NETWORK: SupportedNetwork =
  configuredDefaultNetwork && configuredDefaultNetwork in ERC8004_CONTRACTS
    ? configuredDefaultNetwork
    : "sepolia";

// Legacy export for backward compatibility (uses default network)
export const CONTRACTS = ERC8004_CONTRACTS[DEFAULT_NETWORK];

// Helper to get contracts for a specific network
export function getContractsForNetwork(network: SupportedNetwork) {
  return ERC8004_CONTRACTS[network];
}

// Yellow Network addresses
export const YELLOW = {
  // ClearNode WebSocket endpoints
  CLEARNODE_SANDBOX: "wss://clearnet-sandbox.yellow.com/ws",
  CLEARNODE_PRODUCTION: "wss://clearnet.yellow.com/ws",
  // Use environment variable or default to sandbox
  CLEARNODE:
    process.env.NEXT_PUBLIC_YELLOW_CLEARNODE ||
    "wss://clearnet-sandbox.yellow.com/ws",

  // Yellow Network Contracts (cross-chain)
  CUSTODY:
    (process.env.NEXT_PUBLIC_YELLOW_CUSTODY ||
      "0x019B65A265EB3363822f2752141b3dF16131b262") as `0x${string}`,
  ADJUDICATOR:
    (process.env.NEXT_PUBLIC_YELLOW_ADJUDICATOR ||
      "0x7c7ccbc98469190849BCC6c926307794fDfB11F2") as `0x${string}`,
  BROKER:
    (process.env.NEXT_PUBLIC_YELLOW_BROKER ||
      "0xc7E6827ad9DA2c89188fAEd836F9285E6bFdCCCC") as `0x${string}`,

  // Test token (sandbox only)
  TEST_USD:
    (process.env.NEXT_PUBLIC_YELLOW_TEST_USD ||
      "0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb") as `0x${string}`,
};

// Stablecoin addresses per network (for Yellow Network payments)
export const STABLECOINS = {
  // Ethereum Sepolia fallback token
  sepolia: {
    USDC:
      (process.env.NEXT_PUBLIC_SEPOLIA_USDC ||
        process.env.NEXT_PUBLIC_YELLOW_TEST_USD ||
        "0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb") as `0x${string}`,
  },
  // Base Mainnet - Circle's official USDC
  base: {
    USDC:
      (process.env.NEXT_PUBLIC_BASE_USDC ||
        "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913") as `0x${string}`,
  },
  // Base Sepolia - Yellow Test USD for sandbox
  baseSepolia: {
    USDC:
      (process.env.NEXT_PUBLIC_YELLOW_TEST_USD ||
        "0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb") as `0x${string}`,
  },
} as const;

// Helper to get payment token for a network
export function getPaymentToken(network: SupportedNetwork): `0x${string}` {
  return STABLECOINS[network].USDC;
}

// Chain configurations
export const CHAIN_CONFIG = {
  sepolia: {
    chainId: 11155111,
    rpc: process.env.NEXT_PUBLIC_SEPOLIA_RPC || "https://rpc.sepolia.org",
    name: "Ethereum Sepolia",
    blockExplorer: "https://sepolia.etherscan.io",
  },
  baseSepolia: {
    chainId: 84532,
    rpc: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || "https://sepolia.base.org",
    name: "Base Sepolia",
    blockExplorer: "https://sepolia.basescan.org",
  },
  base: {
    chainId: 8453,
    rpc: process.env.NEXT_PUBLIC_BASE_RPC || "https://mainnet.base.org",
    name: "Base",
    blockExplorer: "https://basescan.org",
  },
} as const;

export const ENS = {
  REGISTRY:
    (process.env.NEXT_PUBLIC_SEPOLIA_ENS_REGISTRY ||
      "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e") as `0x${string}`,
} as const;

// Exports for convenience
export const SEPOLIA_CHAIN_ID = CHAIN_CONFIG.sepolia.chainId;
export const SEPOLIA_RPC = CHAIN_CONFIG.sepolia.rpc;
export const BASE_SEPOLIA_CHAIN_ID = CHAIN_CONFIG.baseSepolia.chainId;
export const BASE_SEPOLIA_RPC = CHAIN_CONFIG.baseSepolia.rpc;
export const BASE_CHAIN_ID = CHAIN_CONFIG.base.chainId;
export const BASE_RPC = CHAIN_CONFIG.base.rpc;
