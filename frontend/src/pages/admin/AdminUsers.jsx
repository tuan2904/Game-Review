import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listAdminUsers, setUserActive } from "../../api/adminUsers";
import Button from "../../components/common/Button";
import EmptyState from "../../components/common/EmptyState";
import ErrorMessage from "../../components/common/ErrorMessage";
import Input from "../../components/common/Input";
import Loading from "../../components/common/Loading";
import PageContainer from "../../components/common/PageContainer";
import Pagination from "../../components/common/Pagination";
import { useAuth } from "../../contexts/AuthContext";

const PAGE_SIZE = 12;

/**
 * Admin user management — verified endpoints only:
 * `GET /admin/users/` (paginated, ordered `-created_at`, `?search=`) and
 * `POST /admin/users/{id}/status/` (`{is_active}`) to lock/unlock
 * (docs/API.md — Admin user API).
 *
 * Keyed fetch + AbortController drop stale responses; search applies on
 * submit. Locking is reversible and refreshes the list; failures render a
 * recoverable alert and leave the row unchanged. The backend guards against
 * locking your own account, and `AdminRoute` gating is UX only (`IsAdmin`
 * enforces every call).
 */
export default function AdminUsers() {
  const { user: currentUser } = useAuth();

  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState({ key: null, data: null, error: null });
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);

  const [togglingId, setTogglingId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const key = `${search}|${page}|${reloadKey}`;

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    listAdminUsers({ search, page, page_size: PAGE_SIZE }, { signal })
      .then((data) => {
        if (signal.aborted) return;
        setResult({ key, data, error: null });
      })
      .catch((caught) => {
        if (signal.aborted) return;
        setResult({ key, data: null, error: caught });
      });
    return () => controller.abort();
  }, [key, search, page]);

  const loading = result.key !== key;
  const users = loading ? null : result.data;
  const error = loading ? null : result.error;

  const refresh = () => setReloadKey((current) => current + 1);

  function applySearch(event) {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  function clearSearch() {
    setSearchInput("");
    setSearch("");
    setPage(1);
  }

  async function handleToggle(user) {
    setTogglingId(user.id);
    setActionError(null);
    try {
      await setUserActive(user.id, !user.is_active);
      refresh();
    } catch (caught) {
      setActionError(caught?.message || "Couldn't update the account status.");
    } finally {
      setTogglingId(null);
    }
  }

  let content;
  if (loading) {
    content = <Loading label="Loading users…" />;
  } else if (error) {
    content = (
      <ErrorMessage title="Couldn't load users" message={error.message} onRetry={refresh} />
    );
  } else if (users && users.items.length === 0) {
    content = search ? (
      <EmptyState
        title="No users match your search"
        description="Try a different email or name."
        action={
          <Button variant="secondary" onClick={clearSearch}>
            Clear search
          </Button>
        }
      />
    ) : (
      <EmptyState title="No users yet" description="Accounts appear here as people register." />
    );
  } else if (users) {
    content = (
      <>
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Email</th>
                <th scope="col">Name</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.items.map((user) => {
                const name = `${user.first_name} ${user.last_name}`.trim() || "—";
                const isSelf = user.id === currentUser?.id;
                return (
                  <tr key={user.id}>
                    <td className="admin-table__name">{user.email}</td>
                    <td>{name}</td>
                    <td>
                      <span className={`badge ${user.is_staff ? "" : "badge--placeholder"}`}>
                        {user.is_staff ? "Staff" : "User"}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${user.is_active ? "" : "badge--inactive"}`}>
                        {user.is_active ? "Active" : "Locked"}
                      </span>
                    </td>
                    <td>
                      <div className="admin-actions">
                        {isSelf ? (
                          <span className="admin-actions__confirm">You</span>
                        ) : (
                          <Button
                            variant="ghost"
                            className="btn--small"
                            loading={togglingId === user.id}
                            onClick={() => handleToggle(user)}
                          >
                            {user.is_active ? "Lock" : "Unlock"}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination
          page={users.pagination.page}
          pageCount={users.pagination.total_pages}
          onPageChange={setPage}
        />
      </>
    );
  }

  return (
    <PageContainer
      title="Users"
      subtitle="Accounts registered on GameReview."
      actions={
        <Link to="/admin" className="btn btn--ghost btn--small">
          Dashboard
        </Link>
      }
    >
      <form className="admin-filters" onSubmit={applySearch}>
        <Input
          label="Search users"
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
        />
        <Button type="submit" variant="secondary" className="admin-filters__submit">
          Search
        </Button>
      </form>

      {actionError && <ErrorMessage title="Action failed" message={actionError} />}

      {content}
    </PageContainer>
  );
}
