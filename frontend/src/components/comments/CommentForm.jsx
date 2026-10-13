import { useId, useState } from "react";
import { ApiError, fieldError } from "../../api/client";
import Button from "../common/Button";

/**
 * Create/edit comment form (docs/API.md — Comment API): a single non-blank
 * `content` field — the only writable field the serializer accepts.
 *
 * Mirrors ReviewForm's conventions: client validation matches the backend
 * (trimmed content required), server field errors (`errors.content`) render
 * inline, the general `ApiError.message` renders as an alert, submission is
 * guarded while pending and values are kept on failure (nothing is
 * submitted optimistically). On success the input clears so the next
 * comment starts clean — in edit mode the parent unmounts this form.
 *
 * @param {Object} props
 * @param {string} [props.initialContent] prefill for edit mode
 * @param {string} [props.submitLabel]
 * @param {(values: { content: string }) => Promise<unknown>} props.onSubmit
 *   called with validated values; rejections are rendered by this form
 * @param {() => void} [props.onCancel] renders a Cancel button when provided
 */
export default function CommentForm({
  initialContent = "",
  submitLabel = "Post comment",
  onSubmit,
  onCancel,
}) {
  const id = useId();
  const contentId = `${id}-content`;
  const contentErrorId = `${id}-content-error`;

  const [content, setContent] = useState(initialContent);
  const [contentError, setContentError] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    const nextContentError = content.trim() ? "" : "Write a comment.";
    setContentError(nextContentError);
    if (nextContentError) return;

    setSubmitting(true);
    setFormError("");
    try {
      await onSubmit({ content: content.trim() });
      setContent("");
    } catch (error) {
      const errors = error instanceof ApiError ? error.errors : undefined;
      setContentError(fieldError(errors, "content") || "");
      setFormError(error?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="comment-form" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label className="field__label" htmlFor={contentId}>
          Comment
        </label>
        <textarea
          id={contentId}
          className="field__input field__textarea"
          rows={3}
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

      <div className="comment-form__actions">
        <Button type="submit" className="btn--small" loading={submitting}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            className="btn--small"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
