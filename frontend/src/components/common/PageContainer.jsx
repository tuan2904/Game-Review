/** Standard page wrapper: consistent max width and spacing. */
export default function PageContainer({ title, subtitle, children, actions }) {
  return (
    <div className="page">
      {(title || actions) && (
        <header className="page__header">
          <div>
            {title && <h1 className="page__title">{title}</h1>}
            {subtitle && <p className="page__subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="page__actions">{actions}</div>}
        </header>
      )}
      {children}
    </div>
  );
}
