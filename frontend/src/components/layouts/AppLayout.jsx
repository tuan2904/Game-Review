import { useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

/** Shared application shell: responsive navigation + <main> outlet. */
export default function AppLayout() {
  const { isAuthenticated, user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const closeMenu = () => setMenuOpen(false);

  async function handleLogout() {
    closeMenu();
    await logout();
    navigate("/", { replace: true });
  }

  const authLinks = isAuthenticated ? (
    <>
      {user?.is_staff === true && (
        <NavLink to="/admin" className={navClass} onClick={closeMenu}>
          Admin
        </NavLink>
      )}
      <NavLink to="/profile" className={navClass} onClick={closeMenu}>
        Profile
      </NavLink>
      <NavLink to="/favorites" className={navClass} onClick={closeMenu}>
        Favorites
      </NavLink>
      <span className="nav__user" title={user?.email}>
        {user ? `${user.first_name} ${user.last_name}`.trim() || user.email : ""}
      </span>
      <button type="button" className="btn btn--secondary btn--small" onClick={handleLogout}>
        Log out
      </button>
    </>
  ) : (
    <>
      <NavLink to="/login" className={navClass} onClick={closeMenu}>
        Log in
      </NavLink>
      <Link
        to="/register"
        className="btn btn--primary btn--small"
        onClick={closeMenu}
        state={{ from: location.pathname }}
      >
        Sign up
      </Link>
    </>
  );

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__inner">
          <Link to="/" className="brand" onClick={closeMenu}>
            <span className="brand__mark" aria-hidden="true">
              ★
            </span>
            GameReview
          </Link>

          <button
            type="button"
            className="nav-toggle"
            aria-expanded={menuOpen}
            aria-controls="primary-nav"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="nav-toggle__bar" aria-hidden="true" />
            <span className="nav-toggle__bar" aria-hidden="true" />
            <span className="nav-toggle__bar" aria-hidden="true" />
          </button>

          <nav
            id="primary-nav"
            className={`nav ${menuOpen ? "nav--open" : ""}`}
            aria-label="Primary"
          >
            <NavLink to="/" className={navClass} end onClick={closeMenu}>
              Home
            </NavLink>
            <NavLink to="/games" className={navClass} onClick={closeMenu}>
              Games
            </NavLink>
            <div className="nav__auth">{authLinks}</div>
          </nav>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <footer className="app-footer">
        <p>GameReview</p>
      </footer>
    </div>
  );
}

function navClass({ isActive }) {
  return isActive ? "nav__link nav__link--active" : "nav__link";
}
