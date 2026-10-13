import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import Loading from "../common/Loading";

/**
 * Blocks unauthenticated access to nested routes.
 *
 * - while the startup session restore is running, shows a loader (never
 *   redirects prematurely)
 * - unauthenticated users are sent to /login with the requested destination
 *   preserved in `location.state.from`, so login can return them there
 */
export default function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <Loading label="Restoring session…" />;
  }

  if (status !== "authenticated") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
