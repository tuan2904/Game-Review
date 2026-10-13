import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useFavorites } from "../../contexts/FavoritesContext";
import Button from "../common/Button";

/**
 * Add/remove favorite for one game, shared by the listing, the detail page
 * and the favorites page so all three stay consistent through
 * `FavoritesContext`.
 *
 * Behaviour (docs/API.md — Favorite API):
 *  - signed out → a login link preserving `location.state.from` (existing
 *    convention) — the backend requires auth for both operations
 *  - signed in → "Add to favorites" (`POST /games/{slug}/favorite/`) or
 *    "Remove from favorites" (`DELETE`, idempotent), reflecting only
 *    server-confirmed state (nothing is optimistic)
 *  - the button is disabled while its own mutation is pending (the context
 *    also drops duplicate requests per slug), failures render an inline
 *    recoverable alert and leave the state untouched, a `409` on add means
 *    the game was already favorited and is shown as such
 *
 * @param {Object} props
 * @param {string} props.gameSlug
 * @param {string} [props.className] extra classes (e.g. `btn--small`)
 * @param {(favorited: boolean) => void} [props.onChanged] called after a
 *   confirmed mutation (e.g. the favorites page refreshes its list)
 */
export default function FavoriteToggle({ gameSlug, className = "", onChanged }) {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { isFavorite, isPending, add, remove } = useFavorites();
  const [error, setError] = useState("");

  const favorited = isFavorite(gameSlug);
  const pending = isPending(gameSlug);

  if (!isAuthenticated) {
    return (
      <Link
        className={`btn btn--ghost ${className}`.trim()}
        to="/login"
        state={{ from: location.pathname }}
      >
        Log in to favorite
      </Link>
    );
  }

  async function handleToggle() {
    setError("");
    try {
      if (favorited) {
        await remove(gameSlug);
      } else {
        await add(gameSlug);
      }
      onChanged?.(!favorited);
    } catch (caught) {
      setError(caught?.message || "Couldn't update your favorites.");
    }
  }

  return (
    <div className="favorite-toggle">
      <Button variant="ghost" className={className} loading={pending} onClick={handleToggle}>
        {favorited ? "Remove from favorites" : "Add to favorites"}
      </Button>
      {error && (
        <p className="field__error favorite-toggle__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
