/**
 * Temporary demo fix: cover images bundled in `public/covers/`, keyed by game
 * slug. Seeded games point at a placeholder CDN that never resolves, so these
 * local files are used first. Remove once real image hosting is in place.
 */
const LOCAL_COVERS = new Set([
  "elden-ring",
  "hollow-knight",
  "stardew-valley",
  "cyberpunk-2077",
  "hades",
  "portal-2",
  "celeste",
  "factorio",
  "disco-elysium",
]);

/** @returns {string} cover URL for a game, or "" when none is available */
export function getCoverImage(game) {
  if (game?.slug && LOCAL_COVERS.has(game.slug)) return `/covers/${game.slug}.jpg`;
  return game?.cover_image || "";
}
