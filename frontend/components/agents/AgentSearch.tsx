'use client';

import { useEffect, useMemo, useState } from 'react';

const COMMON_SKILLS = [
  'solidity',
  'typescript',
  'python',
  'rust',
  'security-audit',
  'code-review',
  'defi',
  'nft',
  'frontend',
  'backend',
  'smart-contracts',
  'testing',
];

export interface AgentFilters {
  search: string;
  skills: string[];
  minReputation: number;
  verified: boolean;
  sortBy: 'reputation' | 'createdAt' | 'name';
  order: 'asc' | 'desc';
}

interface AgentSearchProps {
  onSearchChange: (filters: AgentFilters) => void;
  initialFilters?: Partial<AgentFilters>;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

export default function AgentSearch({ onSearchChange, initialFilters = {} }: AgentSearchProps) {
  const [filters, setFilters] = useState<Omit<AgentFilters, 'search'>>({
    skills: initialFilters.skills || [],
    minReputation: initialFilters.minReputation || 0,
    verified: initialFilters.verified || false,
    sortBy: initialFilters.sortBy || 'createdAt',
    order: initialFilters.order || 'desc',
  });

  const [searchInput, setSearchInput] = useState(initialFilters.search || '');
  const debouncedSearch = useDebounce(searchInput, 300);
  const effectiveFilters = useMemo<AgentFilters>(
    () => ({
      ...filters,
      search: debouncedSearch,
    }),
    [filters, debouncedSearch]
  );

  // Notify parent when effective filters change
  useEffect(() => {
    onSearchChange(effectiveFilters);
  }, [effectiveFilters, onSearchChange]);

  const toggleSkill = (skill: string) => {
    setFilters(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill],
    }));
  };

  const clearFilters = () => {
    setSearchInput('');
    setFilters({
      skills: [],
      minReputation: 0,
      verified: false,
      sortBy: 'createdAt',
      order: 'desc',
    });
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
      {/* Search Input */}
      <div>
        <label htmlFor="search" className="block text-sm font-medium text-slate-300 mb-2">
          Search Agents
        </label>
        <input
          id="search"
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by agent name..."
          className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:ring-2 focus:ring-primary/50 focus:border-primary focus:outline-none"
        />
      </div>

      {/* Skills Filter */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Skills
        </label>
        <div className="flex flex-wrap gap-2">
          {COMMON_SKILLS.map(skill => (
            <button
              key={skill}
              onClick={() => toggleSkill(skill)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filters.skills.includes(skill)
                  ? 'bg-primary text-background-dark'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {skill}
            </button>
          ))}
        </div>
      </div>

      {/* Filters Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Minimum Reputation */}
        <div>
          <label htmlFor="minReputation" className="block text-sm font-medium text-slate-300 mb-2">
            Min Reputation: {filters.minReputation.toFixed(1)}
          </label>
          <input
            id="minReputation"
            type="range"
            min="0"
            max="5"
            step="0.5"
            value={filters.minReputation}
            onChange={(e) => setFilters(prev => ({ ...prev, minReputation: parseFloat(e.target.value) }))}
            className="w-full accent-primary"
          />
        </div>

        {/* Verified Only */}
        <div className="flex items-end">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.verified}
              onChange={(e) => setFilters(prev => ({ ...prev, verified: e.target.checked }))}
              className="w-4 h-4 text-primary border-slate-600 rounded focus:ring-primary/40 bg-slate-900"
            />
            <span className="text-sm font-medium text-slate-300">
              Verified Only (ERC-8004)
            </span>
          </label>
        </div>

        {/* Sort By */}
        <div>
          <label htmlFor="sortBy" className="block text-sm font-medium text-slate-300 mb-2">
            Sort By
          </label>
          <select
            id="sortBy"
            value={`${filters.sortBy}-${filters.order}`}
            onChange={(e) => {
              const [sortBy, order] = e.target.value.split('-') as [AgentFilters['sortBy'], AgentFilters['order']];
              setFilters(prev => ({ ...prev, sortBy, order }));
            }}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-slate-200 focus:ring-2 focus:ring-primary/50 focus:border-primary focus:outline-none"
          >
            <option value="reputation-desc">Highest Reputation</option>
            <option value="reputation-asc">Lowest Reputation</option>
            <option value="createdAt-desc">Newest First</option>
            <option value="createdAt-asc">Oldest First</option>
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
          </select>
        </div>
      </div>

      {/* Clear Filters */}
      <div className="flex justify-end">
        <button
          onClick={clearFilters}
          className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 border border-slate-700 rounded-md hover:bg-slate-700 transition-colors"
        >
          Clear All Filters
        </button>
      </div>
    </div>
  );
}
