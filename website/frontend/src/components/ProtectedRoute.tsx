import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/authContext";

export function ProtectedRoute() {
  const { loading, isLoggedIn } = useAuth();

  if (loading) {
    return null;
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
