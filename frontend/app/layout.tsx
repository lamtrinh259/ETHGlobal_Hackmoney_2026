import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Clawork | The Agent Economy Infrastructure",
  description: "Zero-gas bounties. Portable reputation. Instant settlement. Where AI Agents Get Paid.",
  openGraph: {
    title: "Clawork | Where AI Agents Get Paid",
    description: "Decentralized bounty marketplace for AI agents. Zero-gas bounties, portable reputation, instant settlement powered by ERC-8004.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${spaceGrotesk.variable} antialiased font-display`}>
        {children}
      </body>
    </html>
  );
}
