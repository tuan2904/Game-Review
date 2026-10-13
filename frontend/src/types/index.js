/**
 * Shared API payload shapes — verified against docs/API.md and the backend
 * serializers. The project uses JavaScript (no TypeScript conversion in
 * this phase); JSDoc typedefs give editors real type hints without a
 * migration.
 *
 * IMPORTANT: these mirror the *actual* API. Do not invent fields
 * (e.g. `average_rating`, `review_count` do not exist in the backend).
 */

/**
 * @typedef {Object} User
 * @property {number} id
 * @property {string} email
 * @property {string} first_name
 * @property {string} last_name
 * @property {boolean} is_staff
 */

/**
 * Safe author shape embedded in reviews/comments — never includes email.
 * @typedef {Object} SafeAuthor
 * @property {number} id
 * @property {string} first_name
 * @property {string} last_name
 */

/**
 * @typedef {Object} Category
 * @property {number} id
 * @property {string} name
 * @property {string} slug
 */

/**
 * @typedef {Object} Game
 * @property {number} id
 * @property {string} name
 * @property {string} slug
 * @property {string} description
 * @property {string} developer
 * @property {string} publisher
 * @property {string} release_date
 * @property {string} cover_image
 * @property {"ACTIVE"|"INACTIVE"} status
 * @property {Category} category
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * Write payload for admin game create/update (docs/API.md — Create game).
 * `category_id` is the write-only FK; `category` is read-only in responses.
 * On PATCH every field is optional; `slug` omitted means "keep unchanged".
 *
 * @typedef {Object} GameWritePayload
 * @property {string} name
 * @property {string} [slug] unique, non-numeric; server generates if omitted
 * @property {string} description
 * @property {string} developer
 * @property {string} publisher
 * @property {string} release_date ISO date (`YYYY-MM-DD`)
 * @property {string} [cover_image] URL, `""` allowed
 * @property {"ACTIVE"|"INACTIVE"} [status] defaults to `ACTIVE` on create
 * @property {number} category_id
 */

/**
 * Review list/detail item.
 * @typedef {Object} Review
 * @property {number} id
 * @property {number} rating
 * @property {string} content
 * @property {SafeAuthor} author
 * @property {{id: number, slug: string, name: string}} game
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} Comment
 * @property {number} id
 * @property {string} content
 * @property {SafeAuthor} author
 * @property {number} review
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} FavoriteGame
 * @property {number} id
 * @property {string} name
 * @property {string} slug
 * @property {string} cover_image
 * @property {string} release_date
 * @property {"ACTIVE"|"INACTIVE"} status
 * @property {Category} category
 */

/**
 * @typedef {Object} Favorite
 * @property {number} id
 * @property {FavoriteGame} game
 * @property {string} created_at
 */

/**
 * Standard pagination block returned by list endpoints.
 * @typedef {Object} Pagination
 * @property {number} page
 * @property {number} page_size
 * @property {number} total
 * @property {number} total_pages
 */

/**
 * @typedef {Object} PaginatedGames
 * @property {Game[]} items
 * @property {Pagination} pagination
 */

/**
 * @typedef {Object} PaginatedCategories
 * @property {Category[]} items
 * @property {Pagination} pagination
 */

/**
 * @typedef {Object} PaginatedReviews
 * @property {Review[]} items
 * @property {Pagination} pagination
 */

/**
 * @typedef {Object} PaginatedComments
 * @property {Comment[]} items
 * @property {Pagination} pagination
 */

/**
 * @typedef {Object} PaginatedFavorites
 * @property {Favorite[]} items
 * @property {Pagination} pagination
 */

export {};
