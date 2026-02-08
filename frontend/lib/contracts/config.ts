'use client';

import { http } from 'wagmi';
import { sepolia, baseSepolia, base } from 'wagmi/chains';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

// Re-export addresses for convenience
export { CONTRACTS, YELLOW, ERC8004_CONTRACTS, CHAIN_CONFIG, DEFAULT_NETWORK, getContractsForNetwork } from './addresses';
export type { SupportedNetwork } from './addresses';

// RPC URLs from environment or defaults
const SEPOLIA_RPC = process.env.NEXT_PUBLIC_SEPOLIA_RPC || 'https://rpc.sepolia.org';
const BASE_SEPOLIA_RPC = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || 'https://sepolia.base.org';
const BASE_RPC = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org';

// Wagmi config with RainbowKit (client-only)
// Sepolia is primary for hackathon MVP
export const wagmiConfig = getDefaultConfig({
  appName: 'Clawork',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo',
  chains: [sepolia, baseSepolia, base],
  ssr: true,
  transports: {
    [sepolia.id]: http(SEPOLIA_RPC),
    [base.id]: http(BASE_RPC),
    [baseSepolia.id]: http(BASE_SEPOLIA_RPC),
  },
});

// Export chain objects for convenience
export const chains = {
  baseSepolia,
  base,
  sepolia,
} as const;
