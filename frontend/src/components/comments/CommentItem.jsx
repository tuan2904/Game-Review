import Button from "../common/Button";
import { formatDateTime } from "../../utils/format";

/**
 * Single comment (list item) with optional owner/staff actions — visually
 * secondary to the parent review (smaller type, subdued styling).
 *
 * Uses the verified comment payload only: `content`,
 * `author {id, first_name, last_name}`, `created_at`/`updated_at` (an
 * `updated_at` differing from `created_at` renders an "(edited)" marker —
 * both are server-owned fields).
 *
 * Actions render only when the callbacks are passed — the parent decides
 * ownership (`author.id` vs. the signed-in user, or staff). Delete is a
 * two-step inline confirmation; while it is pending both buttons are
 * disabled so the request cannot be duplicated. Staff additionally get a
 * Hide/Unhide control (`onToggleHidden`) and see a "Hidden" badge on
 * moderated comments.
 *
 * @param {Object} props
 * @param {import("../../types").Comment} props.comment
 * @param {import("react").ReactNode} [props.children] inline edit form
 * @param {() => void} [props.onEdit] show an Edit button when provided
 * @param {() => void} [props.onDelete] show a Delete button when provided
 * @param {import("react").ReactNode} [props.reportControl] Phase E report
 *   control rendered for signed-in non-owners (parent decides eligibility)
 * @param {() => void} [props.onToggleHidden] staff Hide/Unhide control
 * @param {boolean} [props.moderating] hide/unhide request in flight
 * @param {boolean} [props.confirming] render the delete confirmation row
 * @param {() => void} [props.onConfirmDelete]
 * @param {() => void} [props.onCancelDelete]
 * @param {boolean} [props.deleting] delete request in flight
 */
export default function CommentItem({
  comment,
  children,
  onEdit,
  onDelete,
  reportControl,
  onToggleHidden,
  moderating = false,
  confirming = false,
  onConfirmDelete,
  onCancelDelete,
  deleting = false,
}) {
  const author =
    `${comment.author?.first_name ?? ""} ${comment.author?.last_name ?? ""}`.trim() ||
    "Unknown author";
  const created = formatDateTime(comment.created_at);
  const edited = Boolean(comment.updated_at && comment.updated_at !== comment.created_at);

  if (children) {
    return <li className="comment comment--editing">{children}</li>;
  }

  return (
    <li className={`comment${comment.is_hidden ? " comment--hidden" : ""}`}>
      <header className="comment__header">
        <span className="comment__author">{author}</span>
        {comment.is_hidden && <span className="badge badge--hidden comment__badge">Hidden</span>}
        <span className="comment__meta">
          {created && <time className="comment__date">{created}</time>}
          {edited && <span className="comment__edited">(edited)</span>}
        </span>
      </header>
      <p className="comment__content">{comment.content}</p>

      {confirming && (onConfirmDelete || onCancelDelete) ? (
        <div className="comment__actions" role="group" aria-label="Confirm deletion">
          <span className="comment__confirm-text">Delete this comment?</span>
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
        </div>
      ) : (
        (onEdit || onDelete || onToggleHidden || reportControl) && (
          <div className="comment__actions">
            {onToggleHidden && (
              <Button
                variant="ghost"
                className="btn--small"
                loading={moderating}
                onClick={onToggleHidden}
              >
                {comment.is_hidden ? "Unhide" : "Hide"}
              </Button>
            )}
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
          </div>
        )
      )}
    </li>
  );
}
