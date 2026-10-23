import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAdminSummary } from "../../api/adminModeration";
import ErrorMessage from "../../components/common/ErrorMessage";
import Loading from "../../components/common/Loading";
import PageContainer from "../../components/common/PageContainer";

/**
 * Admin landing page: live dashboard counters (Phase E) plus navigation.
 *
 * The summary comes from `GET /admin/summary/` (staff only) — one request,
 * one count per model; a failed summary renders a recoverable inline error
 * while the module cards below stay usable. The page never fabricates
 * metrics, so totals always reflect the database at fetch time.
 *
 * Admin-only: reached through `AdminRoute` (`is_staff` verified from
 * `useAuth()`; the backend re-checks every call).
 */
export default function AdminDashboard() {
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState({ key: null, data: null, error: null });
  const key = `${reloadKey}`;

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    fetchAdminSummary({ signal })
      .then((data) => {
        if (signal.aborted) return;
        setResult({ key, data, error: null });
      })
      .catch((caught) => {
        if (signal.aborted) return;
        setResult({ key, data: null, error: caught });
      });
    return () => controller.abort();
  }, [key]);

  const loading = result.key !== key;
  const summary = loading ? null : result.data;
  const error = loading ? null : result.error;
  const refresh = () => setReloadKey((current) => current + 1);

  return (
    <PageContainer
      title="Admin dashboard"
      subtitle="Catalog, accounts and moderation for GameReview."
    >
      {loading && <Loading label="Loading summary…" />}
      {error && (
        <ErrorMessage title="Couldn't load summary" message={error.message} onRetry={refresh} />
      )}
      {summary && (
        <div className="admin-metrics">
          <Metric
            value={summary.games.total}
            label="Games"
            hint={`${summary.games.active} active · ${summary.games.inactive} inactive`}
          />
          <Metric value={summary.categories} label="Categories" />
          <Metric
            value={summary.users.total}
            label="Users"
            hint={`${summary.users.active} active · ${summary.users.locked} locked`}
          />
          <Metric value={summary.reviews} label="Reviews" />
          <Metric
            value={summary.comments.total}
            label="Comments"
            hint={`${summary.comments.visible} visible · ${summary.comments.hidden} hidden`}
          />
          <Metric
            value={summary.reports.pending}
            label="Pending reports"
            hint={`${summary.reports.resolved} resolved · ${summary.reports.total} total`}
          />
          <Metric value={summary.favorites} label="Favorites" />
        </div>
      )}

      <ul className="admin-nav-list">
        <li className="admin-nav-card">
          <Link to="/admin/moderation" className="admin-nav-card__link">
            Moderation
          </Link>
          <p className="admin-nav-card__description">
            Work the report queue, review and hide content across games, and resolve reports.
          </p>
        </li>
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
        <li className="admin-nav-card">
          <Link to="/admin/users" className="admin-nav-card__link">
            Users
          </Link>
          <p className="admin-nav-card__description">
            List and search accounts, and lock or unlock a user&apos;s access.
          </p>
        </li>
      </ul>

      <p className="muted admin-note">
        Not available through the API: historical analytics (trends over time) and permission levels
        beyond the staff flag — account lock/unlock lives under Users.
      </p>
    </PageContainer>
  );
}

/**
 * Single dashboard counter — value, label, optional hint line.
 *
 * @param {Object} props
 * @param {number} props.value
 * @param {string} props.label
 * @param {string} [props.hint]
 */
function Metric({ value, label, hint }) {
  return (
    <div className="admin-metric">
      <p className="admin-metric__value">{value}</p>
      <p className="admin-metric__label">{label}</p>
      {hint && <p className="admin-metric__hint">{hint}</p>}
    </div>
  );
}
