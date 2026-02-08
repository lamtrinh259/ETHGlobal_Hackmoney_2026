'use client';

import { useState, useEffect, useCallback } from 'react';
import { Navbar } from '@/components/Navbar';
import { BountyStatusBadge } from '@/components/bounties/BountyStatusBadge';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import type { Bounty } from '@/lib/types/bounty';

type Tab = 'disputes' | 'auto-release' | 'all';

const ADMIN_WALLET = process.env.NEXT_PUBLIC_ADMIN_WALLET?.toLowerCase();

interface AutoReleaseResult {
  bountyId: string;
  status: 'released' | 'failed';
  settlementTxHash?: string;
  error?: string;
}

interface AutoReleaseSummary {
  success: boolean;
  processed: number;
  released: number;
  failed: number;
  yellowMode: string;
  results: AutoReleaseResult[];
}

export default function AdminPage() {
  const { address, isConnected } = useAccount();

  const [activeTab, setActiveTab] = useState<Tab>('disputes');
  const [allBounties, setAllBounties] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState(true);

  // Dispute resolution state
  const [resolveNotes, setResolveNotes] = useState<Record<string, string>>({});
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveResults, setResolveResults] = useState<Record<string, { success: boolean; message: string }>>({});

  // Auto-release state
  const [autoReleaseRunning, setAutoReleaseRunning] = useState(false);
  const [autoReleaseSummary, setAutoReleaseSummary] = useState<AutoReleaseSummary | null>(null);

  const isAdmin = address && ADMIN_WALLET && address.toLowerCase() === ADMIN_WALLET;

  const fetchBounties = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bounties?limit=100');
      const data = await res.json();
      if (data.success) {
        setAllBounties(data.bounties || []);
      }
    } catch (error) {
      console.error('Failed to fetch bounties:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchBounties();
    } else {
      setLoading(false);
    }
  }, [isAdmin, fetchBounties]);

  // Derived data
  const disputedBounties = allBounties.filter(b => b.disputeStatus === 'PENDING');
  const submittedBounties = allBounties.filter(b => b.status === 'SUBMITTED');
  const pastDeadline = submittedBounties.filter(
    b => b.reviewDeadline && b.reviewDeadline < Date.now() && b.disputeStatus !== 'PENDING'
  );

  async function handleResolve(bountyId: string, decision: 'agent' | 'poster') {
    setResolvingId(bountyId);
    try {
      const res = await fetch(`/api/bounties/${bountyId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          reviewNotes: resolveNotes[bountyId] || '',
        }),
      });
      const data = await res.json();
      setResolveResults(prev => ({
        ...prev,
        [bountyId]: { success: data.success, message: data.message || data.error?.message || 'Done' },
      }));
      if (data.success) {
        // Refresh bounties list
        await fetchBounties();
      }
    } catch (error) {
      setResolveResults(prev => ({
        ...prev,
        [bountyId]: { success: false, message: `Error: ${error}` },
      }));
    } finally {
      setResolvingId(null);
    }
  }

  async function handleAutoRelease() {
    setAutoReleaseRunning(true);
    setAutoReleaseSummary(null);
    try {
      const res = await fetch('/api/cron/auto-release', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || ''}`,
        },
      });
      const data = await res.json();
      setAutoReleaseSummary(data);
      if (data.success) {
        await fetchBounties();
      }
    } catch (error) {
      setAutoReleaseSummary({
        success: false,
        processed: 0,
        released: 0,
        failed: 0,
        yellowMode: 'unknown',
        results: [],
      });
    } finally {
      setAutoReleaseRunning(false);
    }
  }

  // Not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background-dark">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="text-3xl font-bold text-white mb-4">Admin Dashboard</h1>
          <p className="text-slate-400 mb-8">Connect your admin wallet to continue</p>
          <ConnectButton />
        </div>
      </div>
    );
  }

  // Not admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background-dark">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="text-3xl font-bold text-white mb-4">Unauthorized</h1>
          <p className="text-slate-400 mb-2">This page is restricted to the Clawork admin.</p>
          <p className="text-slate-500 text-sm font-mono">
            Connected: {address?.slice(0, 8)}...{address?.slice(-6)}
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background-dark">
        <Navbar />
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="text-slate-400">Loading admin dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-dark">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
          <button
            onClick={fetchBounties}
            className="text-slate-400 hover:text-white transition-colors text-sm flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            Refresh
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="text-slate-400 text-sm mb-1">Total Bounties</div>
            <div className="text-2xl font-bold text-white">{allBounties.length}</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="text-slate-400 text-sm mb-1">Pending Disputes</div>
            <div className="text-2xl font-bold text-red-400">{disputedBounties.length}</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="text-slate-400 text-sm mb-1">Awaiting Review</div>
            <div className="text-2xl font-bold text-blue-400">{submittedBounties.length}</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="text-slate-400 text-sm mb-1">Past Deadline</div>
            <div className="text-2xl font-bold text-yellow-400">{pastDeadline.length}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-700">
          {[
            { key: 'disputes' as Tab, label: 'Disputes', count: disputedBounties.length },
            { key: 'auto-release' as Tab, label: 'Auto-Release', count: pastDeadline.length },
            { key: 'all' as Tab, label: 'All Bounties', count: allBounties.length },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 font-medium transition-colors ${
                activeTab === tab.key
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Disputes Tab */}
        {activeTab === 'disputes' && (
          <div>
            {disputedBounties.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                No pending disputes
              </div>
            ) : (
              <div className="space-y-4">
                {disputedBounties.map(bounty => (
                  <div key={bounty.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-white">{bounty.title}</h3>
                          <BountyStatusBadge status={bounty.status} size="sm" />
                        </div>
                        <div className="text-sm text-slate-400 space-y-1">
                          <p>
                            <span className="text-slate-500">Bounty ID:</span>{' '}
                            <span className="font-mono">{bounty.id}</span>
                          </p>
                          <p>
                            <span className="text-slate-500">Reward:</span>{' '}
                            <span className="text-primary font-bold">${bounty.reward} {bounty.rewardToken}</span>
                          </p>
                          <p>
                            <span className="text-slate-500">Poster:</span>{' '}
                            <span className="font-mono">{bounty.posterAddress.slice(0, 10)}...{bounty.posterAddress.slice(-6)}</span>
                          </p>
                          {bounty.assignedAgentAddress && (
                            <p>
                              <span className="text-slate-500">Agent:</span>{' '}
                              <span className="font-mono">{bounty.assignedAgentAddress.slice(0, 10)}...{bounty.assignedAgentAddress.slice(-6)}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Dispute Info */}
                    {bounty.disputeReason && (
                      <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-4 mb-4">
                        <div className="text-red-400 text-sm font-medium mb-1">Dispute Reason</div>
                        <p className="text-slate-300 text-sm">{bounty.disputeReason}</p>
                      </div>
                    )}

                    {/* Resolution Form */}
                    <div className="border-t border-slate-700 pt-4">
                      <textarea
                        placeholder="Review notes (optional)..."
                        value={resolveNotes[bounty.id] || ''}
                        onChange={e => setResolveNotes(prev => ({ ...prev, [bounty.id]: e.target.value }))}
                        className="w-full bg-slate-900/50 border border-slate-600 rounded-lg p-3 text-white text-sm mb-3 placeholder:text-slate-500 focus:outline-none focus:border-primary"
                        rows={2}
                      />
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleResolve(bounty.id, 'agent')}
                          disabled={resolvingId === bounty.id}
                          className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                          {resolvingId === bounty.id ? 'Resolving...' : 'Favor Agent'}
                        </button>
                        <button
                          onClick={() => handleResolve(bounty.id, 'poster')}
                          disabled={resolvingId === bounty.id}
                          className="bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                          {resolvingId === bounty.id ? 'Resolving...' : 'Favor Poster'}
                        </button>
                      </div>
                      {resolveResults[bounty.id] && (
                        <div className={`mt-3 text-sm ${resolveResults[bounty.id].success ? 'text-green-400' : 'text-red-400'}`}>
                          {resolveResults[bounty.id].message}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Auto-Release Tab */}
        {activeTab === 'auto-release' && (
          <div>
            {/* Trigger Button */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">Manual Auto-Release Trigger</h3>
                  <p className="text-slate-400 text-sm">
                    Release payments for submitted bounties past their review deadline.
                    The cron job also runs daily at midnight UTC.
                  </p>
                </div>
                <button
                  onClick={handleAutoRelease}
                  disabled={autoReleaseRunning}
                  className="bg-primary text-background-dark px-6 py-3 rounded-lg font-bold hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
                >
                  {autoReleaseRunning ? 'Running...' : 'Run Auto-Release'}
                </button>
              </div>

              {/* Results */}
              {autoReleaseSummary && (
                <div className={`mt-4 border-t border-slate-700 pt-4 ${autoReleaseSummary.success ? '' : 'text-red-400'}`}>
                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div>
                      <div className="text-slate-500 text-xs">Processed</div>
                      <div className="text-white font-bold">{autoReleaseSummary.processed}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-xs">Released</div>
                      <div className="text-green-400 font-bold">{autoReleaseSummary.released}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-xs">Failed</div>
                      <div className="text-red-400 font-bold">{autoReleaseSummary.failed}</div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">
                    Mode: {autoReleaseSummary.yellowMode}
                  </div>
                  {autoReleaseSummary.results.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {autoReleaseSummary.results.map((r, i) => (
                        <div key={i} className={`text-xs font-mono ${r.status === 'released' ? 'text-green-400' : 'text-red-400'}`}>
                          {r.bountyId}: {r.status}
                          {r.settlementTxHash && ` (tx: ${r.settlementTxHash.slice(0, 14)}...)`}
                          {r.error && ` — ${r.error}`}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bounties Past Deadline */}
            <h3 className="text-lg font-semibold text-white mb-4">
              Submitted Bounties Past Review Deadline ({pastDeadline.length})
            </h3>
            {pastDeadline.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                No bounties past review deadline
              </div>
            ) : (
              <div className="space-y-3">
                {pastDeadline.map(bounty => (
                  <div key={bounty.id} className="bg-slate-800/50 border border-yellow-800/30 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium">{bounty.title}</div>
                      <div className="text-slate-400 text-sm">
                        ${bounty.reward} {bounty.rewardToken} · Deadline:{' '}
                        <span className="text-yellow-400">
                          {bounty.reviewDeadline ? new Date(bounty.reviewDeadline).toLocaleString() : 'N/A'}
                        </span>
                      </div>
                    </div>
                    <BountyStatusBadge status={bounty.status} size="sm" />
                  </div>
                ))}
              </div>
            )}

            {/* All Submitted */}
            <h3 className="text-lg font-semibold text-white mt-8 mb-4">
              All Submitted Bounties ({submittedBounties.length})
            </h3>
            {submittedBounties.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                No submitted bounties awaiting review
              </div>
            ) : (
              <div className="space-y-3">
                {submittedBounties.map(bounty => {
                  const isPast = bounty.reviewDeadline && bounty.reviewDeadline < Date.now();
                  return (
                    <div key={bounty.id} className={`bg-slate-800/50 border ${isPast ? 'border-yellow-800/30' : 'border-slate-700'} rounded-xl p-4 flex items-center justify-between`}>
                      <div>
                        <div className="text-white font-medium">{bounty.title}</div>
                        <div className="text-slate-400 text-sm">
                          ${bounty.reward} {bounty.rewardToken}
                          {bounty.reviewDeadline && (
                            <> · Deadline: <span className={isPast ? 'text-yellow-400' : 'text-slate-300'}>
                              {new Date(bounty.reviewDeadline).toLocaleString()}
                            </span></>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isPast && <span className="text-yellow-400 text-xs">OVERDUE</span>}
                        <BountyStatusBadge status={bounty.status} size="sm" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* All Bounties Tab */}
        {activeTab === 'all' && (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="pb-3 text-slate-400 text-sm font-medium">Title</th>
                    <th className="pb-3 text-slate-400 text-sm font-medium">Status</th>
                    <th className="pb-3 text-slate-400 text-sm font-medium">Reward</th>
                    <th className="pb-3 text-slate-400 text-sm font-medium">Dispute</th>
                    <th className="pb-3 text-slate-400 text-sm font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {allBounties.map(bounty => (
                    <tr key={bounty.id} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 pr-4">
                        <a
                          href={`/bounties/${bounty.id}`}
                          className="text-white hover:text-primary transition-colors font-medium"
                        >
                          {bounty.title}
                        </a>
                        <div className="text-slate-500 text-xs font-mono mt-0.5">{bounty.id}</div>
                      </td>
                      <td className="py-3 pr-4">
                        <BountyStatusBadge status={bounty.status} size="sm" />
                      </td>
                      <td className="py-3 pr-4 text-primary font-medium text-sm">
                        ${bounty.reward}
                      </td>
                      <td className="py-3 pr-4">
                        {bounty.disputeStatus === 'PENDING' && (
                          <span className="bg-red-900/50 text-red-400 px-2 py-0.5 rounded-full text-xs font-medium">
                            Pending
                          </span>
                        )}
                        {bounty.disputeStatus === 'RESOLVED' && (
                          <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full text-xs font-medium">
                            Resolved
                          </span>
                        )}
                        {(!bounty.disputeStatus || bounty.disputeStatus === 'NONE') && (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 text-slate-400 text-sm">
                        {new Date(bounty.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
