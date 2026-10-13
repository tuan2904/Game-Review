import { Link } from "react-router-dom";
import { formatDate } from "../../utils/format";

/**
 * Game card for the listing grid. Fields come straight from the verified
 * Game payload (docs/API.md) — nothing is invented when a value is missing:
 * absent cover image renders a neutral placeholder block, empty values fall
 * back to explicit "unknown" text.
 *
 * The title link is stretched over the card (see `.game-card__link::after`)
 * so the whole card is clickable while keeping a single accessible link;
 * an optional `action` slot (e.g. the favorite toggle) renders above the
 * stretched link and stays independently clickable.
 *
 * @param {Object} props
 * @param {import("../../types").Game} props.game
 * @param {import("react").ReactNode} [props.action] interactive footer content
 */
export default function GameCard({ game, action }) {
  const released = formatDate(game.release_date);
  /* The favorites payload (docs/API.md — Favorite API) omits these fields
     entirely; absent fields render nothing instead of inventing "unknown"
     text. Present-but-empty values keep the explicit fallbacks. */
  const developerKnown = game.developer !== undefined;
  const descriptionKnown = game.description !== undefined;
  const description = game.description?.trim();

  return (
    <article className="game-card">
      {game.cover_image ? (
        <img
          className="game-card__cover"
          src={game.cover_image}
          alt=""
          loading="lazy"
          width="640"
          height="360"
        />
      ) : (
        <div className="game-card__cover game-card__cover--placeholder" aria-hidden="true" />
      )}
      <div className="game-card__body">
        <div className="game-card__badges">
          {game.category && <span className="badge">{game.category.name}</span>}
          {game.status === "INACTIVE" && <span className="badge badge--inactive">Inactive</span>}
        </div>
        <h3 className="game-card__title">
          <Link to={`/games/${game.slug}`} className="game-card__link">
            {game.name}
          </Link>
        </h3>
        {(developerKnown || released) && (
          <p className="game-card__meta">
            {developerKnown && (game.developer || "Unknown developer")}
            {developerKnown && released && " · "}
            {released}
          </p>
        )}
        {descriptionKnown && (
          <p className="game-card__excerpt">
            {description
              ? `${description.slice(0, 120)}${description.length > 120 ? "…" : ""}`
              : "No description provided."}
          </p>
        )}
        {action && <div className="game-card__action">{action}</div>}
      </div>
    </article>
  );
}
