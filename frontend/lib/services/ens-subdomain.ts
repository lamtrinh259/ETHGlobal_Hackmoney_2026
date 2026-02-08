import "server-only";

import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  keccak256,
  namehash,
  stringToHex,
  zeroAddress,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

import { ENS_RESOLVER_ABI, ENS_REGISTRY_ABI } from "@/lib/contracts/abis/ens";
import { ENS } from "@/lib/contracts/addresses";

const SUBDOMAIN_LABEL_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export class EnsSubdomainError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "EnsSubdomainError";
    this.code = code;
    this.status = status;
  }
}

export type EnsTextRecordInput = {
  key: string;
  value: string;
};

export type RegisterEnsSubdomainParams = {
  label: string;
  walletAddress: Address;
  textRecords?: EnsTextRecordInput[];
};

export type RegisterEnsSubdomainResult = {
  ensName: string;
  resolverAddress: Address;
  created: boolean;
  txHashes: {
    setSubnodeRecord: `0x${string}` | null;
    setAddr: `0x${string}` | null;
    setOwner: `0x${string}` | null;
    setText: `0x${string}`[];
  };
};

function normalizeLabel(input: string): string {
  return input.trim().toLowerCase();
}

function normalizeDomain(input: string): string {
  return input.trim().toLowerCase().replace(/\.$/, "");
}

function getAdminPrivateKey(): `0x${string}` {
  const raw = process.env.ENS_ADMIN_PRIVATE_KEY?.trim();
  if (!raw) {
    throw new EnsSubdomainError(
      "ENS_ADMIN_KEY_MISSING",
      "ENS auto-registration is not configured. Set ENS_ADMIN_PRIVATE_KEY on the server.",
      500
    );
  }

  const normalized = raw.startsWith("0x") ? raw : `0x${raw}`;
  return normalized as `0x${string}`;
}

function getSepoliaRpcUrl(): string {
  return (
    process.env.ENS_SEPOLIA_RPC ||
    process.env.NEXT_PUBLIC_SEPOLIA_RPC ||
    "https://ethereum-sepolia-rpc.publicnode.com"
  );
}

function getRegistryAddress(): Address {
  const candidate = process.env.NEXT_PUBLIC_SEPOLIA_ENS_REGISTRY || ENS.REGISTRY;
  if (!isAddress(candidate)) {
    throw new EnsSubdomainError(
      "ENS_REGISTRY_INVALID",
      "NEXT_PUBLIC_SEPOLIA_ENS_REGISTRY is not a valid address.",
      500
    );
  }
  return candidate;
}

function getConfiguredResolverAddress(): Address | null {
  const candidate = process.env.ENS_RESOLVER_ADDRESS?.trim();
  if (!candidate) {
    return null;
  }

  if (!isAddress(candidate)) {
    throw new EnsSubdomainError(
      "ENS_RESOLVER_INVALID",
      "ENS_RESOLVER_ADDRESS is not a valid address.",
      500
    );
  }

  return candidate;
}

function ensureValidSubdomainLabel(label: string) {
  if (!SUBDOMAIN_LABEL_REGEX.test(label)) {
    throw new EnsSubdomainError(
      "INVALID_SUBDOMAIN",
      "Subdomain must be lowercase letters, numbers, or hyphens (1-63 chars; no leading/trailing hyphen)."
    );
  }
}

export function getEnsParentDomain(): string {
  return normalizeDomain(process.env.ENS_PARENT_DOMAIN || "clawork.eth");
}

export function extractRequestedEnsLabel(input: string, parentDomain = getEnsParentDomain()) {
  const normalized = normalizeLabel(input);
  if (!normalized) {
    return null;
  }

  if (!normalized.includes(".")) {
    return normalized;
  }

  const suffix = `.${parentDomain}`;
  if (!normalized.endsWith(suffix)) {
    return null;
  }

  const label = normalized.slice(0, -suffix.length);
  if (!label || label.includes(".")) {
    throw new EnsSubdomainError(
      "INVALID_SUBDOMAIN",
      `Use a single label for ${parentDomain} (example: myagent or myagent.${parentDomain}).`
    );
  }

  return label;
}

export async function registerEnsSubdomain(
  params: RegisterEnsSubdomainParams
): Promise<RegisterEnsSubdomainResult> {
  const normalizedLabel = normalizeLabel(params.label);
  ensureValidSubdomainLabel(normalizedLabel);

  if (!isAddress(params.walletAddress)) {
    throw new EnsSubdomainError("INVALID_WALLET", "Invalid wallet address for ENS subdomain owner.");
  }

  const parentDomain = getEnsParentDomain();
  const ensName = `${normalizedLabel}.${parentDomain}`;

  const account = privateKeyToAccount(getAdminPrivateKey());
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(getSepoliaRpcUrl()),
  });
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(getSepoliaRpcUrl()),
  });

  const registry = getRegistryAddress();
  const parentNode = namehash(parentDomain);
  const subdomainNode = namehash(ensName);
  const labelHash = keccak256(stringToHex(normalizedLabel));

  try {
    const parentOwner = (await publicClient.readContract({
      address: registry,
      abi: ENS_REGISTRY_ABI,
      functionName: "owner",
      args: [parentNode],
    })) as Address;

    if (parentOwner === zeroAddress) {
      throw new EnsSubdomainError(
        "ENS_PARENT_NOT_REGISTERED",
        `${parentDomain} is not registered on Sepolia ENS.`,
        500
      );
    }

    if (parentOwner.toLowerCase() !== account.address.toLowerCase()) {
      throw new EnsSubdomainError(
        "ENS_ADMIN_NOT_PARENT_OWNER",
        `ENS_ADMIN_PRIVATE_KEY does not own ${parentDomain}.`,
        403
      );
    }

    const configuredResolver = getConfiguredResolverAddress();
    const resolverFromRegistry = (await publicClient.readContract({
      address: registry,
      abi: ENS_REGISTRY_ABI,
      functionName: "resolver",
      args: [parentNode],
    })) as Address;
    const resolverAddress = configuredResolver || resolverFromRegistry;

    if (resolverAddress === zeroAddress) {
      throw new EnsSubdomainError(
        "ENS_RESOLVER_MISSING",
        `${parentDomain} has no resolver set. Set a resolver in ENS App first.`,
        500
      );
    }

    const existingSubdomainOwner = (await publicClient.readContract({
      address: registry,
      abi: ENS_REGISTRY_ABI,
      functionName: "owner",
      args: [subdomainNode],
    })) as Address;

    if (existingSubdomainOwner !== zeroAddress) {
      if (existingSubdomainOwner.toLowerCase() === params.walletAddress.toLowerCase()) {
        return {
          ensName,
          resolverAddress,
          created: false,
          txHashes: {
            setSubnodeRecord: null,
            setAddr: null,
            setOwner: null,
            setText: [],
          },
        };
      }

      throw new EnsSubdomainError(
        "ENS_SUBDOMAIN_TAKEN",
        `${ensName} is already owned by another wallet.`,
        409
      );
    }

    const setSubnodeRecord = await walletClient.writeContract({
      address: registry,
      abi: ENS_REGISTRY_ABI,
      functionName: "setSubnodeRecord",
      args: [parentNode, labelHash, account.address, resolverAddress, 0n],
      account,
      chain: sepolia,
    });
    await publicClient.waitForTransactionReceipt({ hash: setSubnodeRecord });

    const setAddr = await walletClient.writeContract({
      address: resolverAddress,
      abi: ENS_RESOLVER_ABI,
      functionName: "setAddr",
      args: [subdomainNode, params.walletAddress],
      account,
      chain: sepolia,
    });
    await publicClient.waitForTransactionReceipt({ hash: setAddr });

    const setTextHashes: `0x${string}`[] = [];
    const textRecords = (params.textRecords || [])
      .map((record) => ({
        key: record.key.trim(),
        value: record.value.trim(),
      }))
      .filter((record) => record.key.length > 0 && record.value.length > 0);

    for (const record of textRecords) {
      const setText = await walletClient.writeContract({
        address: resolverAddress,
        abi: ENS_RESOLVER_ABI,
        functionName: "setText",
        args: [subdomainNode, record.key, record.value],
        account,
        chain: sepolia,
      });
      await publicClient.waitForTransactionReceipt({ hash: setText });
      setTextHashes.push(setText);
    }

    const setOwner = await walletClient.writeContract({
      address: registry,
      abi: ENS_REGISTRY_ABI,
      functionName: "setOwner",
      args: [subdomainNode, params.walletAddress],
      account,
      chain: sepolia,
    });
    await publicClient.waitForTransactionReceipt({ hash: setOwner });

    return {
      ensName,
      resolverAddress,
      created: true,
      txHashes: {
        setSubnodeRecord,
        setAddr,
        setOwner,
        setText: setTextHashes,
      },
    };
  } catch (error) {
    if (error instanceof EnsSubdomainError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Unknown ENS registration error.";
    throw new EnsSubdomainError("ENS_REGISTRATION_FAILED", message, 500);
  }
}
