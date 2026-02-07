'use client';

import { useState, useEffect } from 'react';
import AgentCard from './AgentCard';
import type { AgentFilters } from './AgentSearch';

interface Agent {
  id: string;
  walletAddress: string;
  name: string;
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

interface AgentListProps {
  filters: AgentFilters;
}

export default function AgentList({ filters }: AgentListProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Fetch agents based on filters
  const fetchAgents = async (cursor?: string | null) => {
    try {
      const isLoadMore = !!cursor;
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setAgents([]); // Clear existing agents on new search
      }

      // Build query params
      const params = new URLSearchParams({
        limit: '20',
        sortBy: filters.sortBy,
        order: filters.order,
      });

      if (filters.search) params.append('search', filters.search);
      if (filters.skills.length > 0) params.append('skill', filters.skills.join(','));
      if (filters.minReputation > 0) params.append('minReputation', filters.minReputation.toString());
      if (filters.verified) params.append('verified', 'true');
      if (cursor) params.append('cursor', cursor);

      const response = await fetch(`/api/agents?${params.toString()}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to fetch agents');
      }

      if (isLoadMore) {
        setAgents(prev => [...prev, ...data.agents]);
      } else {
        setAgents(data.agents);
      }

      setHasMore(data.pagination.hasMore);
      setNextCursor(data.pagination.nextCursor);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Refetch when filters change
  useEffect(() => {
    fetchAgents();
  }, [filters]);

  const handleLoadMore = () => {
    if (nextCursor && !loadingMore) {
      fetchAgents(nextCursor);
    }
  };

  const handleRetry = () => {
    setError(null);
    fetchAgents();
  };

  // Loading State
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
            <div className="h-6 bg-gray-200 rounded mb-4"></div>
            <div className="h-4 bg-gray-200 rounded mb-2 w-2/3"></div>
            <div className="h-4 bg-gray-200 rounded mb-4 w-1/2"></div>
            <div className="flex gap-2 mb-4">
              <div className="h-6 bg-gray-200 rounded w-16"></div>
              <div className="h-6 bg-gray-200 rounded w-20"></div>
            </div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Agents</h3>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={handleRetry}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Empty State
  if (agents.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Agents Found</h3>
        <p className="text-gray-600 mb-4">
          Try adjusting your filters or search query to find more agents.
        </p>
      </div>
    );
  }

  // Success State
  return (
    <div className="space-y-6">
      {/* Agent Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map(agent => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>

      {/* Load More Button */}
      {hasMore && (
        <div className="flex justify-center">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingMore ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Loading...
              </span>
            ) : (
              'Load More Agents'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
