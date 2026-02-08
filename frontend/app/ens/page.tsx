"use client";

import { useMemo, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId, usePublicClient, useWalletClient } from "wagmi";

import { Navbar } from "@/components/Navbar";
import { readEnsTextRecord, writeEnsTextRecord } from "@/lib/services/ens";

const TEXT_RECORD_KEYS = [
  "clawork.skills",
  "clawork.status",
  "clawork.hourlyRate",
  "clawork.minBounty",
  "clawork.erc8004Id",
  "clawork.preferredChain",
] as const;

type RecordState = Record<(typeof TEXT_RECORD_KEYS)[number], string>;

function createDefaultState(): RecordState {
  return {
    "clawork.skills": "",
    "clawork.status": "available",
    "clawork.hourlyRate": "",
    "clawork.minBounty": "",
    "clawork.erc8004Id": "",
    "clawork.preferredChain": "11155111",
  };
}

export default function EnsManagerPage() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [ensName, setEnsName] = useState("");
  const [records, setRecords] = useState<RecordState>(createDefaultState);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nonEmptyRecords = useMemo(
    () =>
      Object.entries(records).filter(([, value]) => value.trim().length > 0) as Array<
        [keyof RecordState, string]
      >,
    [records]
  );
  const normalizedEnsName = ensName.trim().toLowerCase();
  const isSepolia = chainId === 11155111;

  async function handleLoadRecords() {
    if (!publicClient) {
      setError("Public client unavailable. Reconnect wallet and try again.");
      return;
    }
    if (!normalizedEnsName) {
      setError("Enter an ENS name first.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const nextState = createDefaultState();

      await Promise.all(
        TEXT_RECORD_KEYS.map(async (key) => {
          const value = await readEnsTextRecord(publicClient, normalizedEnsName, key);
          if (value) {
            nextState[key] = value;
          }
        })
      );

      setRecords(nextState);
      setMessage("Loaded current ENS text records.");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to read ENS records.");
    } finally {
      setLoading(false);
    }
  }

  async function handleWriteRecords() {
    if (!publicClient || !walletClient) {
      setError("Connect wallet first.");
      return;
    }
    if (!normalizedEnsName) {
      setError("Enter an ENS name first.");
      return;
    }
    if (!isSepolia) {
      setError("Switch wallet to Ethereum Sepolia before writing ENS records.");
      return;
    }
    if (nonEmptyRecords.length === 0) {
      setError("Add at least one non-empty text record value.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      for (const [key, value] of nonEmptyRecords) {
        await writeEnsTextRecord({
          walletClient,
          publicClient,
          ensName: normalizedEnsName,
          key,
          value: value.trim(),
        });
      }

      setMessage(
        `Updated ${nonEmptyRecords.length} ENS text record${
          nonEmptyRecords.length > 1 ? "s" : ""
        } successfully.`
      );
    } catch (writeError) {
      setError(writeError instanceof Error ? writeError.message : "Failed to write ENS records.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background-dark">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">ENS Text Record Manager</h1>
          <p className="text-slate-400">
            Configure `clawork.*` text records on Sepolia for prize demo readiness.
          </p>
        </div>

        {!isConnected ? (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
            <p className="text-slate-400 mb-4">Connect your wallet to manage ENS records.</p>
            <ConnectButton />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                ENS Name
              </label>
              <input
                type="text"
                value={ensName}
                onChange={(event) => setEnsName(event.target.value)}
                placeholder="youragent.eth"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
              />
              <p className="text-slate-500 text-xs mt-2">
                This page writes directly to your ENS resolver via wallet-signed transactions.
              </p>
              {!isSepolia && (
                <p className="text-amber-400 text-xs mt-2">
                  Wallet network is not Sepolia. Switch to Sepolia to write records.
                </p>
              )}
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 space-y-4">
              {TEXT_RECORD_KEYS.map((key) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-slate-300 mb-2">{key}</label>
                  <input
                    type="text"
                    value={records[key]}
                    onChange={(event) =>
                      setRecords((current) => ({ ...current, [key]: event.target.value }))
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                  />
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleLoadRecords}
                disabled={loading}
                className="bg-slate-700 text-slate-100 px-5 py-2.5 rounded-lg font-semibold hover:bg-slate-600 disabled:opacity-50"
              >
                {loading ? "Loading..." : "Load Current Records"}
              </button>
              <button
                onClick={handleWriteRecords}
                disabled={loading || !isSepolia}
                className="bg-primary text-background-dark px-5 py-2.5 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Writing..." : "Write Records"}
              </button>
            </div>

            {message && <p className="text-green-400 text-sm">{message}</p>}
            {error && <p className="text-red-400 text-sm">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
