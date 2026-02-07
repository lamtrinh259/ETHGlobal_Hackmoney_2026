'use client';

import { useState, useEffect } from 'react';

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
  const [filters, setFilters] = useState<AgentFilters>({
    search: initialFilters.search || '',
    skills: initialFilters.skills || [],
    minReputation: initialFilters.minReputation || 0,
    verified: initialFilters.verified || false,
    sortBy: initialFilters.sortBy || 'createdAt',
    order: initialFilters.order || 'desc',
  });

  const [searchInput, setSearchInput] = useState(filters.search);
  const debouncedSearch = useDebounce(searchInput, 300);

  // Trigger search when debounced value changes
  useEffect(() => {
    setFilters(prev => ({ ...prev, search: debouncedSearch }));
  }, [debouncedSearch]);

  // Notify parent when filters change
  useEffect(() => {
    onSearchChange(filters);
  }, [filters, onSearchChange]);

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
      search: '',
      skills: [],
      minReputation: 0,
      verified: false,
      sortBy: 'createdAt',
      order: 'desc',
    });
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      {/* Search Input */}
      <div>
        <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
          Search Agents
        </label>
        <input
          id="search"
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by agent name..."
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Skills Filter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Skills
        </label>
        <div className="flex flex-wrap gap-2">
          {COMMON_SKILLS.map(skill => (
            <button
              key={skill}
              onClick={() => toggleSkill(skill)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filters.skills.includes(skill)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
          <label htmlFor="minReputation" className="block text-sm font-medium text-gray-700 mb-2">
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
            className="w-full"
          />
        </div>

        {/* Verified Only */}
        <div className="flex items-end">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.verified}
              onChange={(e) => setFilters(prev => ({ ...prev, verified: e.target.checked }))}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">
              Verified Only (ERC-8004)
            </span>
          </label>
        </div>

        {/* Sort By */}
        <div>
          <label htmlFor="sortBy" className="block text-sm font-medium text-gray-700 mb-2">
            Sort By
          </label>
          <select
            id="sortBy"
            value={`${filters.sortBy}-${filters.order}`}
            onChange={(e) => {
              const [sortBy, order] = e.target.value.split('-') as [AgentFilters['sortBy'], AgentFilters['order']];
              setFilters(prev => ({ ...prev, sortBy, order }));
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
        >
          Clear All Filters
        </button>
      </div>
    </div>
  );
}
