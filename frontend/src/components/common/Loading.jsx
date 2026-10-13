/** Accessible loading indicator with a status label. */
export default function Loading({ label = "Loading…" }) {
  return (
    <div className="loading" role="status">
      <span className="spinner" aria-hidden="true" />
      <span className="loading__label">{label}</span>
    </div>
  );
}
