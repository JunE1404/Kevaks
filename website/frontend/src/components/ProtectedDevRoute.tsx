import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/authContext";

export function ProtectedDevRoute() {
  const { loading, isLoggedIn, userData } = useAuth();

  if (loading) {
    return null;
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  if (!userData.admin && !userData.dev) {
    return <Navigate to="/games" replace />;
  }

  return <Outlet />;
}
