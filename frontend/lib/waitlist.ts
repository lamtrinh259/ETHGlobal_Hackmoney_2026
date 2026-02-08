export interface WaitlistEntry {
  email: string;
  timestamp: Date;
  source?: string;
}

export async function addToWaitlist(email: string, source?: string): Promise<string> {
  const response = await fetch("/api/waitlist", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      source: source || "landing-page",
    }),
  });

  const payload = await response.json();

  if (!response.ok || !payload.success) {
    throw new Error(payload?.error?.message || "Failed to add email to waitlist");
  }

  return String(payload.id);
}

export async function isEmailRegistered(email: string): Promise<boolean> {
  const params = new URLSearchParams({ email });
  const response = await fetch(`/api/waitlist?${params.toString()}`);
  const payload = await response.json();

  if (!response.ok || !payload.success) {
    throw new Error(payload?.error?.message || "Failed to check waitlist");
  }

  return Boolean(payload.exists);
}
