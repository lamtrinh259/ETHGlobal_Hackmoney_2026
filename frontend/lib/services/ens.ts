import {
  namehash,
  zeroAddress,
  type Address,
  type PublicClient,
  type WalletClient,
} from "viem";

import { ENS_RESOLVER_ABI, ENS_REGISTRY_ABI } from "@/lib/contracts/abis/ens";
import { ENS } from "@/lib/contracts/addresses";

function normalizeEnsName(ensName: string): string {
  return ensName.trim().toLowerCase();
}

export async function getEnsResolverAddress(
  publicClient: PublicClient,
  ensName: string
): Promise<Address | null> {
  const normalizedEnsName = normalizeEnsName(ensName);
  if (!normalizedEnsName) {
    return null;
  }

  const node = namehash(normalizedEnsName);
  const resolver = (await publicClient.readContract({
    address: ENS.REGISTRY,
    abi: ENS_REGISTRY_ABI,
    functionName: "resolver",
    args: [node],
  })) as Address;

  return resolver === zeroAddress ? null : resolver;
}

export async function readEnsTextRecord(
  publicClient: PublicClient,
  ensName: string,
  key: string
): Promise<string | null> {
  const normalizedEnsName = normalizeEnsName(ensName);
  const resolver = await getEnsResolverAddress(publicClient, normalizedEnsName);

  if (!resolver) {
    return null;
  }

  const node = namehash(normalizedEnsName);
  const value = (await publicClient.readContract({
    address: resolver,
    abi: ENS_RESOLVER_ABI,
    functionName: "text",
    args: [node, key],
  })) as string;

  return value || null;
}

export async function writeEnsTextRecord(params: {
  walletClient: WalletClient;
  publicClient: PublicClient;
  ensName: string;
  key: string;
  value: string;
}) {
  const { walletClient, publicClient, ensName, key, value } = params;
  const account = walletClient.account;

  if (!account) {
    throw new Error("Wallet account required");
  }

  const normalizedEnsName = normalizeEnsName(ensName);
  const resolver = await getEnsResolverAddress(publicClient, normalizedEnsName);

  if (!resolver) {
    throw new Error(
      "No resolver set for this ENS name. Set a resolver first in ENS App."
    );
  }

  const node = namehash(normalizedEnsName);

  const hash = await walletClient.writeContract({
    address: resolver,
    abi: ENS_RESOLVER_ABI,
    functionName: "setText",
    args: [node, key, value],
    account,
    chain: null,
  });

  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}
