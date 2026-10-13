/** Empty-list state used by future list pages (reviews, favorites, …). */
export default function EmptyState({ title = "Nothing here yet", description, action }) {
  return (
    <div className="empty-state">
      <p className="empty-state__title">{title}</p>
      {description && <p className="empty-state__description">{description}</p>}
      {action}
    </div>
  );
}
