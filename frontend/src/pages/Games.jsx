import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import * as gamesApi from "../api/games";
import Button from "../components/common/Button";
import EmptyState from "../components/common/EmptyState";
import ErrorMessage from "../components/common/ErrorMessage";
import Input from "../components/common/Input";
import Loading from "../components/common/Loading";
import PageContainer from "../components/common/PageContainer";
import Pagination from "../components/common/Pagination";
import FavoriteToggle from "../components/favorites/FavoriteToggle";
import GameCard from "../components/games/GameCard";

/**
 * Game listing — real data through the shared API client.
 *
 * URL is the source of truth for `search`, `category`, `ordering` and
 * `page` (same names the backend accepts), so refresh/back/share preserve
 * the listing state. Search input is debounced into the URL; every fetch
 * gets an AbortController and drops stale responses via `signal.aborted`.
 *
 * Loading/error are derived by comparing the params key of the last result
 * with the current one — effects only ever set state from async callbacks.
 *
 * Supported backend params: search, category (slug), ordering allowlist,
 * page, page_size (docs/API.md). `status` is intentionally not exposed —
 * it is only meaningful for staff and this list is public.
 */

const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 300;
const DEFAULT_ORDERING = "-created_at";

const ORDER_OPTIONS = [
  { value: "-created_at", label: "Recently added" },
  { value: "created_at", label: "Oldest added" },
  { value: "name", label: "Name A–Z" },
  { value: "-name", label: "Name Z–A" },
  { value: "-release_date", label: "Newest release" },
  { value: "release_date", label: "Oldest release" },
];

export default function Games() {
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get("search") ?? "";
  const category = searchParams.get("category") ?? "";
  const ordering = searchParams.get("ordering") || DEFAULT_ORDERING;
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const [queryInput, setQueryInput] = useState(search);
  const [reloadKey, setReloadKey] = useState(0);
  const [listResult, setListResult] = useState({ key: null, data: null, error: null });

  const [categoriesReloadKey, setCategoriesReloadKey] = useState(0);
  const [categoriesResult, setCategoriesResult] = useState({
    key: null,
    items: [],
    error: null,
  });

  const listKey = `${search}|${category}|${ordering}|${page}|${reloadKey}`;
  const categoriesKey = String(categoriesReloadKey);

  const updateParams = useCallback(
    (updates, { replace = false } = {}) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          for (const [key, value] of Object.entries(updates)) {
            if (value === null || value === undefined || value === "") {
              next.delete(key);
            } else {
              next.set(key, String(value));
            }
          }
          return next;
        },
        { replace },
      );
    },
    [setSearchParams],
  );

  /* Keep the input in sync when the URL changes externally (back/forward,
     clear filters). Adjusting state during render avoids an extra effect
     pass — React's documented "adjusting state when props change" pattern. */
  const [prevSearch, setPrevSearch] = useState(search);
  if (search !== prevSearch) {
    setPrevSearch(search);
    setQueryInput(search);
  }

  /* Debounce typing into the URL; a filter change resets paging. */
  useEffect(() => {
    const trimmed = queryInput.trim();
    if (trimmed === search) return undefined;
    const timer = setTimeout(() => {
      updateParams({ search: trimmed || null, page: null }, { replace: true });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [queryInput, search, updateParams]);

  /* Listing fetch — cancelled + ignored when params change mid-flight. */
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    gamesApi
      .listGames({ search, category, ordering, page, page_size: PAGE_SIZE }, { signal })
      .then((data) => {
        if (signal.aborted) return;
        setListResult({ key: listKey, data, error: null });
      })
      .catch((caught) => {
        if (signal.aborted) return;
        setListResult({ key: listKey, data: null, error: caught });
      });
    return () => controller.abort();
  }, [listKey, search, category, ordering, page]);

  /* Category filter options (paginated endpoint → request the max page). */
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    gamesApi
      .listCategories({ page_size: 100 }, { signal })
      .then((data) => {
        if (signal.aborted) return;
        setCategoriesResult({ key: categoriesKey, items: data.items, error: null });
      })
      .catch((caught) => {
        if (signal.aborted) return;
        setCategoriesResult({ key: categoriesKey, items: [], error: caught });
      });
    return () => controller.abort();
  }, [categoriesKey]);

  const clearFilters = () => updateParams({ search: null, category: null, page: null });

  const loading = listResult.key !== listKey;
  const data = loading ? null : listResult.data;
  const error = loading ? null : listResult.error;

  const categoriesLoading = categoriesResult.key !== categoriesKey;
  const categories = categoriesLoading ? [] : categoriesResult.items;
  const categoriesError = categoriesLoading ? null : categoriesResult.error;

  const pageOutOfRange = error?.status === 404 && page > 1;
  const pagination = data?.pagination;
  const total = pagination?.total ?? 0;
  const hasFilters = Boolean(search || category);

  let content;
  if (loading) {
    content = <Loading label="Loading games…" />;
  } else if (pageOutOfRange) {
    content = (
      <EmptyState
        title="Page not found"
        description="This page is beyond the last page of results."
        action={<Button onClick={() => updateParams({ page: null })}>Back to first page</Button>}
      />
    );
  } else if (error) {
    content = (
      <ErrorMessage
        title="Couldn't load games"
        message={error.message}
        onRetry={() => setReloadKey((key) => key + 1)}
      />
    );
  } else if (data && data.items.length === 0) {
    content = hasFilters ? (
      <EmptyState
        title="No games match your filters"
        description="Try a different search term or clear the filters to see the full catalog."
        action={
          <Button variant="secondary" onClick={clearFilters}>
            Clear filters
          </Button>
        }
      />
    ) : (
      <EmptyState title="No games yet" description="The catalog is empty — check back later." />
    );
  } else if (data) {
    content = (
      <>
        <p className="muted games-count">
          {total} {total === 1 ? "game" : "games"}
        </p>
        <div className="games-grid">
          {data.items.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              action={<FavoriteToggle gameSlug={game.slug} className="btn--small" />}
            />
          ))}
        </div>
        <Pagination
          page={pagination.page}
          pageCount={pagination.total_pages}
          onPageChange={(nextPage) => updateParams({ page: nextPage })}
        />
      </>
    );
  }

  return (
    <PageContainer
      title="Games"
      subtitle="Browse the catalog, search by name or developer, and filter by category."
    >
      <div className="games-toolbar">
        <Input
          className="games-toolbar__search"
          label="Search games"
          type="search"
          placeholder="Name, developer, publisher…"
          value={queryInput}
          onChange={(event) => setQueryInput(event.target.value)}
        />
        <div className="field">
          <label className="field__label" htmlFor="game-category">
            Category
          </label>
          <select
            id="game-category"
            className="field__input"
            value={category}
            disabled={categoriesLoading}
            onChange={(event) => updateParams({ category: event.target.value, page: null })}
          >
            <option value="">All categories</option>
            {categories.map((item) => (
              <option key={item.id} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="game-ordering">
            Sort by
          </label>
          <select
            id="game-ordering"
            className="field__input"
            value={ordering}
            onChange={(event) => updateParams({ ordering: event.target.value, page: null })}
          >
            {ORDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {categoriesError && (
        <ErrorMessage
          title="Couldn't load categories"
          message={categoriesError.message}
          onRetry={() => setCategoriesReloadKey((key) => key + 1)}
        />
      )}

      {content}
    </PageContainer>
  );
}
