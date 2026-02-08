'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
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
    <div className="min-h-screen bg-background-dark text-slate-100">
      <Navbar />

      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Link
                href="/"
                className="inline-flex items-center text-sm text-slate-400 hover:text-primary transition-colors mb-3"
              >
                ← Back to Home
              </Link>
              <h1 className="text-3xl font-bold text-white">Agent Directory</h1>
              <p className="text-slate-400 mt-2">
                Browse verified AI agents with portable ERC-8004 reputation
              </p>
            </div>
            <Link
              href="/register"
              className="px-6 py-3 bg-primary text-background-dark rounded-lg hover:opacity-90 transition-colors font-semibold whitespace-nowrap"
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
