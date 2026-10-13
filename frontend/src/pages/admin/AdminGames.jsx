import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { deleteGame, listGames, updateGame } from "../../api/games";
import Button from "../../components/common/Button";
import EmptyState from "../../components/common/EmptyState";
import ErrorMessage from "../../components/common/ErrorMessage";
import Input from "../../components/common/Input";
import Loading from "../../components/common/Loading";
import PageContainer from "../../components/common/PageContainer";
import Pagination from "../../components/common/Pagination";
import { formatDate } from "../../utils/format";

const PAGE_SIZE = 12;

/**
 * Admin game management — `GET /games/` (staff see every status), plus the
 * verified admin writes `POST /games/`, `PATCH /games/{id}/`,
 * `DELETE /games/{id}/` (docs/API.md — Game API).
 *
 * Keyed fetch + AbortController drop stale responses; loading/error are
 * derived from the result key (effects only set state from async
 * callbacks). Search is applied on submit; `status` is meaningful here
 * because the caller is staff (`visible_to` shows all games). Deletes are
 * two-step confirmations; failures (409 "referenced by reviews", 403, …)
 * render a recoverable alert and leave the row in place. Status toggles are
 * reversible `PATCH {status}` calls and refresh the list.
 *
 * Frontend gating (AdminRoute) is UX only — the backend enforces
 * `IsAdminOrReadOnly` on every write.
 */
export default function AdminGames() {
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState({ key: null, data: null, error: null });
  const [filters, setFilters] = useState({ search: "", status: "" });
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);

  const [confirmId, setConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const key = `${filters.search}|${filters.status}|${page}|${reloadKey}`;

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    listGames(
      { search: filters.search, status: filters.status, page, page_size: PAGE_SIZE },
      { signal },
    )
      .then((data) => {
        if (signal.aborted) return;
        setResult({ key, data, error: null });
      })
      .catch((caught) => {
        if (signal.aborted) return;
        setResult({ key, data: null, error: caught });
      });
    return () => controller.abort();
  }, [key, filters.search, filters.status, page]);

  const loading = result.key !== key;
  const games = loading ? null : result.data;
  const error = loading ? null : result.error;

  const refresh = () => setReloadKey((current) => current + 1);
  const hasFilters = Boolean(filters.search || filters.status);

  function applySearch(event) {
    event.preventDefault();
    setFilters((current) => ({ ...current, search: searchInput.trim() }));
    setPage(1);
  }

  function changeStatus(value) {
    setFilters((current) => ({ ...current, status: value }));
    setPage(1);
  }

  function clearFilters() {
    setSearchInput("");
    setFilters({ search: "", status: "" });
    setPage(1);
  }

  async function handleStatusToggle(game) {
    setTogglingId(game.id);
    setActionError(null);
    try {
      await updateGame(game.id, { status: game.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" });
      refresh();
    } catch (caught) {
      setActionError(caught?.message || "Couldn't update the game status.");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleConfirmDelete(game) {
    setDeleting(true);
    setActionError(null);
    try {
      await deleteGame(game.id);
      setConfirmId(null);
      refresh();
    } catch (caught) {
      setConfirmId(null);
      if (caught?.status === 404) {
        refresh();
      } else {
        setActionError(caught?.message || "Couldn't delete the game.");
      }
    } finally {
      setDeleting(false);
    }
  }

  let content;
  if (loading) {
    content = <Loading label="Loading games…" />;
  } else if (error) {
    content = (
      <ErrorMessage title="Couldn't load games" message={error.message} onRetry={refresh} />
    );
  } else if (games && games.items.length === 0) {
    content = hasFilters ? (
      <EmptyState
        title="No games match your filters"
        description="Try a different search or clear the filters."
        action={
          <Button variant="secondary" onClick={clearFilters}>
            Clear filters
          </Button>
        }
      />
    ) : (
      <EmptyState title="No games yet" description="Create the first game to get started." />
    );
  } else if (games) {
    content = (
      <>
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Status</th>
                <th scope="col">Category</th>
                <th scope="col">Release date</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {games.items.map((game) => (
                <tr key={game.id}>
                  <td>
                    <span className="admin-table__name">{game.name}</span>
                    <span className="admin-table__slug">{game.slug}</span>
                  </td>
                  <td>
                    <span
                      className={`badge ${game.status === "INACTIVE" ? "badge--inactive" : ""}`}
                    >
                      {game.status === "INACTIVE" ? "Inactive" : "Active"}
                    </span>
                  </td>
                  <td>{game.category?.name || "Uncategorized"}</td>
                  <td>{formatDate(game.release_date) || "—"}</td>
                  <td>
                    {confirmId === game.id ? (
                      <div
                        className="admin-actions"
                        role="group"
                        aria-label={`Confirm deletion of ${game.name}`}
                      >
                        <span className="admin-actions__confirm">Delete {game.name}?</span>
                        <Button
                          variant="danger"
                          className="btn--small"
                          loading={deleting}
                          onClick={() => handleConfirmDelete(game)}
                        >
                          Delete
                        </Button>
                        <Button
                          variant="ghost"
                          className="btn--small"
                          disabled={deleting}
                          onClick={() => setConfirmId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="admin-actions">
                        <Link
                          className="btn btn--ghost btn--small"
                          to={`/admin/games/${game.slug}/edit`}
                        >
                          Edit
                        </Link>
                        <Button
                          variant="ghost"
                          className="btn--small"
                          loading={togglingId === game.id}
                          onClick={() => handleStatusToggle(game)}
                        >
                          {game.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        </Button>
                        <Button
                          variant="ghost"
                          className="btn--small"
                          onClick={() => {
                            setActionError(null);
                            setConfirmId(game.id);
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
        <Pagination
          page={games.pagination.page}
          pageCount={games.pagination.total_pages}
          onPageChange={setPage}
        />
      </>
    );
  }

  return (
    <PageContainer
      title="Games"
      subtitle="All games, including inactive ones."
      actions={
        <>
          <Link to="/admin" className="btn btn--ghost btn--small">
            Dashboard
          </Link>
          <Link to="/admin/games/new" className="btn btn--primary">
            New game
          </Link>
        </>
      }
    >
      <form className="admin-filters" onSubmit={applySearch}>
        <Input
          label="Search games"
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
        />
        <div className="field admin-filters__status">
          <label className="field__label" htmlFor="admin-games-status">
            Status
          </label>
          <select
            id="admin-games-status"
            className="field__input"
            value={filters.status}
            onChange={(event) => changeStatus(event.target.value)}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
        <Button type="submit" variant="secondary" className="admin-filters__submit">
          Search
        </Button>
      </form>

      {actionError && <ErrorMessage title="Action failed" message={actionError} />}

      {content}
    </PageContainer>
  );
}
