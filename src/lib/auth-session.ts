import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

let rememberedSession: Session | null = null;
let stableSessionPromise: Promise<Session | null> | null = null;
let intentionalSignOut = false;

function authStorageKey() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  try {
    const hostname = new URL(supabaseUrl).hostname;
    return `sb-${hostname.split(".")[0]}-auth-token`;
  } catch {
    return "supabase.auth.token";
  }
}

const BACKUP_SUFFIX = "-stable-backup";

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    const key = "__binosoz_auth_storage_test__";
    window.localStorage.setItem(key, key);
    window.localStorage.removeItem(key);
    return window.localStorage;
  } catch {
    try {
      const key = "__binosoz_auth_storage_test__";
      window.sessionStorage.setItem(key, key);
      window.sessionStorage.removeItem(key);
      return window.sessionStorage;
    } catch {
      return null;
    }
  }
}

function isUsable(session: Session | null): boolean {
  if (!session) return false;
  if (!session.expires_at) return true;
  return session.expires_at > Math.floor(Date.now() / 1000) + 5;
}

function isRecoverable(session: Session | null): session is Session {
  return !!session?.refresh_token && !!session?.access_token;
}

function isSessionLike(value: unknown): value is Session {
  return !!value
    && typeof value === "object"
    && typeof (value as Session).access_token === "string"
    && typeof (value as Session).refresh_token === "string";
}

function readSession(key: string): Session | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isSessionLike(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeSession(key: string, session: Session) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(session));
  } catch {
    // noop
  }
}

function removeSession(key: string) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // noop
  }
}

function primaryKey() {
  return authStorageKey();
}

function backupKey() {
  return `${primaryKey()}${BACKUP_SUFFIX}`;
}

function readBackupSession() {
  return readSession(backupKey());
}

function readAnySavedSession() {
  return readSession(primaryKey()) ?? readBackupSession() ?? rememberedSession;
}

function persistSession(session: Session) {
  rememberedSession = session;
  writeSession(primaryKey(), session);
  writeSession(backupKey(), session);
}

export function rememberSession(session: Session | null) {
  if (session) persistSession(session);
}

export function getRememberedSession() {
  if (rememberedSession && isUsable(rememberedSession)) return rememberedSession;
  const backup = readBackupSession();
  return backup && isUsable(backup) ? backup : null;
}

export function restoreSessionFromBackup() {
  const backup = readBackupSession();
  if (!backup || !isUsable(backup)) return null;
  persistSession(backup);
  return backup;
}

export async function recoverSavedSession() {
  const saved = readAnySavedSession();
  if (saved && isUsable(saved)) {
    persistSession(saved);
    return saved;
  }

  if (!isRecoverable(saved)) return null;
  const recoverable = saved;

  try {
    const { data, error } = await supabase.auth.setSession({
      access_token: recoverable.access_token,
      refresh_token: recoverable.refresh_token,
    });
    if (!error && data.session) {
      persistSession(data.session);
      return data.session;
    }
  } catch (error) {
    console.warn("Failed to recover auth session", error);
  }

  return null;
}

// True when any saved session data exists (even if the access token is
// expired). Callers use this to decide whether to keep the user in the app
// while a refresh is retried, vs. redirect to /auth.
export function hasSavedSessionData(): boolean {
  const saved = readAnySavedSession();
  return isRecoverable(saved);
}

export function clearSavedSession() {
  rememberedSession = null;
  const key = primaryKey();
  removeSession(key);
  removeSession(`${key}-code-verifier`);
  removeSession(`${key}-user`);
  removeSession(backupKey());
}

export function consumeIntentionalSignOut() {
  const value = intentionalSignOut;
  intentionalSignOut = false;
  return value;
}

export async function safeSignOut() {
  intentionalSignOut = true;
  clearSavedSession();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw error;
}

async function loadStableSession(attempts: number, delayMs: number): Promise<Session | null> {
  for (let i = 0; i < attempts; i += 1) {
    try {
      // Ask supabase-js FIRST — it returns the cached in-memory session
      // without hitting /token. Only fall back to setSession() (which
      // forces a refresh call) when supabase truly has no session,
      // otherwise every navigation triggers a fresh /token request and
      // parallel calls storm rate-limits (HTTP 429) → SIGNED_OUT loop.
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        rememberSession(data.session);
        return data.session;
      }

      const recovered = await recoverSavedSession();
      if (recovered) return recovered;
    } catch (error) {
      console.warn("Failed to read auth session", error);
    }
    if (i < attempts - 1) await wait(delayMs);
  }
  return getRememberedSession();
}

export async function getStableSession(attempts = 3, delayMs = 350): Promise<Session | null> {
  if (!stableSessionPromise) {
    stableSessionPromise = loadStableSession(attempts, delayMs).finally(() => {
      stableSessionPromise = null;
    });
  }

  return stableSessionPromise;
}