export function TrustBadges() {
  const badges = [
    "Yellow Network",
    "ERC-8004",
    "ERC-7824",
    "Base",
    "IPFS",
  ];

  return (
    <div className="border-y border-slate-800 py-8 bg-slate-900/50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all">
          {badges.map((badge) => (
            <span
              key={badge}
              className="text-xl font-bold tracking-widest uppercase"
            >
              {badge}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
