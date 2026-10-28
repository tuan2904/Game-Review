import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getGame } from "../api/games";
import EmptyState from "../components/common/EmptyState";
import ErrorMessage from "../components/common/ErrorMessage";
import Loading from "../components/common/Loading";
import PageContainer from "../components/common/PageContainer";
import FavoriteToggle from "../components/favorites/FavoriteToggle";
import GameReviews from "../components/reviews/GameReviews";
import { formatDate, formatDateTime } from "../utils/format";
import { getCoverImage } from "../utils/covers";

/**
 * Game detail — `GET /api/v1/games/{slug}/` plus its reviews section
 * (Phase 08: display and create/edit/delete workflows — see GameReviews).
 *
 * Handles: loading, 404 (unknown slug / invisible game), other API errors
 * with retry. Loading/error are derived from the params key of the last
 * result (effects only set state from async callbacks). The reviews section
 * owns its own fetch and states: a reviews failure never hides the game.
 * Cover image renders only when the API provides one.
 */
export default function GameDetail() {
  const { slug } = useParams();

  const [gameReloadKey, setGameReloadKey] = useState(0);
  const [gameResult, setGameResult] = useState({ key: null, data: null, error: null });

  const gameKey = `${slug}|${gameReloadKey}`;

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    getGame(slug, { signal })
      .then((data) => {
        if (signal.aborted) return;
        setGameResult({ key: gameKey, data, error: null });
      })
      .catch((caught) => {
        if (signal.aborted) return;
        setGameResult({ key: gameKey, data: null, error: caught });
      });
    return () => controller.abort();
  }, [slug, gameKey]);

  const gameLoading = gameResult.key !== gameKey;
  const game = gameLoading ? null : gameResult.data;
  const gameError = gameLoading ? null : gameResult.error;

  if (gameLoading) {
    return (
      <PageContainer>
        <Loading label="Loading game…" />
      </PageContainer>
    );
  }

  if (gameError?.status === 404) {
    return (
      <PageContainer>
        <EmptyState
          title="Game not found"
          description="This game doesn't exist or is no longer available."
          action={
            <Link to="/games" className="btn btn--primary">
              Back to games
            </Link>
          }
        />
      </PageContainer>
    );
  }

  if (gameError) {
    return (
      <PageContainer>
        <ErrorMessage
          title="Couldn't load this game"
          message={gameError.message}
          onRetry={() => setGameReloadKey((key) => key + 1)}
        />
      </PageContainer>
    );
  }

  if (!game) return null;

  const released = formatDate(game.release_date);
  const added = formatDateTime(game.created_at);
  const description = game.description?.trim();

  return (
    <PageContainer>
      <Link to="/games" className="btn btn--ghost game-detail__back">
        Back to games
      </Link>

      <article className="game-detail">
        <header className="game-detail__header">
          <div className="game-detail__badges">
            {game.category && <span className="badge">{game.category.name}</span>}
            {game.status === "INACTIVE" && <span className="badge badge--inactive">Inactive</span>}
          </div>
          <h1 className="game-detail__title">{game.name}</h1>
          <div className="game-detail__favorite">
            <FavoriteToggle gameSlug={game.slug} />
          </div>
          {added && <p className="muted">Added {added}</p>}
        </header>

        {getCoverImage(game) ? (
          <img
            className="game-detail__cover"
            src={getCoverImage(game)}
            alt={`${game.name} cover`}
            width="960"
            height="540"
          />
        ) : null}

        <dl className="game-detail__facts">
          <div className="game-detail__fact">
            <dt>Developer</dt>
            <dd>{game.developer || "Unknown developer"}</dd>
          </div>
          <div className="game-detail__fact">
            <dt>Publisher</dt>
            <dd>{game.publisher || "Unknown publisher"}</dd>
          </div>
          <div className="game-detail__fact">
            <dt>Release date</dt>
            <dd>{released || "Unknown"}</dd>
          </div>
          <div className="game-detail__fact">
            <dt>Category</dt>
            <dd>{game.category ? game.category.name : "Uncategorized"}</dd>
          </div>
          {/* Phase D aggregates — present on every games-endpoint payload. */}
          {game.review_count !== undefined && (
            <div className="game-detail__fact">
              <dt>Rating</dt>
              <dd>
                {game.review_count > 0
                  ? `${game.average_rating != null ? `★ ${Number(game.average_rating).toFixed(1)} · ` : ""}${
                      game.review_count
                    } ${game.review_count === 1 ? "review" : "reviews"}`
                  : "No reviews yet"}
              </dd>
            </div>
          )}
        </dl>

        <section className="game-detail__description" aria-labelledby="about-heading">
          <h2 id="about-heading">About this game</h2>
          <p>{description || "No description provided."}</p>
        </section>

        <section className="game-detail__reviews" aria-labelledby="reviews-heading">
          <h2 id="reviews-heading">Reviews</h2>
          {/* Keyed remount resets pagination/edit/confirm state per game. */}
          <GameReviews key={slug} slug={slug} />
        </section>
      </article>
    </PageContainer>
  );
}
