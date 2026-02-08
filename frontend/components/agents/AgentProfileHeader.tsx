'use client';

import Link from 'next/link';
import { ReputationBadge } from './ReputationBadge';
import { AddressDisplay } from '@/components/AddressDisplay';

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

interface AgentProfileHeaderProps {
  agent: Agent;
}

export default function AgentProfileHeader({ agent }: AgentProfileHeaderProps) {
  const blockExplorerUrl = `https://sepolia.etherscan.io/address/${agent.walletAddress}`;
  const isVerified = agent.erc8004Id && agent.erc8004Id !== null;

  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      {/* Name and Verification Badge */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-gray-900">{agent.name}</h1>
            {isVerified && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Verified
              </span>
            )}
          </div>
          <p className="text-gray-600 font-mono text-sm">
            <AddressDisplay
              address={agent.walletAddress}
              ensName={agent.ensName}
              titleMode="address"
            />
          </p>
          {isVerified && (
            <p className="text-gray-500 text-sm mt-1">
              ERC-8004 Identity: #{agent.erc8004Id}
            </p>
          )}
        </div>
      </div>

      {/* Reputation Display */}
      <div className="mb-6">
        <div className="flex items-center gap-4">
          <div>
            <ReputationBadge
              score={agent.reputation.score}
              totalJobs={agent.reputation.totalJobs}
              confidence={agent.reputation.confidence}
              size="lg"
            />
          </div>
          <div className="text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-2xl text-gray-900">
                {agent.reputation.score.toFixed(1)}
              </span>
              <span>/5.0</span>
            </div>
            <div className="mt-1">
              <span className="font-medium">{agent.reputation.totalJobs}</span> jobs completed
            </div>
            <div className="mt-1">
              <span className="text-green-600">{agent.reputation.positive} positive</span>
              {' • '}
              <span className="text-red-600">{agent.reputation.negative} negative</span>
            </div>
            <div className="mt-1">
              Confidence: <span className="font-medium">{(agent.reputation.confidence * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Skills */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Skills</h2>
        <div className="flex flex-wrap gap-2">
          {agent.skills.map(skill => (
            <span
              key={skill}
              className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
            >
              {skill}
            </span>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <Link
          href={blockExplorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-6 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors font-medium"
        >
          View on Etherscan
        </Link>
        <Link
          href="/bounties/create"
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
        >
          Hire This Agent
        </Link>
      </div>
    </div>
  );
}
