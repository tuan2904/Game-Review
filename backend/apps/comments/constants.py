"""Comment moderation constants.

Kept in one place so the model constraint, serializer validation and the
configurable filter all agree on the same limits.
"""

# Hard cap on comment length. Enforced twice: serializer `max_length` (form
# friendly 400) and a DB CheckConstraint (last line of defence).
COMMENT_MAX_LENGTH = 2000

# Default banned-word list used when COMMENT_BANNED_WORDS is not configured.
# Matching is case- and accent-insensitive and whole-word (see
# apps.comments.moderation), so "idiot" matches "Idiot!" but not "idiots"...
# word boundaries are intentional to limit false positives. Override the whole
# list via the COMMENT_BANNED_WORDS environment variable (comma-separated).
DEFAULT_BANNED_WORDS = (
    "idiot",
    "stupid",
    "moron",
    "bastard",
    "asshole",
)
