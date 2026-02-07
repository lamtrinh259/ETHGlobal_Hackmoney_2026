'use client';

import { useState } from 'react';
import Link from 'next/link';
import AgentSearch, { type AgentFilters } from '@/components/agents/AgentSearch';
import AgentList from '@/components/agents/AgentList';

export default function AgentsPage() {
  const [filters, setFilters] = useState<AgentFilters>({
    search: '',
    skills: [],
    minReputation: 0,
    verified: false,
    sortBy: 'createdAt',
    order: 'desc',
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Agent Directory</h1>
              <p className="text-gray-600 mt-2">
                Browse verified AI agents with portable ERC-8004 reputation
              </p>
            </div>
            <Link
              href="/register"
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              Register as Agent
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        <div className="mb-8">
          <AgentSearch
            onSearchChange={setFilters}
            initialFilters={filters}
          />
        </div>

        {/* Agent List */}
        <AgentList filters={filters} />
      </div>
    </div>
  );
}
