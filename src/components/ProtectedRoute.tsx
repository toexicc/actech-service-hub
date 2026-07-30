import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, AppRole } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface Props {
  children: ReactNode;
  roles?: AppRole[]; // if omitted, any authenticated user
}

const hasStoredSupabaseToken = () => {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || "";
      if (k.startsWith("sb-") && k.endsWith("-auth-token")) {
        const v = localStorage.getItem(k);
        if (v && v.length > 10) return true;
      }
    }
  } catch {}
  return false;
};

const ProtectedRoute = ({ children, roles }: Props) => {
  const { user, roles: userRoles, loading } = useAuth();
  const location = useLocation();

  // Only gate on loading during *initial* auth resolution. Once a user is
  // present we keep rendering children even if loading briefly flips, so a
  // token refresh can never tear down (and visually "reload") the app tree.
  if (!user && (loading || hasStoredSupabaseToken())) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }


  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (roles && roles.length > 0 && !userRoles.some((r) => roles.includes(r))) {
    return <Navigate to="/menu" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
