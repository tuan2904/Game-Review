import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createGame, getGame, listCategories, updateGame } from "../../api/games";
import EmptyState from "../../components/common/EmptyState";
import ErrorMessage from "../../components/common/ErrorMessage";
import Loading from "../../components/common/Loading";
import PageContainer from "../../components/common/PageContainer";
import GameForm from "../../components/admin/GameForm";

/**
 * Admin create/edit game page.
 *
 * - `/admin/games/new` — empty form (create)
 * - `/admin/games/:slug/edit` — prefilled form fetched via `getGame(slug)`;
 *   mutations go to `PATCH /games/{id}/` with the game's numeric id
 *
 * Categories load once for the `category_id` select (`page_size=100`, the
 * backend max). If they fail, the form is replaced by a retryable error —
 * a category is required by the serializer, so the form would be unusable.
 * Successful saves navigate back to the admin list, which refetches fresh
 * data on mount.
 */
export default function AdminGameForm() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(slug);

  const [gameReloadKey, setGameReloadKey] = useState(0);
  const [gameResult, setGameResult] = useState({ key: null, data: null, error: null });
  const [categoriesReloadKey, setCategoriesReloadKey] = useState(0);
  const [categoriesResult, setCategoriesResult] = useState({ key: null, data: null, error: null });

  const gameKey = `${slug ?? "new"}|${gameReloadKey}`;
  const categoriesKey = `${categoriesReloadKey}`;

  useEffect(() => {
    if (!isEdit) return undefined;
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
  }, [isEdit, slug, gameKey]);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    listCategories({ page_size: 100 }, { signal })
      .then((data) => {
        if (signal.aborted) return;
        setCategoriesResult({ key: categoriesKey, data, error: null });
      })
      .catch((caught) => {
        if (signal.aborted) return;
        setCategoriesResult({ key: categoriesKey, data: null, error: caught });
      });
    return () => controller.abort();
  }, [categoriesKey]);

  const gameLoading = isEdit && gameResult.key !== gameKey;
  const game = gameLoading ? null : gameResult.data;
  const gameError = gameLoading ? null : gameResult.error;

  const categoriesLoading = categoriesResult.key !== categoriesKey;
  const categories = categoriesLoading ? null : categoriesResult.data;
  const categoriesError = categoriesLoading ? null : categoriesResult.error;

  async function handleSubmit(payload) {
    if (isEdit) {
      await updateGame(game.id, payload);
    } else {
      await createGame(payload);
    }
    navigate("/admin/games");
  }

  if (gameLoading) {
    return (
      <PageContainer title={isEdit ? "Edit game" : "New game"}>
        <Loading label="Loading game…" />
      </PageContainer>
    );
  }

  if (gameError?.status === 404) {
    return (
      <PageContainer title="Edit game">
        <EmptyState
          title="Game not found"
          description="This game doesn't exist or is no longer available."
          action={
            <Link to="/admin/games" className="btn btn--primary">
              Back to games
            </Link>
          }
        />
      </PageContainer>
    );
  }

  if (gameError) {
    return (
      <PageContainer title="Edit game">
        <ErrorMessage
          title="Couldn't load this game"
          message={gameError.message}
          onRetry={() => setGameReloadKey((current) => current + 1)}
        />
      </PageContainer>
    );
  }

  if (categoriesLoading) {
    return (
      <PageContainer title={isEdit ? "Edit game" : "New game"}>
        <Loading label="Loading categories…" />
      </PageContainer>
    );
  }

  if (categoriesError) {
    return (
      <PageContainer title={isEdit ? "Edit game" : "New game"}>
        <ErrorMessage
          title="Couldn't load categories"
          message={categoriesError.message}
          onRetry={() => setCategoriesReloadKey((current) => current + 1)}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={isEdit ? "Edit game" : "New game"}
      subtitle={isEdit ? game?.name : "Create a game. The slug is generated when left blank."}
    >
      <GameForm
        game={game ?? undefined}
        categories={categories?.items ?? []}
        submitLabel={isEdit ? "Save changes" : "Create game"}
        onSubmit={handleSubmit}
        onCancel={() => navigate("/admin/games")}
      />
    </PageContainer>
  );
}
