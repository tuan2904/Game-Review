import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { createGameReview, deleteReview, listGameReviews, updateReview } from "../../api/reviews";
import { useAuth } from "../../contexts/AuthContext";
import ReviewComments from "../comments/ReviewComments";
import EmptyState from "../common/EmptyState";
import ErrorMessage from "../common/ErrorMessage";
import Loading from "../common/Loading";
import Pagination from "../common/Pagination";
import ReviewCard from "./ReviewCard";
import ReviewForm from "./ReviewForm";

/**
 * Reviews section for one game: paginated display plus the Phase 08
 * workflows (create / edit / delete per docs/API.md — Review API).
 *
 * Mounted by GameDetail with `key={slug}` so every piece of local state
 * (pagination, edit mode, confirmation) resets when the game changes —
 * no slug-reset effects needed.
 *
 * Fetching uses the keyed-result + AbortController pattern: effects only
 * set state from async callbacks (lint-safe), `signal.aborted` drops stale
 * responses, and loading/error are derived by comparing the result key with
 * the current one. A review-list failure never affects the game details
 * (this component owns its own states).
 *
 * Access rules (server is authoritative; the UI only mirrors it):
 *  - signed out → "Log in" link preserving `state.from` (Login redirects back)
 *  - signed in → creation form, unless the current user already reviewed
 *    (found on the loaded page) or they already created one this session
 *  - Edit/Delete render for the review's author or staff; delete requires an
 *    inline confirmation step; failures (401/403/404/409/400…) render a
 *    recoverable message and leave the list untouched.
 *
 * @param {Object} props
 * @param {string} props.slug game slug
 */
export default function GameReviews({ slug }) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState({ key: null, data: null, error: null });
  const [pager, setPager] = useState({ slug: null, page: 1 });

  const [editingId, setEditingId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [justCreated, setJustCreated] = useState(false);

  /* Page resets implicitly when the slug changes (derived, no effect). */
  const page = pager.slug === slug ? pager.page : 1;
  const key = `${slug}|${page}|${reloadKey}`;

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    listGameReviews(slug, { page, page_size: 12 }, { signal })
      .then((data) => {
        if (signal.aborted) return;
        setResult({ key, data, error: null });
      })
      .catch((caught) => {
        if (signal.aborted) return;
        setResult({ key, data: null, error: caught });
      });
    return () => controller.abort();
  }, [slug, page, key]);

  const loading = result.key !== key;
  const reviews = loading ? null : result.data;
  const error = loading ? null : result.error;

  const refresh = () => setReloadKey((current) => current + 1);

  const ownsReviewOnPage = Boolean(
    user && reviews?.items.some((review) => review.author?.id === user.id),
  );
  const showCreateForm = isAuthenticated && !justCreated && !ownsReviewOnPage;

  async function handleCreate(values) {
    setActionError(null);
    // Rejections surface inside ReviewForm (field + general errors).
    await createGameReview(slug, values);
    setJustCreated(true);
    setPager({ slug, page: 1 });
    refresh();
  }

  async function handleEdit(review, values) {
    setActionError(null);
    await updateReview(review.id, values);
    setEditingId(null);
    refresh();
  }

  async function handleConfirmDelete(review) {
    setDeleting(true);
    setActionError(null);
    try {
      await deleteReview(review.id);
      setConfirmId(null);
      setJustCreated(false);
      refresh();
    } catch (caught) {
      /* Close the confirmation either way — the review stays listed and the
         idle controls return, so the action can be retried or abandoned. */
      setConfirmId(null);
      if (caught?.status === 404) {
        /* Already gone server-side — reconcile the list, no error to show. */
        refresh();
      } else {
        setActionError(caught?.message || "Couldn't delete this review.");
      }
    } finally {
      setDeleting(false);
    }
  }

  let content;
  if (loading) {
    content = <Loading label="Loading reviews…" />;
  } else if (error) {
    content = (
      <ErrorMessage title="Couldn't load reviews" message={error.message} onRetry={refresh} />
    );
  } else if (reviews && reviews.items.length === 0) {
    content = (
      <EmptyState title="No reviews yet" description="This game hasn't been reviewed yet." />
    );
  } else if (reviews) {
    content = (
      <>
        <div className="review-list">
          {reviews.items.map((review) => {
            if (editingId === review.id) {
              return (
                <div className="review-card review-card--editing" key={review.id}>
                  <h4 className="review-card__edit-title">Edit your review</h4>
                  <ReviewForm
                    initialRating={review.rating}
                    initialContent={review.content}
                    submitLabel="Save changes"
                    onCancel={() => setEditingId(null)}
                    onSubmit={(values) => handleEdit(review, values)}
                  />
                </div>
              );
            }

            const canManage = Boolean(user) && (user.is_staff || review.author?.id === user.id);
            /* Comments live inside their review (lazy panel — see
               ReviewComments); keyed per review so state resets when the
               review list changes. */
            const comments = <ReviewComments key={review.id} reviewId={review.id} />;

            if (!canManage) {
              return (
                <ReviewCard key={review.id} review={review}>
                  {comments}
                </ReviewCard>
              );
            }

            return (
              <ReviewCard
                key={review.id}
                review={review}
                onEdit={() => {
                  setActionError(null);
                  setEditingId(review.id);
                }}
                onDelete={() => {
                  setActionError(null);
                  setConfirmId(review.id);
                }}
                confirming={confirmId === review.id}
                onConfirmDelete={() => handleConfirmDelete(review)}
                onCancelDelete={() => setConfirmId(null)}
                deleting={deleting}
              >
                {comments}
              </ReviewCard>
            );
          })}
        </div>
        <Pagination
          page={reviews.pagination.page}
          pageCount={reviews.pagination.total_pages}
          onPageChange={(nextPage) => setPager({ slug, page: nextPage })}
        />
      </>
    );
  }

  return (
    <>
      {!isAuthenticated ? (
        <p className="muted review-section__prompt">
          <Link to="/login" state={{ from: location.pathname }}>
            Log in
          </Link>{" "}
          to write a review.
        </p>
      ) : (
        showCreateForm && (
          <div className="review-form-panel">
            <h3 className="review-form-panel__title">Write a review</h3>
            <ReviewForm submitLabel="Post review" onSubmit={handleCreate} />
          </div>
        )
      )}

      {actionError && <ErrorMessage title="Review action failed" message={actionError} />}

      {content}
    </>
  );
}
