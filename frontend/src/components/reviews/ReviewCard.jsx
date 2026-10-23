import Button from "../common/Button";
import { formatDateTime } from "../../utils/format";

/**
 * Review display (list item) with optional owner/staff actions.
 *
 * Uses the verified review payload only: `rating` (1–5), `content`,
 * `author {id, first_name, last_name}`, `created_at`.
 *
 * Actions render only when the callbacks are passed — the parent decides
 * ownership (author id vs. signed-in user, or staff). Delete is a two-step
 * inline confirmation (no native dialogs); while a delete is pending both
 * buttons are disabled so the request cannot be duplicated.
 *
 * @param {Object} props
 * @param {import("../../types").Review} props.review
 * @param {import("react").ReactNode} [props.children] secondary content
 *   rendered below the actions (Phase 10: the review's comment panel)
 * @param {() => void} [props.onEdit] show an Edit button when provided
 * @param {() => void} [props.onDelete] show a Delete button when provided
 * @param {import("react").ReactNode} [props.reportControl] Phase E report
 *   control rendered for signed-in non-owners (parent decides eligibility)
 * @param {boolean} [props.confirming] render the delete confirmation row
 * @param {() => void} [props.onConfirmDelete]
 * @param {() => void} [props.onCancelDelete]
 * @param {boolean} [props.deleting] delete request in flight
 */
export default function ReviewCard({
  review,
  children,
  onEdit,
  onDelete,
  reportControl,
  confirming = false,
  onConfirmDelete,
  onCancelDelete,
  deleting = false,
}) {
  const rating = Math.min(Math.max(Math.round(review.rating), 0), 5);
  const author =
    `${review.author?.first_name ?? ""} ${review.author?.last_name ?? ""}`.trim() ||
    "Unknown author";
  const created = formatDateTime(review.created_at);

  return (
    <article className="review-card">
      <header className="review-card__header">
        <span className="review-card__author">{author}</span>
        <span className="review-card__rating">
          <span aria-hidden="true">{"★".repeat(rating) + "☆".repeat(5 - rating)}</span>
          <span className="sr-only">Rated {review.rating} out of 5</span>
        </span>
        {created && <time className="review-card__date">{created}</time>}
      </header>
      <p className="review-card__content">{review.content}</p>

      {confirming && (onConfirmDelete || onCancelDelete) ? (
        <footer className="review-card__actions" role="group" aria-label="Confirm deletion">
          <span className="review-card__confirm-text">Delete this review?</span>
          <Button
            variant="danger"
            className="btn--small"
            loading={deleting}
            onClick={onConfirmDelete}
          >
            Delete
          </Button>
          <Button
            variant="ghost"
            className="btn--small"
            disabled={deleting}
            onClick={onCancelDelete}
          >
            Cancel
          </Button>
        </footer>
      ) : (
        (onEdit || onDelete || reportControl) && (
          <footer className="review-card__actions">
            {onEdit && (
              <Button variant="ghost" className="btn--small" onClick={onEdit}>
                Edit
              </Button>
            )}
            {onDelete && (
              <Button variant="ghost" className="btn--small" onClick={onDelete}>
                Delete
              </Button>
            )}
            {reportControl}
          </footer>
        )
      )}

      {children && <div className="review-card__comments">{children}</div>}
    </article>
  );
}
