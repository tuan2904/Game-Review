import { useId, useState } from "react";
import { reportComment, reportReview, REPORT_REASONS } from "../../api/reports";
import Button from "../common/Button";

/**
 * Inline "Report this review/comment" control (Phase E).
 *
 * Self-contained local state — the action never mutates the list it sits in:
 *  - collapsed → a single ghost "Report" button (rendered by the parent only
 *    for signed-in non-owners; staff moderate directly instead)
 *  - open → reason select + optional details input + submit/cancel, matching
 *    the two-step inline confirmation pattern used by delete actions
 *  - submitted → a quiet "Reported" marker so the control cannot be reused
 *    for the same content in this session; a 409 ("already reported") is
 *    treated the same way, while other failures render a recoverable
 *    inline error and keep the form open
 *
 * The payload carries `reason`/`details` only — the target id is the
 * endpoint (POST /reviews|comments/{id}/report/), never part of the body.
 *
 * @param {Object} props
 * @param {"review"|"comment"} props.targetType what is being reported
 * @param {number} props.targetId review or comment id
 */
export default function ReportControl({ targetType, targetId }) {
  const reasonId = useId();
  const detailsId = useId();

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REPORT_REASONS[0].value);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const submit = targetType === "review" ? reportReview : reportComment;
      await submit(targetId, { reason, details: details.trim() });
      setDone(true);
    } catch (caught) {
      if (caught?.status === 409) {
        // Already reported from another tab/session — same end state.
        setDone(true);
      } else {
        setError(caught?.message || "Couldn't submit the report.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancel() {
    setOpen(false);
    setError(null);
    setDetails("");
  }

  if (done) {
    return <span className="report-control__done">Reported</span>;
  }

  if (!open) {
    return (
      <Button variant="ghost" className="btn--small" onClick={() => setOpen(true)}>
        Report
      </Button>
    );
  }

  return (
    <form
      className="report-control"
      aria-label={`Report this ${targetType}`}
      onSubmit={handleSubmit}
    >
      <div className="report-control__field">
        <label className="field__label" htmlFor={reasonId}>
          Reason
        </label>
        <select
          id={reasonId}
          className="field__input"
          value={reason}
          disabled={submitting}
          onChange={(event) => setReason(event.target.value)}
        >
          {REPORT_REASONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="report-control__field report-control__field--details">
        <label className="field__label" htmlFor={detailsId}>
          Details (optional)
        </label>
        <input
          id={detailsId}
          className="field__input"
          type="text"
          maxLength={500}
          value={details}
          disabled={submitting}
          placeholder="Anything moderators should know"
          onChange={(event) => setDetails(event.target.value)}
        />
      </div>

      <div className="report-control__buttons">
        <Button type="submit" variant="secondary" className="btn--small" loading={submitting}>
          Submit report
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="btn--small"
          disabled={submitting}
          onClick={handleCancel}
        >
          Cancel
        </Button>
      </div>

      {error && (
        <p className="report-control__error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
