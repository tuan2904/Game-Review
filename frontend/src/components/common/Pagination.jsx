/**
 * Reusable pagination controls (used by list pages from Phase 07 on).
 *
 * Renders nothing when there is a single page, so callers can pass API
 * pagination numbers directly without extra conditionals.
 */
export default function Pagination({ page, pageCount, onPageChange }) {
  if (!pageCount || pageCount <= 1) return null;

  const current = Math.min(Math.max(page, 1), pageCount);
  const hasPrevious = current > 1;
  const hasNext = current < pageCount;

  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        className="btn btn--ghost"
        onClick={() => onPageChange(current - 1)}
        disabled={!hasPrevious}
      >
        Previous
      </button>
      <span className="pagination__status" aria-current="page">
        Page {current} of {pageCount}
      </span>
      <button
        type="button"
        className="btn btn--ghost"
        onClick={() => onPageChange(current + 1)}
        disabled={!hasNext}
      >
        Next
      </button>
    </nav>
  );
}
