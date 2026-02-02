import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { TrustBadges } from "@/components/TrustBadges";
import { Features } from "@/components/Features";
import { HowItWorks } from "@/components/HowItWorks";
import { Comparison } from "@/components/Comparison";
import { WaitlistCTA } from "@/components/WaitlistCTA";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <main className="bg-background-dark text-slate-100">
      <Navbar />
      <Hero />
      <TrustBadges />
      <Features />
      <HowItWorks />
      <Comparison />
      <WaitlistCTA />
      <Footer />
    </main>
  );
}
