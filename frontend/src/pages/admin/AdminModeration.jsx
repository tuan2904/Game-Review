import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { moderateComment } from "../../api/comments";
import {
  listAdminComments,
  listAdminReports,
  listAdminReviews,
  resolveReport,
} from "../../api/adminModeration";
import { REPORT_REASONS } from "../../api/reports";
import { deleteReview } from "../../api/reviews";
import Button from "../../components/common/Button";
import EmptyState from "../../components/common/EmptyState";
import ErrorMessage from "../../components/common/ErrorMessage";
import Input from "../../components/common/Input";
import Loading from "../../components/common/Loading";
import PageContainer from "../../components/common/PageContainer";
import Pagination from "../../components/common/Pagination";
import { formatDate } from "../../utils/format";

const PAGE_SIZE = 12;

const TABS = [
  { id: "reports", label: "Reports" },
  { id: "reviews", label: "Reviews" },
  { id: "comments", label: "Comments" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "RESOLVED", label: "Resolved" },
];

const VISIBILITY_OPTIONS = [
  { value: "all", label: "All comments" },
  { value: "visible", label: "Visible only" },
  { value: "hidden", label: "Hidden only" },
];

/* Per-tab filters: reports also filter by status, comments by visibility.
   Every change to search/filter resets to page 1 (the new result set may
   have fewer pages). */
const INITIAL_FILTERS = {
  reports: { search: "", status: "all", page: 1 },
  reviews: { search: "", page: 1 },
  comments: { search: "", visibility: "all", page: 1 },
};

const EXCERPT_MAX = 90;

function excerpt(text) {
  return text.length > EXCERPT_MAX ? `${text.slice(0, EXCERPT_MAX - 1)}…` : text;
}

function displayName(person) {
  return `${person?.first_name ?? ""} ${person?.last_name ?? ""}`.trim() || "Unknown";
}

function reasonLabel(reason) {
  return REPORT_REASONS.find((option) => option.value === reason)?.label ?? reason;
}

/**
 * Staff moderation workspace (Phase E) — verified endpoints only
 * (docs/API.md — Admin moderation API):
 *
 *  - Reports:  GET /admin/reports/ (`?status=`, `?search=`) +
 *    POST /admin/reports/{id}/resolve/ (pending → resolved; repeats → 409
 *    which simply refreshes the row).
 *  - Reviews:  GET /admin/reviews/ (`?search=`) + the existing
 *    DELETE /reviews/{id}/ with a two-step inline confirmation.
 *  - Comments: GET /admin/comments/ (`?search=`, `?is_hidden=`) + the
 *    existing POST /comments/{id}/moderate/ (hide/unhide, reversible).
 *
 * One keyed fetch + AbortController drives the active tab (stale responses
 * are dropped); each tab keeps its own search/filter/page state so switching
 * tabs never leaks a filter into the wrong list. Action failures render a
 * recoverable alert and leave the row unchanged. The backend re-checks every
 * call (`IsAdmin`: 401 anon / 403 non-admin) — `AdminRoute` is UX only.
 */
export default function AdminModeration() {
  const [tab, setTab] = useState("reports");
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState({ key: null, data: null, error: null });

  const [resolvingId, setResolvingId] = useState(null);
  const [moderatingId, setModeratingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const active = filters[tab];
  const { search, page } = active;
  /* Extra per-tab filter: report status / comment visibility
     ("" = none for reviews, "all" = no narrowing for reports/comments). */
  const extra = tab === "reports" ? active.status : tab === "comments" ? active.visibility : "";
  const extraActive = extra !== "" && extra !== "all";
  const key = `${tab}|${search}|${page}|${extra}|${reloadKey}`;

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const params = { page, page_size: PAGE_SIZE };
    if (search) params.search = search;

    let request;
    if (tab === "reports") {
      if (extra !== "all") params.status = extra;
      request = listAdminReports(params, { signal });
    } else if (tab === "reviews") {
      request = listAdminReviews(params, { signal });
    } else {
      if (extra !== "all") params.is_hidden = extra === "hidden";
      request = listAdminComments(params, { signal });
    }

    request
      .then((data) => {
        if (signal.aborted) return;
        setResult({ key, data, error: null });
      })
      .catch((caught) => {
        if (signal.aborted) return;
        setResult({ key, data: null, error: caught });
      });
    return () => controller.abort();
  }, [key, tab, search, page, extra]);

  const loading = result.key !== key;
  const data = loading ? null : result.data;
  const error = loading ? null : result.error;

  const refresh = () => setReloadKey((current) => current + 1);

  function updateFilter(name, value) {
    setFilters((current) => ({
      ...current,
      [tab]: { ...current[tab], [name]: value, page: 1 },
    }));
  }

  function changePage(nextPage) {
    setFilters((current) => ({ ...current, [tab]: { ...current[tab], page: nextPage } }));
  }

  function switchTab(nextTab) {
    setTab(nextTab);
    setSearchInput(filters[nextTab].search);
    setConfirmId(null);
    setActionError(null);
  }

  function applySearch(event) {
    event.preventDefault();
    updateFilter("search", searchInput.trim());
  }

  function clearSearch() {
    setSearchInput("");
    updateFilter("search", "");
  }

  async function handleResolve(report) {
    setResolvingId(report.id);
    setActionError(null);
    try {
      await resolveReport(report.id);
      refresh();
    } catch (caught) {
      if (caught?.status === 409) {
        /* Resolved in another session — reconcile instead of erroring. */
        refresh();
      } else {
        setActionError(caught?.message || "Couldn't resolve this report.");
      }
    } finally {
      setResolvingId(null);
    }
  }

  async function handleToggleHidden(comment) {
    setModeratingId(comment.id);
    setActionError(null);
    try {
      await moderateComment(comment.id, !comment.is_hidden);
      refresh();
    } catch (caught) {
      setActionError(caught?.message || "Couldn't update this comment.");
    } finally {
      setModeratingId(null);
    }
  }

  async function handleConfirmDelete(review) {
    setDeletingId(review.id);
    setActionError(null);
    try {
      await deleteReview(review.id);
      setConfirmId(null);
      refresh();
    } catch (caught) {
      setConfirmId(null);
      if (caught?.status === 404) {
        refresh();
      } else {
        setActionError(caught?.message || "Couldn't delete this review.");
      }
    } finally {
      setDeletingId(null);
    }
  }

  function reportsTable(items) {
    return (
      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Reason</th>
              <th scope="col">Reported content</th>
              <th scope="col">Reporter</th>
              <th scope="col">Status</th>
              <th scope="col">Reported</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((report) => {
              const target = report.review ?? report.comment;
              return (
                <tr key={report.id}>
                  <td>
                    <span className="admin-table__name">{reasonLabel(report.reason)}</span>
                    {report.details && (
                      <span className="admin-table__excerpt">{excerpt(report.details)}</span>
                    )}
                  </td>
                  <td>
                    <span className="badge badge--placeholder">
                      {report.review ? "Review" : "Comment"}
                    </span>
                    <Link to={`/games/${target.game.slug}`} className="admin-table__slug">
                      {target.game.name}
                    </Link>
                    <span className="admin-table__excerpt">“{excerpt(target.content)}”</span>
                  </td>
                  <td>{displayName(report.reporter)}</td>
                  <td>
                    <span
                      className={`badge ${
                        report.status === "PENDING" ? "badge--pending" : "badge--resolved"
                      }`}
                    >
                      {report.status === "PENDING" ? "Pending" : "Resolved"}
                    </span>
                    {report.status === "RESOLVED" && report.resolved_by && (
                      <span className="admin-table__excerpt">
                        by {displayName(report.resolved_by)}
                      </span>
                    )}
                  </td>
                  <td>{formatDate(report.created_at)}</td>
                  <td>
                    <div className="admin-actions">
                      {report.status === "PENDING" ? (
                        <Button
                          variant="ghost"
                          className="btn--small"
                          loading={resolvingId === report.id}
                          onClick={() => handleResolve(report)}
                        >
                          Resolve
                        </Button>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  function reviewsTable(items) {
    return (
      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Rating</th>
              <th scope="col">Content</th>
              <th scope="col">Author</th>
              <th scope="col">Game</th>
              <th scope="col">Posted</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((review) => (
              <tr key={review.id}>
                <td>{review.rating} / 5</td>
                <td>{excerpt(review.content)}</td>
                <td>{displayName(review.author)}</td>
                <td>
                  <Link to={`/games/${review.game.slug}`} className="admin-table__slug">
                    {review.game.name}
                  </Link>
                </td>
                <td>{formatDate(review.created_at)}</td>
                <td>
                  {confirmId === review.id ? (
                    <div className="admin-actions">
                      <span className="admin-actions__confirm">Delete this review?</span>
                      <Button
                        variant="danger"
                        className="btn--small"
                        loading={deletingId === review.id}
                        onClick={() => handleConfirmDelete(review)}
                      >
                        Delete
                      </Button>
                      <Button
                        variant="ghost"
                        className="btn--small"
                        disabled={deletingId === review.id}
                        onClick={() => setConfirmId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="admin-actions">
                      <Button
                        variant="ghost"
                        className="btn--small"
                        onClick={() => {
                          setActionError(null);
                          setConfirmId(review.id);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function commentsTable(items) {
    return (
      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Content</th>
              <th scope="col">Author</th>
              <th scope="col">Game</th>
              <th scope="col">Status</th>
              <th scope="col">Posted</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((comment) => (
              <tr key={comment.id}>
                <td>{excerpt(comment.content)}</td>
                <td>{displayName(comment.author)}</td>
                <td>
                  <Link to={`/games/${comment.game.slug}`} className="admin-table__slug">
                    {comment.game.name}
                  </Link>
                </td>
                <td>
                  <span
                    className={`badge ${comment.is_hidden ? "badge--hidden" : "badge--placeholder"}`}
                  >
                    {comment.is_hidden ? "Hidden" : "Visible"}
                  </span>
                </td>
                <td>{formatDate(comment.created_at)}</td>
                <td>
                  <div className="admin-actions">
                    <Button
                      variant="ghost"
                      className="btn--small"
                      loading={moderatingId === comment.id}
                      onClick={() => handleToggleHidden(comment)}
                    >
                      {comment.is_hidden ? "Unhide" : "Hide"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  let content;
  if (loading) {
    content = <Loading label={`Loading ${tab}…`} />;
  } else if (error) {
    content = (
      <ErrorMessage
        title="Couldn't load moderation data"
        message={error.message}
        onRetry={refresh}
      />
    );
  } else if (data && data.items.length === 0) {
    if (search) {
      content = (
        <EmptyState
          title={`No ${tab} match your search`}
          description="Try a different keyword."
          action={
            <Button variant="secondary" onClick={clearSearch}>
              Clear search
            </Button>
          }
        />
      );
    } else if (extraActive) {
      content = (
        <EmptyState
          title="No matching items"
          description="Nothing in this tab matches the current filter."
        />
      );
    } else if (tab === "reports") {
      content = (
        <EmptyState
          title="No reports yet"
          description="User reports appear here as people flag reviews and comments."
        />
      );
    } else if (tab === "reviews") {
      content = (
        <EmptyState
          title="No reviews yet"
          description="Reviews from every game collect here for moderation."
        />
      );
    } else {
      content = (
        <EmptyState
          title="No comments yet"
          description="Comments from every game collect here for moderation."
        />
      );
    }
  } else if (data) {
    content =
      tab === "reports"
        ? reportsTable(data.items)
        : tab === "reviews"
          ? reviewsTable(data.items)
          : commentsTable(data.items);
  }

  return (
    <PageContainer
      title="Moderation"
      subtitle="Report queue and cross-game review/comment review."
      actions={
        <Link to="/admin" className="btn btn--ghost btn--small">
          Dashboard
        </Link>
      }
    >
      <div className="admin-tabs" role="group" aria-label="Moderation views">
        {TABS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={tab === option.id}
            className={`admin-tabs__tab${tab === option.id ? " admin-tabs__tab--active" : ""}`}
            onClick={() => switchTab(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <form className="admin-filters" onSubmit={applySearch}>
        <Input
          label={`Search ${tab}`}
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
        />
        {tab === "reports" && (
          <div className="field admin-filters__status">
            <label className="field__label" htmlFor="moderation-status">
              Status
            </label>
            <select
              id="moderation-status"
              className="field__input"
              value={extra}
              onChange={(event) => updateFilter("status", event.target.value)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {tab === "comments" && (
          <div className="field admin-filters__status">
            <label className="field__label" htmlFor="moderation-visibility">
              Visibility
            </label>
            <select
              id="moderation-visibility"
              className="field__input"
              value={extra}
              onChange={(event) => updateFilter("visibility", event.target.value)}
            >
              {VISIBILITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <Button type="submit" variant="secondary" className="admin-filters__submit">
          Search
        </Button>
      </form>

      {actionError && <ErrorMessage title="Moderation action failed" message={actionError} />}

      {content}

      {data && (
        <Pagination
          page={data.pagination.page}
          pageCount={data.pagination.total_pages}
          onPageChange={changePage}
        />
      )}
    </PageContainer>
  );
}
