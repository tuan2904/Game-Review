import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createCategory, deleteCategory, listCategories, updateCategory } from "../../api/games";
import CategoryForm from "../../components/admin/CategoryForm";
import Button from "../../components/common/Button";
import EmptyState from "../../components/common/EmptyState";
import ErrorMessage from "../../components/common/ErrorMessage";
import Loading from "../../components/common/Loading";
import PageContainer from "../../components/common/PageContainer";
import Pagination from "../../components/common/Pagination";

const PAGE_SIZE = 12;

/**
 * Admin category management — verified endpoints only:
 * `GET /categories/` (paginated, ordered by name), `POST /categories/`,
 * `PATCH /categories/{id}/`, `DELETE /categories/{id}/`
 * (docs/API.md — Category API).
 *
 * Create is a panel above the list (remounted after success so the next
 * entry starts clean); edit swaps the row into an inline form; delete is a
 * two-step confirmation. 409 (category referenced by games) and other
 * failures render a recoverable alert and leave the list untouched; 404 on
 * delete reconciles the list. Same keyed-fetch/stale-drop pattern as the
 * other list pages.
 */
export default function AdminCategories() {
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState({ key: null, data: null, error: null });
  const [page, setPage] = useState(1);

  const [createKey, setCreateKey] = useState(0);
  const [editingId, setEditingId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState(null);

  const key = `${page}|${reloadKey}`;

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    listCategories({ page, page_size: PAGE_SIZE }, { signal })
      .then((data) => {
        if (signal.aborted) return;
        setResult({ key, data, error: null });
      })
      .catch((caught) => {
        if (signal.aborted) return;
        setResult({ key, data: null, error: caught });
      });
    return () => controller.abort();
  }, [key, page]);

  const loading = result.key !== key;
  const categories = loading ? null : result.data;
  const error = loading ? null : result.error;

  const refresh = () => setReloadKey((current) => current + 1);

  async function handleCreate(payload) {
    setActionError(null);
    await createCategory(payload);
    setCreateKey((current) => current + 1);
    refresh();
  }

  async function handleEdit(category, payload) {
    setActionError(null);
    await updateCategory(category.id, payload);
    setEditingId(null);
    refresh();
  }

  async function handleConfirmDelete(category) {
    setDeleting(true);
    setActionError(null);
    try {
      await deleteCategory(category.id);
      setConfirmId(null);
      refresh();
    } catch (caught) {
      setConfirmId(null);
      if (caught?.status === 404) {
        refresh();
      } else {
        setActionError(caught?.message || "Couldn't delete the category.");
      }
    } finally {
      setDeleting(false);
    }
  }

  let content;
  if (loading) {
    content = <Loading label="Loading categories…" />;
  } else if (error) {
    content = (
      <ErrorMessage title="Couldn't load categories" message={error.message} onRetry={refresh} />
    );
  } else if (categories && categories.items.length === 0) {
    content = (
      <EmptyState title="No categories yet" description="Create the first category above." />
    );
  } else if (categories) {
    content = (
      <>
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Slug</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.items.map((category) => {
                if (editingId === category.id) {
                  return (
                    <tr key={category.id}>
                      <td colSpan={3}>
                        <CategoryForm
                          category={category}
                          submitLabel="Save changes"
                          onCancel={() => setEditingId(null)}
                          onSubmit={(payload) => handleEdit(category, payload)}
                        />
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={category.id}>
                    <td className="admin-table__name">{category.name}</td>
                    <td>{category.slug}</td>
                    <td>
                      {confirmId === category.id ? (
                        <div
                          className="admin-actions"
                          role="group"
                          aria-label={`Confirm deletion of ${category.name}`}
                        >
                          <span className="admin-actions__confirm">Delete {category.name}?</span>
                          <Button
                            variant="danger"
                            className="btn--small"
                            loading={deleting}
                            onClick={() => handleConfirmDelete(category)}
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
                          <Button
                            variant="ghost"
                            className="btn--small"
                            onClick={() => {
                              setActionError(null);
                              setEditingId(category.id);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            className="btn--small"
                            onClick={() => {
                              setActionError(null);
                              setConfirmId(category.id);
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination
          page={categories.pagination.page}
          pageCount={categories.pagination.total_pages}
          onPageChange={setPage}
        />
      </>
    );
  }

  return (
    <PageContainer
      title="Categories"
      subtitle="Categories used to group games."
      actions={
        <Link to="/admin" className="btn btn--ghost btn--small">
          Dashboard
        </Link>
      }
    >
      <section className="admin-form-panel" aria-labelledby="create-category-heading">
        <h2 className="admin-form-panel__title" id="create-category-heading">
          Create category
        </h2>
        <CategoryForm key={createKey} submitLabel="Create category" onSubmit={handleCreate} />
      </section>

      {actionError && <ErrorMessage title="Action failed" message={actionError} />}

      {content}
    </PageContainer>
  );
}
