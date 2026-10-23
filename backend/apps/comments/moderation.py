"""Comment content moderation: a small, configurable banned-word filter.

Design goals (see docs/audit/game-review-source-audit.md — Phase B):

- **Configurable:** the word list comes from the ``COMMENT_BANNED_WORDS``
  setting (comma-separated env var), falling back to
  :data:`apps.comments.constants.DEFAULT_BANNED_WORDS`.
- **Accent- and case-insensitive:** text is normalised to lowercase ASCII, so
  "IDIOT" and "idiót" both match. This also covers the "không dấu" variants the
  audit calls out.
- **Whole-word:** boundaries are enforced so "idiot" does not match "idiots"
  inside an unrelated word, keeping false positives low.

The filter is deliberately simple. It is a first line of defence, not a
complete profanity engine — staff can still hide any comment.
"""

import re
import unicodedata

from django.conf import settings

from apps.comments.constants import DEFAULT_BANNED_WORDS

_NON_ALNUM = re.compile(r"[^0-9a-z]+")


def normalize(value):
    """Lowercase, strip accents and reduce to space-separated word tokens."""
    decomposed = unicodedata.normalize("NFKD", value or "")
    without_marks = "".join(char for char in decomposed if not unicodedata.combining(char))
    return _NON_ALNUM.sub(" ", without_marks.lower()).strip()


def banned_words():
    """The effective (normalised) banned-word list for this process."""
    configured = getattr(settings, "COMMENT_BANNED_WORDS", None)
    words = DEFAULT_BANNED_WORDS if configured is None else configured
    return [normalized for normalized in (normalize(word) for word in words) if normalized]


def find_banned_word(value):
    """Return the first banned word found in ``value``, or ``None``.

    Matching is whole-word over the normalised text so punctuation and accents
    do not create bypasses.
    """
    text = normalize(value)
    if not text:
        return None
    for word in banned_words():
        parts = [re.escape(part) for part in word.split()]
        pattern = r"(?<![0-9a-z])" + r"\s+".join(parts) + r"(?![0-9a-z])"
        if re.search(pattern, text):
            return word
    return None
