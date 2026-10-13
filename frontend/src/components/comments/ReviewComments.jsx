import { useEffect, useId, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  createReviewComment,
  deleteComment,
  listReviewComments,
  updateComment,
} from "../../api/comments";
import { useAuth } from "../../contexts/AuthContext";
import EmptyState from "../common/EmptyState";
import ErrorMessage from "../common/ErrorMessage";
import Loading from "../common/Loading";
import Pagination from "../common/Pagination";
import CommentForm from "./CommentForm";
import CommentItem from "./CommentItem";

/**
 * Comments for one review — a lazily expanded panel rendered inside the
 * review card (visually secondary to the review itself).
 *
 * Collapsed by default: nothing is fetched until the panel opens, so a
 * listing of N reviews costs zero comment requests and the detail page
 * stays short (docs/API.md — Comment API is paginated, newest first).
 *
 * Fetching uses the shared keyed-result + AbortController pattern: effects
 * only set state from async callbacks (lint-safe), `signal.aborted` drops
 * stale responses (collapse, review change, refresh), and loading/error are
 * derived by comparing the result key. Everything the panel does — list,
 * create, edit, delete — is owned here, so a comment failure never affects
 * the game details or the review it belongs to.
 *
 * Access rules (server is authoritative — `IsAdminOrOwner` on mutations):
 *  - signed out → the public list renders with a "Log in" prompt preserving
 *    `state.from`; there is no form to submit
 *  - signed in → create form (single non-blank `content` payload)
 *  - Edit/Delete render for the comment's author or staff; delete requires
 *    an inline confirmation; failures (401/403/404/400…) render a
 *    recoverable message and leave the list untouched (404 reconciles).
 *
 * @param {Object} props
 * @param {number} props.reviewId id of the review these comments belong to
 */
export default function ReviewComments({ reviewId }) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const panelId = useId();

  const [open, setOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ key: null, data: null, error: null });

  const [editingId, setEditingId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState(null);

  const key = `${reviewId}|${page}|${reloadKey}`;

  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    const { signal } = controller;
    listReviewComments(reviewId, { page, page_size: 12 }, { signal })
      .then((data) => {
        if (signal.aborted) return;
        setResult({ key, data, error: null });
      })
      .catch((caught) => {
        if (signal.aborted) return;
        setResult({ key, data: null, error: caught });
      });
    return () => controller.abort();
  }, [open, reviewId, page, key]);

  const loading = open && result.key !== key;
  const comments = loading ? null : result.data;
  const error = loading ? null : result.error;

  const refresh = () => setReloadKey((current) => current + 1);

  async function handleCreate(values) {
    setActionError(null);
    // Rejections surface inside CommentForm (field + general errors).
    await createReviewComment(reviewId, values);
    setPage(1);
    refresh();
  }

  async function handleEdit(comment, values) {
    setActionError(null);
    await updateComment(comment.id, values);
    setEditingId(null);
    refresh();
  }

  async function handleConfirmDelete(comment) {
    setDeleting(true);
    setActionError(null);
    try {
      await deleteComment(comment.id);
      setConfirmId(null);
      refresh();
    } catch (caught) {
      /* Close the confirmation either way — the comment stays listed and the
         idle controls return, so the action can be retried or abandoned. */
      setConfirmId(null);
      if (caught?.status === 404) {
        /* Already gone server-side — reconcile, no error to show. */
        refresh();
      } else {
        setActionError(caught?.message || "Couldn't delete this comment.");
      }
    } finally {
      setDeleting(false);
    }
  }

  let content = null;
  if (loading) {
    content = <Loading label="Loading comments…" />;
  } else if (error) {
    content = (
      <ErrorMessage title="Couldn't load comments" message={error.message} onRetry={refresh} />
    );
  } else if (comments && comments.items.length === 0) {
    content = (
      <EmptyState title="No comments yet" description="No one has replied to this review." />
    );
  } else if (comments) {
    content = (
      <>
        <ul className="comment-list">
          {comments.items.map((comment) => {
            const canManage = Boolean(user) && (user.is_staff || comment.author?.id === user.id);
            const editable = () => {
              setActionError(null);
              setEditingId(comment.id);
            };
            const deletable = () => {
              setActionError(null);
              setConfirmId(comment.id);
            };

            if (editingId === comment.id) {
              return (
                <CommentItem key={comment.id} comment={comment}>
                  <h5 className="comment__edit-title">Edit your comment</h5>
                  <CommentForm
                    initialContent={comment.content}
                    submitLabel="Save changes"
                    onCancel={() => setEditingId(null)}
                    onSubmit={(values) => handleEdit(comment, values)}
                  />
                </CommentItem>
              );
            }

            return (
              <CommentItem
                key={comment.id}
                comment={comment}
                onEdit={canManage ? editable : undefined}
                onDelete={canManage ? deletable : undefined}
                confirming={confirmId === comment.id}
                onConfirmDelete={() => handleConfirmDelete(comment)}
                onCancelDelete={() => setConfirmId(null)}
                deleting={deleting}
              />
            );
          })}
        </ul>
        <Pagination
          page={comments.pagination.page}
          pageCount={comments.pagination.total_pages}
          onPageChange={setPage}
        />
      </>
    );
  }

  return (
    <div className="comments">
      <button
        type="button"
        className="btn btn--ghost btn--small comments__toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? "Hide comments" : "Show comments"}
      </button>

      {open && (
        <div className="comments__panel" id={panelId}>
          {!isAuthenticated ? (
            <p className="muted comments__prompt">
              <Link to="/login" state={{ from: location.pathname }}>
                Log in
              </Link>{" "}
              to comment.
            </p>
          ) : (
            <CommentForm submitLabel="Post comment" onSubmit={handleCreate} />
          )}

          {actionError && <ErrorMessage title="Comment action failed" message={actionError} />}

          {content}
        </div>
      )}
    </div>
  );
}
