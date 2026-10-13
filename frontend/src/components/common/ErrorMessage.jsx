/**
 * Visible API/validation error message (`role="alert"`).
 * Pass an ApiError's `.message` — never raw payloads or stack traces.
 */
export default function ErrorMessage({ title = "Something went wrong", message, onRetry }) {
  return (
    <div className="alert alert--error" role="alert">
      <strong className="alert__title">{title}</strong>
      {message && <p className="alert__message">{message}</p>}
      {onRetry && (
        <button type="button" className="btn btn--secondary btn--small" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
