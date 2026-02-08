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

export type EnsRegistrationStep = {
  step: string;
  status: "success" | "failed" | "skipped";
  txHash?: `0x${string}`;
  error?: string;
};

export type RegisterEnsSubdomainResult = {
  ensName: string;
  resolverAddress: Address;
  created: boolean;
  resumed: boolean;
  verified: boolean;
  txHashes: {
    setSubnodeRecord: `0x${string}` | null;
    setAddr: `0x${string}` | null;
    setOwner: `0x${string}` | null;
    setText: `0x${string}`[];
  };
  steps: EnsRegistrationStep[];
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

/**
 * Verify that an ENS subdomain is correctly registered on-chain
 * by checking that the owner matches the expected address.
 */
export async function verifyEnsOnChain(
  ensName: string,
  expectedOwner: Address
): Promise<boolean> {
  try {
    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(getSepoliaRpcUrl()),
    });
    const registry = getRegistryAddress();
    const node = namehash(ensName);

    const owner = (await publicClient.readContract({
      address: registry,
      abi: ENS_REGISTRY_ABI,
      functionName: "owner",
      args: [node],
    })) as Address;

    const matches = owner.toLowerCase() === expectedOwner.toLowerCase();
    if (!matches) {
      console.warn(
        `[ENS] Verification failed for ${ensName}: expected owner ${expectedOwner}, got ${owner}`
      );
    }
    return matches;
  } catch (err) {
    console.error(`[ENS] Verification error for ${ensName}:`, err);
    return false;
  }
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

  console.log(`[ENS] Starting registration of ${ensName} for ${params.walletAddress}`);

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

    // Check existing subdomain ownership
    const existingSubdomainOwner = (await publicClient.readContract({
      address: registry,
      abi: ENS_REGISTRY_ABI,
      functionName: "owner",
      args: [subdomainNode],
    })) as Address;

    let resumed = false;
    let skipSubnodeRecord = false;

    if (existingSubdomainOwner !== zeroAddress) {
      // Already fully registered to the target wallet
      if (existingSubdomainOwner.toLowerCase() === params.walletAddress.toLowerCase()) {
        console.log(`[ENS] ${ensName} already owned by target wallet, skipping`);
        return {
          ensName,
          resolverAddress,
          created: false,
          resumed: false,
          verified: true,
          txHashes: {
            setSubnodeRecord: null,
            setAddr: null,
            setOwner: null,
            setText: [],
          },
          steps: [{ step: "check", status: "skipped", error: "Already registered to target wallet" }],
        };
      }

      // Admin wallet owns it — this is a partial registration from a previous attempt.
      // Resume from setAddr onwards.
      if (existingSubdomainOwner.toLowerCase() === account.address.toLowerCase()) {
        console.log(`[ENS] ${ensName} owned by admin (partial registration), resuming...`);
        resumed = true;
        skipSubnodeRecord = true;
      } else {
        throw new EnsSubdomainError(
          "ENS_SUBDOMAIN_TAKEN",
          `${ensName} is already owned by another wallet.`,
          409
        );
      }
    }

    const steps: EnsRegistrationStep[] = [];

    // Fetch nonce once and increment manually to avoid stale nonce issues
    // across the 4+ rapid sequential transactions
    let nonce = await publicClient.getTransactionCount({
      address: account.address,
    });

    // Step 1: setSubnodeRecord (create subdomain with admin as temporary owner)
    let setSubnodeRecordHash: `0x${string}` | null = null;
    if (skipSubnodeRecord) {
      steps.push({ step: "setSubnodeRecord", status: "skipped" });
      console.log(`[ENS] Step 1/4: setSubnodeRecord SKIPPED (resuming partial registration)`);
    } else {
      try {
        console.log(`[ENS] Step 1/4: setSubnodeRecord for ${ensName} (nonce: ${nonce})`);
        setSubnodeRecordHash = await walletClient.writeContract({
          address: registry,
          abi: ENS_REGISTRY_ABI,
          functionName: "setSubnodeRecord",
          args: [parentNode, labelHash, account.address, resolverAddress, 0n],
          account,
          chain: sepolia,
          nonce: nonce++,
        });
        await publicClient.waitForTransactionReceipt({ hash: setSubnodeRecordHash });
        steps.push({ step: "setSubnodeRecord", status: "success", txHash: setSubnodeRecordHash });
        console.log(`[ENS] Step 1/4: setSubnodeRecord OK — ${setSubnodeRecordHash}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        steps.push({ step: "setSubnodeRecord", status: "failed", error: msg });
        console.error(`[ENS] Step 1/4: setSubnodeRecord FAILED — ${msg}`);
        throw new EnsSubdomainError(
          "ENS_REGISTRATION_FAILED",
          `setSubnodeRecord failed: ${msg}`,
          500
        );
      }
    }

    // Step 2: setAddr (set ETH address record on resolver)
    let setAddrHash: `0x${string}` | null = null;
    try {
      console.log(`[ENS] Step 2/4: setAddr for ${ensName} → ${params.walletAddress} (nonce: ${nonce})`);
      setAddrHash = await walletClient.writeContract({
        address: resolverAddress,
        abi: ENS_RESOLVER_ABI,
        functionName: "setAddr",
        args: [subdomainNode, params.walletAddress],
        account,
        chain: sepolia,
        nonce: nonce++,
      });
      await publicClient.waitForTransactionReceipt({ hash: setAddrHash });
      steps.push({ step: "setAddr", status: "success", txHash: setAddrHash });
      console.log(`[ENS] Step 2/4: setAddr OK — ${setAddrHash}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      steps.push({ step: "setAddr", status: "failed", error: msg });
      console.error(`[ENS] Step 2/4: setAddr FAILED — ${msg}`);
      throw new EnsSubdomainError(
        "ENS_REGISTRATION_FAILED",
        `setAddr failed: ${msg}`,
        500
      );
    }

    // Step 3: setText (set text records — non-fatal, continue on failure)
    const setTextHashes: `0x${string}`[] = [];
    const textRecords = (params.textRecords || [])
      .map((record) => ({
        key: record.key.trim(),
        value: record.value.trim(),
      }))
      .filter((record) => record.key.length > 0 && record.value.length > 0);

    for (const record of textRecords) {
      try {
        console.log(`[ENS] Step 3/4: setText "${record.key}" = "${record.value}" (nonce: ${nonce})`);
        const setTextHash = await walletClient.writeContract({
          address: resolverAddress,
          abi: ENS_RESOLVER_ABI,
          functionName: "setText",
          args: [subdomainNode, record.key, record.value],
          account,
          chain: sepolia,
          nonce: nonce++,
        });
        await publicClient.waitForTransactionReceipt({ hash: setTextHash });
        setTextHashes.push(setTextHash);
        steps.push({ step: `setText:${record.key}`, status: "success", txHash: setTextHash });
        console.log(`[ENS] Step 3/4: setText "${record.key}" OK — ${setTextHash}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        steps.push({ step: `setText:${record.key}`, status: "failed", error: msg });
        console.warn(`[ENS] Step 3/4: setText "${record.key}" FAILED (non-fatal) — ${msg}`);
        // Non-fatal: continue to setOwner. Text records are supplementary.
        // Re-fetch nonce in case the failed tx consumed it or not
        nonce = await publicClient.getTransactionCount({ address: account.address });
      }
    }

    // Step 4: setOwner (transfer ownership from admin to agent)
    let setOwnerHash: `0x${string}` | null = null;
    try {
      console.log(`[ENS] Step 4/4: setOwner for ${ensName} → ${params.walletAddress} (nonce: ${nonce})`);
      setOwnerHash = await walletClient.writeContract({
        address: registry,
        abi: ENS_REGISTRY_ABI,
        functionName: "setOwner",
        args: [subdomainNode, params.walletAddress],
        account,
        chain: sepolia,
        nonce: nonce++,
      });
      await publicClient.waitForTransactionReceipt({ hash: setOwnerHash });
      steps.push({ step: "setOwner", status: "success", txHash: setOwnerHash });
      console.log(`[ENS] Step 4/4: setOwner OK — ${setOwnerHash}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      steps.push({ step: "setOwner", status: "failed", error: msg });
      console.error(`[ENS] Step 4/4: setOwner FAILED — ${msg}`);
      throw new EnsSubdomainError(
        "ENS_REGISTRATION_FAILED",
        `setOwner failed: ${msg}`,
        500
      );
    }

    // Verify on-chain state
    const verified = await verifyEnsOnChain(ensName, params.walletAddress);
    console.log(`[ENS] Registration complete for ${ensName}. Verified: ${verified}`);

    return {
      ensName,
      resolverAddress,
      created: true,
      resumed,
      verified,
      txHashes: {
        setSubnodeRecord: setSubnodeRecordHash,
        setAddr: setAddrHash,
        setOwner: setOwnerHash,
        setText: setTextHashes,
      },
      steps,
    };
  } catch (error) {
    if (error instanceof EnsSubdomainError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Unknown ENS registration error.";
    console.error(`[ENS] Unexpected registration error for ${ensName}:`, message);
    throw new EnsSubdomainError("ENS_REGISTRATION_FAILED", message, 500);
  }
}
