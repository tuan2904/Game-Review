/**
 * Shared API payload shapes — verified against docs/API.md and the backend
 * serializers. The project uses JavaScript (no TypeScript conversion in
 * this phase); JSDoc typedefs give editors real type hints without a
 * migration.
 *
 * IMPORTANT: these mirror the *actual* API (docs/API.md). Never invent
 * fields the backend does not return — extend this file whenever a phase
 * adds payload fields (Phase D added `average_rating`/`review_count`,
 * Phase E added `Report`/`AdminSummary`/`AdminComment`).
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
 * Staff-view user row (`GET /admin/users/`) — safe fields only, never
 * password/permissions beyond `is_staff`/`is_active`.
 * @typedef {Object} AdminUser
 * @property {number} id
 * @property {string} email
 * @property {string} first_name
 * @property {string} last_name
 * @property {boolean} is_staff
 * @property {boolean} is_active
 * @property {string} created_at
 */

/**
 * Safe author shape embedded in reviews/comments — never includes email.
 * @typedef {Object} SafeAuthor
 * @property {number} id
 * @property {string} first_name
 * @property {string} last_name
 */

/**
 * The reported review inside a queue item (`GET /admin/reports/`).
 * @typedef {Object} ReportedReview
 * @property {number} id
 * @property {number} rating
 * @property {string} content
 * @property {string} created_at
 * @property {{id: number, slug: string, name: string}} game
 */

/**
 * The reported comment inside a queue item (`GET /admin/reports/`).
 * @typedef {Object} ReportedComment
 * @property {number} id
 * @property {string} content
 * @property {boolean} is_hidden
 * @property {string} created_at
 * @property {{id: number, slug: string, name: string}} game
 */

/**
 * A user report against exactly one review or comment (Phase E).
 * `reporter`/`resolved_by` use the safe author shape; exactly one of
 * `review`/`comment` is non-null.
 *
 * @typedef {Object} Report
 * @property {number} id
 * @property {"SPAM"|"HARASSMENT"|"OFF_TOPIC"|"MISLEADING"|"OTHER"} reason
 * @property {string} details free-text note ("" when none)
 * @property {"PENDING"|"RESOLVED"} status
 * @property {SafeAuthor} reporter
 * @property {ReportedReview|null} review null on comment reports
 * @property {ReportedComment|null} comment null on review reports
 * @property {SafeAuthor|null} resolved_by
 * @property {string|null} resolved_at
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * Staff comment-queue row (`GET /admin/comments/`) — the public comment
 * shape plus the parent game link (comments have no page of their own).
 * @typedef {Object} AdminComment
 * @property {number} id
 * @property {string} content
 * @property {SafeAuthor} author
 * @property {{id: number, slug: string, name: string}} game
 * @property {number} review
 * @property {boolean} is_hidden
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * Dashboard counters (`GET /admin/summary/`) — live counts, no trends.
 * @typedef {Object} AdminSummary
 * @property {{total: number, active: number, inactive: number}} games
 * @property {number} categories
 * @property {{total: number, active: number, locked: number, staff: number}} users
 * @property {number} reviews
 * @property {{total: number, visible: number, hidden: number}} comments
 * @property {number} favorites
 * @property {{total: number, pending: number, resolved: number}} reports
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
 * @property {number|null} average_rating mean rating across reviews (null = none yet)
 * @property {number} review_count how many reviews the game has (0 = none yet)
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
 * @property {boolean} is_hidden staff moderation flag; hidden comments are
 *   filtered out of public lists and only reachable by staff
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

/**
 * @typedef {Object} PaginatedAdminUsers
 * @property {AdminUser[]} items
 * @property {Pagination} pagination
 */

/**
 * @typedef {Object} PaginatedReports
 * @property {Report[]} items
 * @property {Pagination} pagination
 */

/**
 * @typedef {Object} PaginatedAdminComments
 * @property {AdminComment[]} items
 * @property {Pagination} pagination
 */

export {};
