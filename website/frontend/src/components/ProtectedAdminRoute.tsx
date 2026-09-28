import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/authContext";

export function ProtectedAdminRoute() {
  const { loading, isLoggedIn, userData } = useAuth();

  if (loading) {
    return null;
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  if (!userData.admin) {
    return <Navigate to="/home" replace />;
  }

  return <Outlet />;
}
