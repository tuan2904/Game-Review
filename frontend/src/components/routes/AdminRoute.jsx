import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import EmptyState from "../common/EmptyState";
import Loading from "../common/Loading";

/**
 * Blocks the `/admin` subtree.
 *
 * - while the startup session restore runs, shows a loader (never
 *   redirects prematurely)
 * - unauthenticated users go to /login with the full destination preserved
 *   in `location.state.from` (same convention as ProtectedRoute)
 * - authenticated users without the verified admin flag (`is_staff`, the
 *   backend's `IsAdmin`/`IsAdminOrReadOnly` rule) get a clear access-denied
 *   state — the admin interface is never rendered to them
 *
 * The check is `user?.is_staff === true`: a missing or malformed flag fails
 * closed. This is only a UI boundary — every admin endpoint is enforced
 * server-side (401/403) regardless of what the client renders.
 */
export default function AdminRoute() {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <Loading label="Restoring session…" />;
  }

  if (status !== "authenticated") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (user?.is_staff !== true) {
    return (
      <EmptyState
        title="Admin access required"
        description="Your account doesn't have administrative privileges."
        action={
          <Link to="/games" className="btn btn--primary">
            Back to games
          </Link>
        }
      />
    );
  }

  return <Outlet />;
}
