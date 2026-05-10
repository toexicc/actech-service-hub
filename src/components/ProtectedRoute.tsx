import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, AppRole } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface Props {
  children: ReactNode;
  roles?: AppRole[]; // if omitted, any authenticated user
}

const ProtectedRoute = ({ children, roles }: Props) => {
  const { user, roles: userRoles, loading } = useAuth();
  const location = useLocation();

  if (loading) {
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
