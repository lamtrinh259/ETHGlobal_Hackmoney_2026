'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ClaworkLogo } from "./icons/ClaworkLogo";
import Link from 'next/link';
import { useAccount } from 'wagmi';

import { useAddressDisplay } from '@/lib/hooks/useAddressDisplay';
import { shortenAddress } from '@/lib/utils/address';

function WalletControls({ compact = false }: { compact?: boolean }) {
  const { address } = useAccount();
  const { displayName } = useAddressDisplay(address);

  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        mounted,
        authenticationStatus,
        openAccountModal,
        openChainModal,
        openConnectModal,
      }) => {
        const ready = mounted && authenticationStatus !== 'loading';
        const connected =
          ready &&
          !!account &&
          !!chain &&
          (!authenticationStatus || authenticationStatus === 'authenticated');

        if (!ready) {
          return <div aria-hidden style={{ opacity: 0, pointerEvents: 'none', userSelect: 'none' }} />;
        }

        if (!connected) {
          return (
            <button
              type="button"
              onClick={openConnectModal}
              className="rounded-lg border border-primary/70 px-3 py-2 text-sm font-semibold text-primary hover:border-primary hover:bg-primary/10 transition-colors"
            >
              Connect
            </button>
          );
        }

        if (chain.unsupported) {
          return (
            <button
              type="button"
              onClick={openChainModal}
              className="rounded-lg border border-red-500/60 px-3 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/10 transition-colors"
            >
              Wrong network
            </button>
          );
        }

        const accountDisplayName = account.displayName?.startsWith('0x')
          ? shortenAddress(account.address)
          : account.displayName;
        const shownName = displayName || accountDisplayName || shortenAddress(account.address);

        return (
          <div className="flex items-center gap-2">
            {!compact && (
              <button
                type="button"
                onClick={openChainModal}
                className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-2 text-xs font-medium text-slate-200 hover:border-primary/60 transition-colors"
              >
                {chain.hasIcon ? <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
                <span>{chain.name}</span>
              </button>
            )}
            <button
              type="button"
              onClick={openAccountModal}
              className={`rounded-lg border border-primary/70 bg-primary/10 px-3 py-2 text-sm font-semibold text-white hover:border-primary transition-colors ${
                compact ? 'max-w-[140px]' : 'max-w-[220px]'
              }`}
              title={shownName}
            >
              <span className="block truncate">{shownName}</span>
            </button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}

export function Navbar() {
  const { isConnected } = useAccount();

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-800 glass-nav">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              <div className="text-primary">
                <ClaworkLogo size={32} />
              </div>
              <span className="text-xl font-bold tracking-tight text-white">
                Clawork
              </span>
            </Link>
          </div>
          <div className="hidden md:flex items-center space-x-6">
            <Link
              className="text-sm font-medium hover:text-primary transition-colors"
              href="/blog"
            >
              Blog
            </Link>
            <Link
              className="text-sm font-medium hover:text-primary transition-colors"
              href="/bounties"
            >
              Bounties
            </Link>
            <Link
              className="text-sm font-medium hover:text-primary transition-colors"
              href="/agents"
            >
              Agents
            </Link>
            <Link
              className="text-sm font-medium hover:text-primary transition-colors"
              href="/ens"
            >
              ENS
            </Link>
            {isConnected && (
              <>
                <Link
                  className="text-sm font-medium hover:text-primary transition-colors"
                  href="/register"
                >
                  Register Agent
                </Link>
                <Link
                  className="text-sm font-medium hover:text-primary transition-colors"
                  href="/bounties/create"
                >
                  Post Bounty
                </Link>
                <Link
                  className="text-sm font-medium hover:text-primary transition-colors"
                  href="/dashboard"
                >
                  Dashboard
                </Link>
              </>
            )}
            <Link
              className="text-sm font-medium hover:text-primary transition-colors"
              href="/docs/agents"
            >
              Docs
            </Link>
            <a
              className="text-sm font-medium hover:text-primary transition-colors"
              href="https://twitter.com/clawork"
              target="_blank"
              rel="noopener noreferrer"
            >
              Twitter
            </a>
            <WalletControls />
          </div>
          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-3">
            <Link
              className="text-sm font-medium hover:text-primary transition-colors"
              href="/bounties"
            >
              Bounties
            </Link>
            <WalletControls compact />
          </div>
        </div>
      </div>
    </nav>
  );
}
