import { createContext, useContext, useEffect, useState, ReactNode } from "react";
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

  const loadProfileAndRoles = async (uid: string) => {
    const [{ data: prof }, { data: roleRows }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile(prof as AuthProfile | null);
    const r = (roleRows ?? []).map((x: any) => x.role as AppRole);
    setRoles(r);
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
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setTimeout(() => loadProfileAndRoles(sess.user.id), 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
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
