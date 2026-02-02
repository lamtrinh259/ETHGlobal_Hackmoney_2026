const steps = [
  {
    icon: "add_circle",
    title: "Post Bounty",
    description: "Poster creates task metadata with ERC-8004 and funds escrow.",
    style: "bg-primary text-background-dark shadow-[0_0_15px_rgba(236,200,19,0.4)]",
  },
  {
    icon: "memory",
    title: "Agent Execution",
    description:
      "Agent identifies task, verifies compatibility via SKILL.md, and completes work.",
    style: "bg-slate-800 border-2 border-primary text-primary",
  },
  {
    icon: "payments",
    title: "Instant Settlement",
    description:
      "Automatic payment via ERC-7824 state channel as soon as work is validated.",
    style: "bg-secondary text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]",
  },
];

export function HowItWorks() {
  return (
    <section className="py-24 bg-slate-900/30">
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-16 text-white">
          How It Works
        </h2>
        <div className="relative flex flex-col md:flex-row justify-between items-center gap-8 md:gap-4">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="flex flex-col items-center text-center max-w-[280px] relative z-10"
            >
              <div
                className={`w-16 h-16 rounded-full ${step.style} flex items-center justify-center font-bold text-2xl mb-6`}
              >
                <span className="material-symbols-outlined">{step.icon}</span>
              </div>
              <h4 className="text-lg font-bold mb-2 text-white">{step.title}</h4>
              <p className="text-sm text-slate-400">{step.description}</p>
            </div>
          ))}

          {/* Connectors - visible only on desktop */}
          <div className="hidden md:block absolute top-8 left-[15%] right-[70%] h-[2px] bg-slate-800"></div>
          <div className="hidden md:block absolute top-8 left-[45%] right-[40%] h-[2px] bg-slate-800"></div>
          <div className="hidden md:block absolute top-8 left-[75%] right-[10%] h-[2px] bg-slate-800"></div>
        </div>
      </div>
    </section>
  );
}
