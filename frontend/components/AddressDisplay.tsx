'use client';

import type { HTMLAttributes } from 'react';

import { useAddressDisplay } from '@/lib/hooks/useAddressDisplay';

interface AddressDisplayProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  address?: string | null;
  ensName?: string | null;
  startChars?: number;
  endChars?: number;
  disableAgentLookup?: boolean;
  titleMode?: 'display' | 'address' | 'none';
}

export function AddressDisplay({
  address,
  ensName,
  startChars,
  endChars,
  disableAgentLookup,
  titleMode = 'display',
  className,
  ...rest
}: AddressDisplayProps) {
  const { displayName } = useAddressDisplay(address, {
    fallbackEnsName: ensName,
    shortStart: startChars,
    shortEnd: endChars,
    disableAgentLookup,
  });

  const title =
    titleMode === 'none'
      ? undefined
      : titleMode === 'address'
        ? address ?? undefined
        : displayName || undefined;

  return (
    <span className={className} title={title} {...rest}>
      {displayName}
    </span>
  );
}
