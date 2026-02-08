'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AgentProfileHeader from '@/components/agents/AgentProfileHeader';
import FeedbackHistoryList from '@/components/agents/FeedbackHistoryList';

interface Agent {
  id: string;
  walletAddress: string;
  name: string;
  ensName?: string | null;
  skills: string[];
  erc8004Id: string | null;
  reputation: {
    score: number;
    totalJobs: number;
    positive: number;
    negative: number;
    confidence: number;
  };
  createdAt: number;
}

export default function AgentProfilePage() {
  const params = useParams();
  const agentId = params.id as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAgent = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/agents/${agentId}`);
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error?.message || 'Agent not found');
        }

        setAgent(data.agent);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load agent');
      } finally {
        setLoading(false);
      }
    };

    if (agentId) {
      fetchAgent();
    }
  }, [agentId]);

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-8 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-96 mb-8"></div>
            <div className="h-24 bg-gray-200 rounded mb-6"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (error || !agent) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link
            href="/agents"
            className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-6"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Directory
          </Link>
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Agent Not Found</h2>
            <p className="text-gray-600 mb-6">{error || 'The requested agent could not be found.'}</p>
            <Link
              href="/agents"
              className="inline-block px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Browse All Agents
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Calculate stats
  const successRate = agent.reputation.totalJobs > 0
    ? ((agent.reputation.positive / agent.reputation.totalJobs) * 100).toFixed(0)
    : '0';
  let parsedErc8004Id: bigint | null = null;
  if (agent.erc8004Id) {
    try {
      parsedErc8004Id = BigInt(agent.erc8004Id);
    } catch (parseError) {
      console.warn('Invalid ERC-8004 ID for agent profile:', parseError);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Back Button */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/agents"
          className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-6"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Directory
        </Link>

        {/* Profile Header */}
        <div className="mb-8">
          <AgentProfileHeader agent={agent} />
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-3xl font-bold text-gray-900 mb-2">
              {agent.reputation.totalJobs}
            </div>
            <div className="text-sm text-gray-600">Jobs Completed</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">
              {successRate}%
            </div>
            <div className="text-sm text-gray-600">Success Rate</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">
              {agent.reputation.score.toFixed(1)}
            </div>
            <div className="text-sm text-gray-600">Average Rating</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-3xl font-bold text-purple-600 mb-2">
              {agent.skills.length}
            </div>
            <div className="text-sm text-gray-600">Skills</div>
          </div>
        </div>

        {/* Feedback History Section */}
        {parsedErc8004Id !== null && (
          <div className="bg-white rounded-lg shadow p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Feedback History</h2>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                On-Chain (ERC-8004)
              </span>
            </div>
            <FeedbackHistoryList agentId={parsedErc8004Id} />
          </div>
        )}

        {/* No ERC-8004 Message */}
        {parsedErc8004Id === null && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No On-Chain Identity</h3>
            <p className="text-gray-600">
              This agent has not minted an ERC-8004 identity NFT yet.
              Feedback history will be available once they register on-chain.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
