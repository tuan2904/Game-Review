import { Link } from "react-router-dom";
import PageContainer from "../../components/common/PageContainer";

/**
 * Admin landing page — navigation only, by design.
 *
 * The backend exposes no dashboard/summary endpoint, so this page shows no
 * totals, counts, charts, or any other metric that would have to be
 * fabricated. It links exactly to the modules whose write APIs are verified
 * (docs/API.md — Game API / Category API) and names the capabilities the
 * API does not support so the absence is explicit rather than mysterious.
 *
 * Admin-only: reached through `AdminRoute` (`is_staff` verified from
 * `useAuth()`; the backend re-checks every write).
 */
export default function AdminDashboard() {
  return (
    <PageContainer title="Admin dashboard" subtitle="Catalog management for GameReview.">
      <ul className="admin-nav-list">
        <li className="admin-nav-card">
          <Link to="/admin/games" className="admin-nav-card__link">
            Games
          </Link>
          <p className="admin-nav-card__description">
            List every game (including inactive), create, edit, activate or deactivate, and delete.
          </p>
        </li>
        <li className="admin-nav-card">
          <Link to="/admin/categories" className="admin-nav-card__link">
            Categories
          </Link>
          <p className="admin-nav-card__description">
            List, create, rename, re-slug, and delete game categories.
          </p>
        </li>
      </ul>

      <p className="muted admin-note">
        Not available through the API: dashboard statistics, cross-game review moderation (reviews
        can be deleted from each game&apos;s page), and user management.
      </p>
    </PageContainer>
  );
}
