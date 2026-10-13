import { useId, useState } from "react";
import { ApiError, fieldError } from "../../api/client";
import Button from "../common/Button";

/**
 * Create/edit review form: rating (1–5 radio group) + content (textarea).
 *
 * Client-side validation mirrors the backend (rating required, content
 * non-blank) and server field errors (`ApiError.errors.rating` /
 * `ApiError.errors.content`) are rendered inline; the general
 * `ApiError.message` renders as a form-level alert. Submission is guarded
 * while pending (no duplicate requests) and the server stays authoritative:
 * on failure nothing is submitted optimistically and the form keeps its
 * values so the user can correct and retry.
 *
 * @param {Object} props
 * @param {number|null} [props.initialRating] prefill for edit mode
 * @param {string} [props.initialContent] prefill for edit mode
 * @param {string} [props.submitLabel]
 * @param {(values: { rating: number, content: string }) => Promise<unknown>} props.onSubmit
 *   called with validated values; rejections are rendered by this form
 * @param {() => void} [props.onCancel] renders a Cancel button when provided
 */
export default function ReviewForm({
  initialRating = null,
  initialContent = "",
  submitLabel = "Post review",
  onSubmit,
  onCancel,
}) {
  const id = useId();
  const ratingName = `${id}-rating`;
  const contentId = `${id}-content`;
  const ratingErrorId = `${id}-rating-error`;
  const contentErrorId = `${id}-content-error`;

  const [rating, setRating] = useState(initialRating);
  const [content, setContent] = useState(initialContent);
  const [ratingError, setRatingError] = useState("");
  const [contentError, setContentError] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    const nextRatingError = rating === null ? "Choose a rating from 1 to 5." : "";
    const nextContentError = content.trim() ? "" : "Write a few words about the game.";
    setRatingError(nextRatingError);
    setContentError(nextContentError);
    if (nextRatingError || nextContentError) return;

    setSubmitting(true);
    setFormError("");
    try {
      await onSubmit({ rating, content: content.trim() });
    } catch (error) {
      const errors = error instanceof ApiError ? error.errors : undefined;
      setRatingError(fieldError(errors, "rating") || "");
      setContentError(fieldError(errors, "content") || "");
      setFormError(error?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="review-form" onSubmit={handleSubmit} noValidate>
      <fieldset
        className="field rating-field"
        aria-describedby={ratingError ? ratingErrorId : undefined}
      >
        <legend className="field__label">Rating</legend>
        <div className="rating-options">
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value} className="rating-option">
              <input
                type="radio"
                name={ratingName}
                value={value}
                checked={rating === value}
                onChange={() => {
                  setRating(value);
                  setRatingError("");
                }}
                aria-label={`${value} star${value > 1 ? "s" : ""}`}
              />
              <span className="rating-option__star" aria-hidden="true">
                ★
              </span>
              <span aria-hidden="true">{value}</span>
            </label>
          ))}
        </div>
        {ratingError && (
          <p className="field__error" id={ratingErrorId} role="alert">
            {ratingError}
          </p>
        )}
      </fieldset>

      <div className="field">
        <label className="field__label" htmlFor={contentId}>
          Your review
        </label>
        <textarea
          id={contentId}
          className="field__input field__textarea"
          rows={4}
          value={content}
          onChange={(event) => {
            setContent(event.target.value);
            setContentError("");
          }}
          aria-invalid={contentError ? true : undefined}
          aria-describedby={contentError ? contentErrorId : undefined}
        />
        {contentError && (
          <p className="field__error" id={contentErrorId} role="alert">
            {contentError}
          </p>
        )}
      </div>

      {formError && (
        <div className="alert alert--error" role="alert">
          <p className="alert__message">{formError}</p>
        </div>
      )}

      <div className="review-form__actions">
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
