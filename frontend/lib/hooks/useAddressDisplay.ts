'use client';

import { useEffect, useMemo, useState } from 'react';
import { isAddress, type Address } from 'viem';
import { useEnsName } from 'wagmi';
import { sepolia } from 'wagmi/chains';

import { shortenAddress } from '@/lib/utils/address';

interface UseAddressDisplayOptions {
  fallbackEnsName?: string | null;
  shortStart?: number;
  shortEnd?: number;
  disableAgentLookup?: boolean;
}

interface AgentRecord {
  wallet: string;
  ensName: string | null;
}

interface AgentLookupPayload {
  agents?: Array<{
    ensName?: string | null;
  }>;
}

const agentEnsCache = new Map<string, string | null>();
const agentEnsInFlight = new Map<string, Promise<string | null>>();

async function fetchAgentEnsName(walletAddress: string): Promise<string | null> {
  const response = await fetch(`/api/agents?wallet=${encodeURIComponent(walletAddress)}`, {
    cache: 'no-store',
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as AgentLookupPayload;
  const ensName = payload.agents?.[0]?.ensName;
  if (typeof ensName !== 'string') return null;

  const normalized = ensName.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function useAddressDisplay(
  address?: string | null,
  options: UseAddressDisplayOptions = {}
) {
  const normalizedAddress = useMemo(() => {
    if (!address) return null;
    return address.toLowerCase();
  }, [address]);

  const normalizedFallbackEnsName = useMemo(() => {
    if (!options.fallbackEnsName) return null;
    const value = options.fallbackEnsName.trim().toLowerCase();
    return value.length > 0 ? value : null;
  }, [options.fallbackEnsName]);

  const shortAddress = useMemo(
    () => shortenAddress(address, options.shortStart ?? 6, options.shortEnd ?? 4),
    [address, options.shortEnd, options.shortStart]
  );

  const validAddress = useMemo(
    () => Boolean(address && isAddress(address)),
    [address]
  );

  const [agentEnsRecord, setAgentEnsRecord] = useState<AgentRecord | null>(null);

  const cachedAgentEnsName = useMemo(() => {
    if (!normalizedAddress) return null;
    if (agentEnsRecord?.wallet === normalizedAddress) {
      return agentEnsRecord.ensName;
    }
    return agentEnsCache.get(normalizedAddress) ?? null;
  }, [agentEnsRecord, normalizedAddress]);

  const shouldLookupReverseEns =
    Boolean(validAddress) &&
    !normalizedFallbackEnsName &&
    !cachedAgentEnsName;

  const { data: reverseEnsName } = useEnsName({
    address: validAddress ? (address as Address) : undefined,
    chainId: sepolia.id,
    query: {
      enabled: shouldLookupReverseEns,
    },
  });

  const shouldLookupAgent =
    Boolean(validAddress && normalizedAddress) &&
    !options.disableAgentLookup &&
    !normalizedFallbackEnsName;

  useEffect(() => {
    if (!shouldLookupAgent || !normalizedAddress) return;
    if (agentEnsCache.has(normalizedAddress)) return;

    let cancelled = false;

    const inFlight = agentEnsInFlight.get(normalizedAddress);
    const request = inFlight ?? fetchAgentEnsName(normalizedAddress);
    if (!inFlight) {
      agentEnsInFlight.set(normalizedAddress, request);
    }

    request
      .then((ensName) => {
        agentEnsCache.set(normalizedAddress, ensName);
        if (!cancelled) {
          setAgentEnsRecord({ wallet: normalizedAddress, ensName });
        }
      })
      .catch((error) => {
        console.warn('Unable to fetch agent ENS name:', error);
        agentEnsCache.set(normalizedAddress, null);
        if (!cancelled) {
          setAgentEnsRecord({ wallet: normalizedAddress, ensName: null });
        }
      })
      .finally(() => {
        if (agentEnsInFlight.get(normalizedAddress) === request) {
          agentEnsInFlight.delete(normalizedAddress);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [normalizedAddress, shouldLookupAgent]);

  const normalizedReverseEnsName = useMemo(() => {
    if (typeof reverseEnsName !== 'string') return null;
    const value = reverseEnsName.trim().toLowerCase();
    return value.length > 0 ? value : null;
  }, [reverseEnsName]);

  const ensName =
    normalizedFallbackEnsName ??
    cachedAgentEnsName ??
    normalizedReverseEnsName ??
    null;

  const displayName = ensName || shortAddress || address || '';

  return {
    displayName,
    ensName,
    shortAddress,
  };
}
