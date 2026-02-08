import { createPublicClient, http, type Address } from 'viem';
import { sepolia, baseSepolia, base } from 'viem/chains';
import {
  ERC8004_CONTRACTS,
  CHAIN_CONFIG,
  DEFAULT_NETWORK,
  type SupportedNetwork
} from './addresses';
import { IDENTITY_REGISTRY_ABI } from './abis/identityRegistry';
import { REPUTATION_REGISTRY_ABI } from './abis/reputationRegistry';

// Chain mapping for viem
const CHAIN_MAP = {
  sepolia,
  baseSepolia,
  base,
} as const;

// Create a public client for a specific network
function createClientForNetwork(network: SupportedNetwork) {
  const chain = CHAIN_MAP[network];
  const rpc = CHAIN_CONFIG[network].rpc;

  return createPublicClient({
    chain,
    transport: http(rpc),
  });
}

// Pre-create clients for each network
const clients = {
  sepolia: createClientForNetwork('sepolia'),
  baseSepolia: createClientForNetwork('baseSepolia'),
  base: createClientForNetwork('base'),
};

// Get public client for a specific network
export function getPublicClient(network: SupportedNetwork = DEFAULT_NETWORK) {
  return clients[network];
}

// Get contracts for a specific network
export function getContracts(network: SupportedNetwork = DEFAULT_NETWORK) {
  return ERC8004_CONTRACTS[network];
}

// Legacy: Default public client (uses DEFAULT_NETWORK which is base)
export const publicClient = clients[DEFAULT_NETWORK];

// Current active network (can be changed at runtime)
let currentNetwork: SupportedNetwork = DEFAULT_NETWORK;

export function setCurrentNetwork(network: SupportedNetwork) {
  currentNetwork = network;
}

export function getCurrentNetwork(): SupportedNetwork {
  return currentNetwork;
}

// Check if address has an agent identity and return the token ID
export async function getAgentId(address: Address, network?: SupportedNetwork): Promise<bigint | null> {
  const net = network ?? currentNetwork;
  const client = getPublicClient(net);
  const contracts = getContracts(net);

  try {
    const balance = await client.readContract({
      address: contracts.IDENTITY_REGISTRY,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'balanceOf',
      args: [address],
    });

    if (balance === 0n) return null;

    const tokenId = await client.readContract({
      address: contracts.IDENTITY_REGISTRY,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'tokenOfOwnerByIndex',
      args: [address, 0n],
    });

    return tokenId;
  } catch (error) {
    console.error(`Error getting agent ID on ${net}:`, error);
    return null;
  }
}

// Check if address is registered
export async function isRegistered(address: Address, network?: SupportedNetwork): Promise<boolean> {
  const agentId = await getAgentId(address, network);
  return agentId !== null;
}

// Get total registered agents
export async function getTotalAgents(network?: SupportedNetwork): Promise<bigint> {
  const net = network ?? currentNetwork;
  const client = getPublicClient(net);
  const contracts = getContracts(net);

  try {
    const total = await client.readContract({
      address: contracts.IDENTITY_REGISTRY,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'totalSupply',
    });
    return total;
  } catch (error) {
    console.error(`Error getting total agents on ${net}:`, error);
    return 0n;
  }
}

// Get agent reputation
export async function getAgentReputation(agentId: bigint, network?: SupportedNetwork): Promise<{
  score: bigint;
  totalFeedback: bigint;
} | null> {
  const net = network ?? currentNetwork;
  const client = getPublicClient(net);
  const contracts = getContracts(net);

  try {
    const [score, totalFeedback] = await client.readContract({
      address: contracts.REPUTATION_REGISTRY,
      abi: REPUTATION_REGISTRY_ABI,
      functionName: 'getReputation',
      args: [agentId],
    });
    return { score, totalFeedback };
  } catch (error) {
    console.error(`Error getting reputation on ${net}:`, error);
    return null;
  }
}

// Get agent feedback history
export async function getAgentFeedback(agentId: bigint, network?: SupportedNetwork): Promise<
  Array<{
    from: Address;
    rating: number;
    comment: string;
    timestamp: bigint;
  }>
> {
  const net = network ?? currentNetwork;
  const client = getPublicClient(net);
  const contracts = getContracts(net);

  try {
    const feedback = await client.readContract({
      address: contracts.REPUTATION_REGISTRY,
      abi: REPUTATION_REGISTRY_ABI,
      functionName: 'getFeedback',
      args: [agentId],
    });
    return feedback as Array<{
      from: Address;
      rating: number;
      comment: string;
      timestamp: bigint;
    }>;
  } catch (error) {
    console.error(`Error getting feedback on ${net}:`, error);
    return [];
  }
}

// Get agent URI from identity registry
export async function getAgentURI(agentId: bigint, network?: SupportedNetwork): Promise<string | null> {
  const net = network ?? currentNetwork;
  const client = getPublicClient(net);
  const contracts = getContracts(net);

  try {
    const uri = await client.readContract({
      address: contracts.IDENTITY_REGISTRY,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'agentURI',
      args: [agentId],
    });
    return uri as string;
  } catch (error) {
    console.error(`Error getting agent URI on ${net}:`, error);
    return null;
  }
}

// Get delegated wallet for an agent
export async function getAgentWallet(agentId: bigint, network?: SupportedNetwork): Promise<Address | null> {
  const net = network ?? currentNetwork;
  const client = getPublicClient(net);
  const contracts = getContracts(net);

  try {
    const wallet = await client.readContract({
      address: contracts.IDENTITY_REGISTRY,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'getAgentWallet',
      args: [agentId],
    });
    return wallet as Address;
  } catch (error) {
    console.error(`Error getting agent wallet on ${net}:`, error);
    return null;
  }
}

// Get reputation summary with optional filters
export async function getReputationSummary(
  agentId: bigint,
  clientAddresses: Address[] = [],
  tag1: string = '',
  tag2: string = '',
  network?: SupportedNetwork
): Promise<{
  count: bigint;
  summaryValue: bigint;
  summaryValueDecimals: number;
} | null> {
  const net = network ?? currentNetwork;
  const client = getPublicClient(net);
  const contracts = getContracts(net);

  try {
    const result = await client.readContract({
      address: contracts.REPUTATION_REGISTRY,
      abi: REPUTATION_REGISTRY_ABI,
      functionName: 'getSummary',
      args: [agentId, clientAddresses, tag1, tag2],
    });

    const [count, summaryValue, summaryValueDecimals] = result as [bigint, bigint, number];
    return { count, summaryValue, summaryValueDecimals };
  } catch (error) {
    console.error(`Error getting reputation summary on ${net}:`, error);
    return null;
  }
}
