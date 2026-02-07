# PLAN: Next.js Landing Page with Email Waitlist

**Branch:** main
**Date:** 2026-02-02
**Feature:** Next.js landing page implementation with email waitlist signup
**Status:** DRAFT - Awaiting Approval

---

## 1. Overview

Convert the existing static HTML landing page (`design/landing-page/code.html`) into a Next.js application with a functional email waitlist signup form.

### Source Design Analysis

The existing design (`code.html` + `screen.png`) includes:
- **Navigation:** Sticky header with logo, Docs link, Twitter link, Launch App button
- **Hero Section:** Large headline "Where AI Agents Get Paid", tagline, two CTA buttons
- **Trust Badge Ribbon:** Yellow Network, ERC-8004, ERC-7824, Base, IPFS logos
- **Features Section:** 4 feature cards (Zero Gas, SKILL.md, Portable Reputation, Auto-Protected)
- **How It Works:** 3-step process with connectors
- **Comparison Section:** "For AI Agents" vs "For Bounty Posters" cards
- **Waitlist CTA Section:** Email input + "Join Waitlist" button (ENHANCE THIS)
- **Footer:** Logo, links, copyright

### Design Tokens (from Tailwind config)
```
Primary:          #ecc813 (gold/yellow)
Secondary:        #3b82f6 (blue)
Background Light: #f8f8f6
Background Dark:  #0a0f1a
Card Dark:        #161b22
Font Family:      Space Grotesk
```

---

## 2. Technical Specifications

### 2.1 Project Structure
```
frontend/
├── app/
│   ├── layout.tsx         # Root layout with metadata, fonts
│   ├── page.tsx           # Landing page (server component)
│   ├── globals.css        # Global styles + Tailwind
│   └── api/
│       └── waitlist/
│           └── route.ts   # API route for email collection
├── components/
│   ├── Navbar.tsx
│   ├── Hero.tsx
│   ├── TrustBadges.tsx
│   ├── Features.tsx
│   ├── HowItWorks.tsx
│   ├── Comparison.tsx
│   ├── WaitlistCTA.tsx    # Email form component
│   ├── Footer.tsx
│   └── icons/
│       └── ClaworkLogo.tsx
├── lib/
│   └── waitlist.ts        # Waitlist storage logic
├── tailwind.config.ts
├── next.config.js
├── package.json
└── tsconfig.json
```

### 2.2 Technology Stack
- **Framework:** Next.js 14+ (App Router)
- **Styling:** Tailwind CSS v3
- **Font:** Space Grotesk (Google Fonts via next/font)
- **Icons:** Material Symbols (inline SVG or icon library)
- **Form Handling:** React useState + Server Action or API Route
- **Email Storage:** JSON file initially (can upgrade to database later)

### 2.3 Waitlist Email Form Enhancement

**Current design has:**
- Simple input + button in a styled container

**Enhanced implementation will add:**
- Client-side email validation
- Loading state during submission
- Success message after submission
- Error handling for duplicate emails
- Accessible form markup (labels, ARIA)
- Responsive design (already in original)

---

## 3. Implementation Steps

### Phase 1: Project Setup (Steps 1-4)

#### Step 1: Initialize Next.js Project
```bash
cd /Users/konradgnat/dev/hackathons/hackmoney2026/ETHGlobal_Hackmoney_2026
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"
```

#### Step 2: Configure Tailwind with Design Tokens
Update `tailwind.config.ts`:
```typescript
const config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#ecc813",
        secondary: "#3b82f6",
        "background-light": "#f8f8f6",
        "background-dark": "#0a0f1a",
        "card-dark": "#161b22",
      },
      fontFamily: {
        display: ["var(--font-space-grotesk)", "sans-serif"],
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
```

#### Step 3: Configure Google Font
In `app/layout.tsx`, import Space Grotesk via `next/font/google`.

#### Step 4: Add Global Styles
Update `app/globals.css` with:
- Base Tailwind directives
- Glass nav effect CSS
- Material Symbols font import

---

### Phase 2: Component Development (Steps 5-12)

#### Step 5: Create ClaworkLogo Component
File: `components/icons/ClaworkLogo.tsx`
- SVG component from original design
- Accept size and color props

#### Step 6: Create Navbar Component
File: `components/Navbar.tsx`
- Sticky navigation with glass effect
- Logo + brand name
- Links: Docs, Twitter
- CTA button: "Launch App"
- Mobile-responsive

#### Step 7: Create Hero Component
File: `components/Hero.tsx`
- Radial gradient background
- H1: "Where AI Agents Get Paid"
- Tagline paragraph
- Two CTA buttons: "Start Earning", "Post a Bounty"

#### Step 8: Create TrustBadges Component
File: `components/TrustBadges.tsx`
- Horizontal ribbon with partner names
- Grayscale to color hover effect
- Responsive wrapping

#### Step 9: Create Features Component
File: `components/Features.tsx`
- Section heading
- 2x2 grid of feature cards
- Each card: icon, title, description
- Hover border effect

#### Step 10: Create HowItWorks Component
File: `components/HowItWorks.tsx`
- 3-step horizontal flow
- Connecting lines between steps
- Icons in colored circles
- Responsive (vertical on mobile)

#### Step 11: Create Comparison Component
File: `components/Comparison.tsx`
- Two side-by-side cards
- "For AI Agents" (primary color theme)
- "For Bounty Posters" (secondary color theme)
- Bulleted benefit lists

#### Step 12: Create Footer Component
File: `components/Footer.tsx`
- Logo and tagline
- Navigation links
- Copyright and HackMoney attribution

---

### Phase 3: Waitlist Email Feature (Steps 13-17)

#### Step 13: Create WaitlistCTA Component
File: `components/WaitlistCTA.tsx`
```typescript
"use client";

import { useState } from "react";

export function WaitlistCTA() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validation and submission logic
  };

  return (
    <section className="py-24 bg-slate-900 border-t border-slate-800">
      {/* Form UI with states */}
    </section>
  );
}
```

Features:
- Email input with validation (regex for basic format)
- Submit button with loading spinner
- Success state: "You're on the list! We'll be in touch."
- Error state: "This email is already registered" or "Something went wrong"
- Accessible: proper labels, error announcements

#### Step 14: Create API Route for Waitlist
File: `app/api/waitlist/route.ts`
```typescript
import { NextRequest, NextResponse } from "next/server";
import { addToWaitlist, isEmailRegistered } from "@/lib/waitlist";

export async function POST(request: NextRequest) {
  const { email } = await request.json();

  // Validate email format
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  // Check for duplicates
  if (await isEmailRegistered(email)) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  // Save email
  await addToWaitlist(email);

  return NextResponse.json({ success: true });
}
```

#### Step 15: Create Waitlist Storage Module
File: `lib/waitlist.ts`
```typescript
import fs from "fs/promises";
import path from "path";

const WAITLIST_FILE = path.join(process.cwd(), "data", "waitlist.json");

interface WaitlistEntry {
  email: string;
  timestamp: string;
}

export async function getWaitlist(): Promise<WaitlistEntry[]> {
  // Read from JSON file, create if doesn't exist
}

export async function addToWaitlist(email: string): Promise<void> {
  // Append to JSON file
}

export async function isEmailRegistered(email: string): Promise<boolean> {
  // Check if email exists
}
```

#### Step 16: Create Data Directory
```bash
mkdir -p frontend/data
echo "[]" > frontend/data/waitlist.json
```

Add to `.gitignore`:
```
data/waitlist.json
```

#### Step 17: Add Form Validation Utilities
File: `lib/validation.ts`
```typescript
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
```

---

### Phase 4: Assembly and Polish (Steps 18-21)

#### Step 18: Assemble Landing Page
File: `app/page.tsx`
```typescript
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
    <main className="dark">
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
```

#### Step 19: Configure Page Metadata
File: `app/layout.tsx`
```typescript
export const metadata = {
  title: "Clawork | The Agent Economy Infrastructure",
  description: "Zero-gas bounties. Portable reputation. Instant settlement. Where AI Agents Get Paid.",
  openGraph: {
    title: "Clawork | Where AI Agents Get Paid",
    description: "Decentralized bounty marketplace for AI agents",
  },
};
```

#### Step 20: Test Responsive Design
- Verify mobile layout (stacked navigation, vertical steps)
- Test tablet breakpoints
- Ensure touch targets are adequate

#### Step 21: Verify Dark Mode
- Ensure `dark` class is applied to html/body
- Test all components render correctly in dark theme

---

## 4. File Change Summary

| File | Action | Description |
|------|--------|-------------|
| `frontend/` | CREATE | Next.js project directory |
| `frontend/app/layout.tsx` | CREATE | Root layout with fonts and metadata |
| `frontend/app/page.tsx` | CREATE | Landing page assembly |
| `frontend/app/globals.css` | CREATE | Tailwind + custom styles |
| `frontend/app/api/waitlist/route.ts` | CREATE | Email submission API |
| `frontend/components/Navbar.tsx` | CREATE | Navigation component |
| `frontend/components/Hero.tsx` | CREATE | Hero section |
| `frontend/components/TrustBadges.tsx` | CREATE | Partner logos ribbon |
| `frontend/components/Features.tsx` | CREATE | 4-card features grid |
| `frontend/components/HowItWorks.tsx` | CREATE | 3-step process |
| `frontend/components/Comparison.tsx` | CREATE | Agents vs Posters cards |
| `frontend/components/WaitlistCTA.tsx` | CREATE | Email form with states |
| `frontend/components/Footer.tsx` | CREATE | Footer component |
| `frontend/components/icons/ClaworkLogo.tsx` | CREATE | Logo SVG component |
| `frontend/lib/waitlist.ts` | CREATE | JSON storage for emails |
| `frontend/lib/validation.ts` | CREATE | Email validation utility |
| `frontend/tailwind.config.ts` | MODIFY | Add design tokens |
| `frontend/data/waitlist.json` | CREATE | Email storage file |
| `frontend/.gitignore` | MODIFY | Ignore waitlist data |

---

## 5. Dependencies

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "devDependencies": {
    "@tailwindcss/forms": "^0.5.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "autoprefixer": "^10.0.0",
    "postcss": "^8.0.0",
    "tailwindcss": "^3.0.0",
    "typescript": "^5.0.0"
  }
}
```

---

## 6. Testing Checklist

- [ ] Page loads without errors
- [ ] All sections render correctly
- [ ] Dark mode displays properly
- [ ] Responsive design works on mobile/tablet/desktop
- [ ] Email form validates input
- [ ] Valid email submission succeeds
- [ ] Duplicate email shows error message
- [ ] Invalid email shows validation error
- [ ] Loading state appears during submission
- [ ] Success message displays after submission
- [ ] Navigation links are functional
- [ ] Hover effects work on buttons and cards

---

## 7. Future Enhancements (Out of Scope)

- Email verification/confirmation flow
- Database storage (PostgreSQL/MongoDB)
- Analytics integration
- A/B testing for CTA copy
- Animated transitions between form states
- Social sharing meta tags
- PWA manifest

---

## 8. Commands Reference

```bash
# Development
cd frontend && npm run dev

# Build
cd frontend && npm run build

# Start production
cd frontend && npm start

# Lint
cd frontend && npm run lint
```

---

**END OF PLAN**

Awaiting approval to proceed to EXECUTE mode.
