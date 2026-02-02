import fs from "fs/promises";
import path from "path";

const WAITLIST_FILE = path.join(process.cwd(), "data", "waitlist.json");

interface WaitlistEntry {
  email: string;
  timestamp: string;
}

async function ensureDataDir() {
  const dataDir = path.dirname(WAITLIST_FILE);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

async function ensureFile() {
  await ensureDataDir();
  try {
    await fs.access(WAITLIST_FILE);
  } catch {
    await fs.writeFile(WAITLIST_FILE, "[]", "utf-8");
  }
}

export async function getWaitlist(): Promise<WaitlistEntry[]> {
  await ensureFile();
  const data = await fs.readFile(WAITLIST_FILE, "utf-8");
  return JSON.parse(data);
}

export async function addToWaitlist(email: string): Promise<void> {
  const waitlist = await getWaitlist();
  const entry: WaitlistEntry = {
    email: email.toLowerCase().trim(),
    timestamp: new Date().toISOString(),
  };
  waitlist.push(entry);
  await fs.writeFile(WAITLIST_FILE, JSON.stringify(waitlist, null, 2), "utf-8");
}

export async function isEmailRegistered(email: string): Promise<boolean> {
  const waitlist = await getWaitlist();
  const normalizedEmail = email.toLowerCase().trim();
  return waitlist.some((entry) => entry.email === normalizedEmail);
}
