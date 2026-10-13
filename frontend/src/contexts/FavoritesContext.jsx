import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { addFavorite, listMyFavorites, removeFavorite } from "../api/favorites";
import { useAuth } from "./AuthContext";

/**
 * Shared favorite-status state for the signed-in user.
 *
 * The backend exposes **no** favorite-status field on the public game
 * serializer and no single-game status endpoint — the only supported source
 * is `GET /me/favorites/`. This provider loads that list once per session
 * (all pages, `page_size` max 100) and keeps the resulting slug set in one
 * place, so `/games`, `/games/:slug` and `/favorites` stay consistent
 * without a global state library and without a per-card request waterfall.
 *
 * Design notes:
 *  - Load failures are silent: buttons stay usable and the server's `409`
 *    on add reconciles any wrong "not favorited" state (the delete is
 *    idempotent). Only mutation errors are surfaced, by the caller.
 *  - Mutations resolve only after the server confirms (no optimistic UI).
 *    Ops issued while the initial load is in flight are replayed on top of
 *    the loaded set so a late response can't clobber them.
 *  - A synchronous ref guards duplicate requests per slug (double click,
 *    or two toggles for the same game), mirrored into state for rendering.
 *  - This is a UX layer only — the backend enforces auth/ownership on every
 *    favorite call.
 *
 * @returns {{ isFavorite: (slug: string) => boolean,
 *             isPending: (slug: string) => boolean,
 *             add: (slug: string) => Promise<void>,
 *             remove: (slug: string) => Promise<void> }}
 */
const FavoritesContext = createContext(null);

const SET_PAGE_SIZE = 100; // backend max_page_size

export function FavoritesProvider({ children }) {
  const { isAuthenticated } = useAuth();

  const [slugs, setSlugs] = useState(() => new Set());
  const [pending, setPending] = useState(() => new Set());

  /** Synchronous duplicate-request guard (state alone updates too late). */
  const pendingRef = useRef(new Set());
  /** Mutations since the current load started — replayed over its result. */
  const opsRef = useRef([]);

  /* Load the full set whenever a session becomes active. */
  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const controller = new AbortController();
    const { signal } = controller;
    opsRef.current = [];

    (async () => {
      const loaded = new Set();
      try {
        let page = 1;
        let totalPages = 1;
        do {
          const data = await listMyFavorites({ page, page_size: SET_PAGE_SIZE }, { signal });
          for (const item of data.items) loaded.add(item.game.slug);
          page = data.pagination.page + 1;
          totalPages = data.pagination.total_pages;
        } while (page <= totalPages);
      } catch {
        // Silent by design: the toggle reconciles through the server's 409.
        return;
      }
      if (signal.aborted) return;
      setSlugs(() => {
        const next = new Set(loaded);
        for (const op of opsRef.current) {
          if (op.type === "add") next.add(op.slug);
          else next.delete(op.slug);
        }
        return next;
      });
    })();

    return () => controller.abort();
  }, [isAuthenticated]);

  const runMutation = useCallback(async (slug, request, type) => {
    if (pendingRef.current.has(slug)) return;
    pendingRef.current.add(slug);
    setPending(new Set(pendingRef.current));
    try {
      await request(slug);
    } catch (error) {
      /* Duplicate add → the game is already favorited: reconcile as success. */
      if (!(type === "add" && error?.status === 409)) throw error;
    } finally {
      pendingRef.current.delete(slug);
      setPending(new Set(pendingRef.current));
    }
    opsRef.current.push({ type, slug });
    setSlugs((current) => {
      const next = new Set(current);
      if (type === "add") next.add(slug);
      else next.delete(slug);
      return next;
    });
  }, []);

  const add = useCallback((slug) => runMutation(slug, addFavorite, "add"), [runMutation]);
  const remove = useCallback((slug) => runMutation(slug, removeFavorite, "remove"), [runMutation]);

  const value = useMemo(
    () => ({
      isFavorite: (slug) => slugs.has(slug),
      isPending: (slug) => pending.has(slug),
      add,
      remove,
    }),
    [slugs, pending, add, remove],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error("useFavorites must be used within a FavoritesProvider");
  }
  return context;
}
