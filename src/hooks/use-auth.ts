import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { consumeIntentionalSignOut, getStableSession, rememberSession, safeSignOut } from "@/lib/auth-session";
import { clearQueryPersistence, switchQueryPersistenceUser } from "@/lib/query-persist";

export type AppRole = "owner" | "manager" | "accountant" | "warehouse" | "director";
export type Department = "sales" | "legal" | "accounting" | "construction" | "hr";

type AuthState = {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  isPlatformAdmin: boolean;
  companyId: string | null;
  department: Department | null;
  extraPages: string[];
  deniedPages: string[];
  loading: boolean;
  profileLoaded: boolean;
  isCompanyOwner: boolean;
};

const initialAuthState: AuthState = {
  session: null,
  user: null,
  roles: [],
  isPlatformAdmin: false,
  companyId: null,
  department: null,
  extraPages: [],
  deniedPages: [],
  loading: true,
  profileLoaded: false,
  isCompanyOwner: false,
};

let authState = initialAuthState;
let authStarted = false;
let profileLoadSeq = 0;
const authListeners = new Set<(state: AuthState) => void>();

function emitAuthState(patch: Partial<AuthState>) {
  authState = { ...authState, ...patch };
  authListeners.forEach((listener) => listener(authState));
}

function clearAuthState() {
  emitAuthState({
    session: null,
    user: null,
    roles: [],
    isPlatformAdmin: false,
    companyId: null,
    department: null,
    extraPages: [],
    deniedPages: [],
    isCompanyOwner: false,
    profileLoaded: false,
    loading: false,
  });
}

async function loadProfileAttempt(uid: string, seq: number): Promise<boolean> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user.id !== uid || !sessionData.session.access_token) return false;

  const [rRes, paRes, profRes, ownedRes] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", uid),
    (supabase as any).from("platform_admins").select("user_id").eq("user_id", uid).maybeSingle(),
    (supabase as any).from("profiles").select("company_id, department, extra_pages, denied_pages").eq("id", uid).maybeSingle(),
    (supabase as any).from("companies").select("id").eq("owner_user_id", uid).maybeSingle(),
  ]);

  if (paRes.error) return false;
  const ownedCompanyId = (ownedRes.data as any)?.id ?? null;
  const profileCompanyId = (profRes.data as any)?.company_id ?? null;

  if (paRes.data && !ownedCompanyId && !profileCompanyId) {
    if (seq !== profileLoadSeq) return true;
    emitAuthState({
      roles: ((rRes.data ?? []) as any[]).map((x: any) => x.role as AppRole),
      isPlatformAdmin: true,
      companyId: null,
      department: null,
      extraPages: [],
      deniedPages: [],
      isCompanyOwner: false,
      profileLoaded: true,
    });
    return true;
  }

  // Company identity is critical. On slow/unstable laptops one lightweight
  // request can succeed while profile/company requests fail; treating that as
  // "loaded" makes owners look company-less and kicks them out of the app.
  const companyLookupOk = !profRes.error && !ownedRes.error;
  if (!companyLookupOk) return false;
  if (seq !== profileLoadSeq) return true;

  const previousCompanyId = authState.user?.id === uid ? authState.companyId : null;
  const nextCompanyId = profileCompanyId ?? ownedCompanyId ?? previousCompanyId ?? null;

  emitAuthState({
    roles: ((rRes.data ?? []) as any[]).map((x: any) => x.role as AppRole),
    isPlatformAdmin: !!paRes.data,
    companyId: nextCompanyId,
    department: ((profRes.data as any)?.department ?? null) as Department | null,
    extraPages: ((profRes.data as any)?.extra_pages ?? []) as string[],
    deniedPages: ((profRes.data as any)?.denied_pages ?? []) as string[],
    isCompanyOwner: !!ownedCompanyId,
    profileLoaded: true,
  });
  return true;
}

async function loadProfile(uid: string) {
  const seq = ++profileLoadSeq;
  const delays = [0, 400, 900, 1600];
  try {
    for (const d of delays) {
      if (d) await new Promise((r) => window.setTimeout(r, d));
      if (seq !== profileLoadSeq) return;
      const ok = await loadProfileAttempt(uid, seq);
      if (ok) return;
    }
  } catch (error) {
    console.error("Failed to load auth profile", error);
  } finally {
    if (seq === profileLoadSeq) emitAuthState({ loading: false });
  }
}

async function initAuth() {
  const s = await getStableSession();
  rememberSession(s);
  emitAuthState({ session: s, user: s?.user ?? null });
  if (s?.user) await loadProfile(s.user.id);
  else clearAuthState();
}

function startAuthController() {
  if (authStarted || typeof window === "undefined") return;
  authStarted = true;

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
    if (event === "INITIAL_SESSION") return;

    if (event === "SIGNED_OUT") {
      if (consumeIntentionalSignOut()) {
        clearQueryPersistence();
        profileLoadSeq += 1;
        clearAuthState();
        return;
      }

      // A spurious SIGNED_OUT (rate-limit/refresh glitch) must NOT trigger
      // another recovery call — that just multiplies /token requests and
      // ping-pongs 429s. Do nothing here; the next route check restores state.
      return;
    }

    const sameUser = authState.user?.id === s?.user?.id;
    if (s?.user?.id && !sameUser) switchQueryPersistenceUser(s.user.id);
    emitAuthState({
      session: s,
      user: s?.user ?? null,
      loading: true,
      profileLoaded: false,
      ...(sameUser ? {} : { roles: [], isPlatformAdmin: false, companyId: null, department: null, extraPages: [], deniedPages: [], isCompanyOwner: false }),
    });
    rememberSession(s);

    if (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "TOKEN_REFRESHED") {
      if (s?.user) window.setTimeout(() => loadProfile(s.user.id), 0);
      else if (event === "SIGNED_IN") clearAuthState();
    }
  });

  void initAuth();

  // Keep the subscription for the life of the tab. Several components call
  // useAuth(); a singleton controller prevents 20+ duplicate auth listeners,
  // duplicate profile queries, and refresh storms on weaker computers.
  window.addEventListener("beforeunload", () => subscription.unsubscribe(), { once: true });
}

export function useAuth() {
  const [state, setState] = useState<AuthState>(authState);

  useEffect(() => {
    startAuthController();
    authListeners.add(setState);
    setState(authState);
    return () => { authListeners.delete(setState); };
  }, []);

  const { user, session, roles, loading, companyId, department, extraPages, deniedPages, isPlatformAdmin, profileLoaded, isCompanyOwner } = state;

  return {
    user, session, roles, loading, companyId, department, extraPages, deniedPages, isPlatformAdmin, profileLoaded,
    signOut: safeSignOut,
    // A company owner is always treated as owner, even if the role row is missing.
    isOwner: roles.includes("owner") || isCompanyOwner,
    isAccountant: roles.includes("accountant"),
    isManager: roles.includes("manager"),
    isWarehouse: roles.includes("warehouse"),
    isDirector: roles.includes("director"),
  };
}
