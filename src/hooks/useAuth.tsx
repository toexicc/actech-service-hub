import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "technician" | "management";

export interface AuthProfile {
  id: string;
  name: string;
  username: string | null;
  staff_id: string | null;
  department: string | null;
  status: string;
  salary: number;
  salary_type: string;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: AuthProfile | null;
  roles: AppRole[];
  loading: boolean;
  isAdmin: boolean;
  isManagement: boolean;
  isAdminOrManagement: boolean;
  isTechnician: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  // Id of the user whose profile/roles are already hydrated in state.
  const hydratedUserIdRef = useRef<string | null>(null);

  const loadProfileAndRoles = async (uid: string) => {
    const [{ data: prof }, { data: roleRows }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile(prof as AuthProfile | null);
    const r = (roleRows ?? []).map((x: any) => x.role as AppRole);
    setRoles(r);
    hydratedUserIdRef.current = uid;
    // Compatibility shim for legacy pages reading sessionStorage
    try {
      const primaryRole = r.includes("admin") ? "admin" : r.includes("management") ? "management" : r.includes("technician") ? "technician" : "";
      sessionStorage.setItem("authenticated", "true");
      sessionStorage.setItem("userRole", primaryRole);
      sessionStorage.setItem("username", (prof as any)?.username ?? "");
      sessionStorage.setItem("userFullName", (prof as any)?.name ?? "");
      sessionStorage.setItem("staffId", (prof as any)?.staff_id ?? uid);
      sessionStorage.setItem("authUserId", uid);
    } catch {}
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      // Always keep session/user fresh so tokens stay valid.
      setSession(sess);
      setUser(sess?.user ?? null);

      if (sess?.user) {
        // TOKEN_REFRESHED (and repeat SIGNED_IN on tab refocus) fire for the
        // same user we already hydrated. Re-hydrating there would flip
        // loading=true and unmount the whole authenticated tree, which looks
        // exactly like a page reload. Ignore those events.
        if (hydratedUserIdRef.current === sess.user.id) return;

        const uid = sess.user.id;
        setLoading(true);
        setTimeout(() => {
          loadProfileAndRoles(uid).finally(() => setLoading(false));
        }, 0);
      } else {
        hydratedUserIdRef.current = null;
        setProfile(null);
        setRoles([]);
        if (event === "SIGNED_OUT") setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        // The subscription may have already hydrated this user.
        if (hydratedUserIdRef.current === sess.user.id) {
          setLoading(false);
          return;
        }
        loadProfileAndRoles(sess.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);


  const signOut = async () => {
    try { sessionStorage.clear(); } catch {}
    await supabase.auth.signOut();
  };

  const refresh = async () => {
    if (user) await loadProfileAndRoles(user.id);
  };

  const isAdmin = roles.includes("admin");
  const isManagement = roles.includes("management");
  const isTechnician = roles.includes("technician");
  const isAdminOrManagement = isAdmin || isManagement;

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        roles,
        loading,
        isAdmin,
        isManagement,
        isAdminOrManagement,
        isTechnician,
        signOut,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
