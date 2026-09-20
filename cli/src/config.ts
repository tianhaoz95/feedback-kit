import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CONFIG_DIR = join(homedir(), ".feedbackkit");
export const CREDENTIALS_PATH = join(CONFIG_DIR, "credentials.json");

export interface Credentials {
  supabaseUrl: string;
  supabaseAnonKey: string;
  accessToken: string;
  refreshToken: string;
  /** Seconds since epoch, as returned by supabase-js's `Session.expires_at`. */
  expiresAt: number | null;
}

export function loadCredentials(): Credentials | null {
  if (!existsSync(CREDENTIALS_PATH)) return null;
  try {
    return JSON.parse(readFileSync(CREDENTIALS_PATH, "utf8")) as Credentials;
  } catch {
    return null;
  }
}

/** Written with owner-only permissions — this file holds a live session. */
export function saveCredentials(credentials: Credentials): void {
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(CREDENTIALS_PATH, JSON.stringify(credentials, null, 2), { mode: 0o600 });
}

export function clearCredentials(): void {
  if (existsSync(CREDENTIALS_PATH)) rmSync(CREDENTIALS_PATH);
}
