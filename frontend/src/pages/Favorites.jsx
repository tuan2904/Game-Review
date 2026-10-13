import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listMyFavorites } from "../api/favorites";
import Button from "../components/common/Button";
import EmptyState from "../components/common/EmptyState";
import ErrorMessage from "../components/common/ErrorMessage";
import Loading from "../components/common/Loading";
import PageContainer from "../components/common/PageContainer";
import Pagination from "../components/common/Pagination";
import FavoriteToggle from "../components/favorites/FavoriteToggle";
import GameCard from "../components/games/GameCard";

const PAGE_SIZE = 12;

/**
 * The signed-in user's favorites — `GET /api/v1/me/favorites/`
 * (docs/API.md — Favorite API): server-paginated, newest favorite first,
 * only the current user's rows (the query scope is the token, client-supplied
 * `user` params are ignored).
 *
 * Fetching uses the shared keyed-result + AbortController pattern: effects
 * only set state from async callbacks (lint-safe), `signal.aborted` drops
 * stale responses, loading/error are derived from the result key. States:
 * loader → retryable error → 404 past the last page (the backend returns
 * 404 for an out-of-range page) → empty (with a link to the catalog) →
 * the card grid + pagination.
 *
 * Rows reuse `GameCard` with the shared `FavoriteToggle`: removing a
 * favorite confirms with the server first (idempotent `DELETE`), then
 * refreshes this list and the shared favorite set — so `/games`,
 * `/games/:slug` and this page stay consistent. The favorite payload omits
 * `developer`/`description`; the card renders only the fields it receives.
 */
export default function Favorites() {
  const [reloadKey, setReloadKey] = useState(0);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ key: null, data: null, error: null });

  const key = `${page}|${reloadKey}`;

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    listMyFavorites({ page, page_size: PAGE_SIZE }, { signal })
      .then((data) => {
        if (signal.aborted) return;
        setResult({ key, data, error: null });
      })
      .catch((caught) => {
        if (signal.aborted) return;
        setResult({ key, data: null, error: caught });
      });
    return () => controller.abort();
  }, [page, key]);

  const loading = result.key !== key;
  const data = loading ? null : result.data;
  const error = loading ? null : result.error;

  const refresh = () => setReloadKey((current) => current + 1);

  const pageOutOfRange = error?.status === 404 && page > 1;
  const pagination = data?.pagination;
  const total = pagination?.total ?? 0;

  let content;
  if (loading) {
    content = <Loading label="Loading favorites…" />;
  } else if (pageOutOfRange) {
    content = (
      <EmptyState
        title="Page not found"
        description="This page is beyond the last page of favorites."
        action={<Button onClick={() => setPage(1)}>Back to first page</Button>}
      />
    );
  } else if (error) {
    content = (
      <ErrorMessage title="Couldn't load favorites" message={error.message} onRetry={refresh} />
    );
  } else if (data && data.items.length === 0) {
    content = (
      <EmptyState
        title="No favorites yet"
        description="Games you save will appear here."
        action={
          <Link to="/games" className="btn btn--primary">
            Browse games
          </Link>
        }
      />
    );
  } else if (data) {
    content = (
      <>
        <p className="muted games-count">
          {total} {total === 1 ? "favorite" : "favorites"}
        </p>
        <div className="games-grid">
          {data.items.map((favorite) => (
            <GameCard
              key={favorite.id}
              game={favorite.game}
              action={
                <FavoriteToggle
                  gameSlug={favorite.game.slug}
                  className="btn--small"
                  onChanged={refresh}
                />
              }
            />
          ))}
        </div>
        <Pagination
          page={pagination.page}
          pageCount={pagination.total_pages}
          onPageChange={setPage}
        />
      </>
    );
  }

  return (
    <PageContainer title="Favorites" subtitle="Games you've saved to your profile.">
      {content}
    </PageContainer>
  );
}
