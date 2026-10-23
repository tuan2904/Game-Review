from rest_framework.throttling import SimpleRateThrottle


class _PerIPTrottle(SimpleRateThrottle):
    """Base: per-IP rate limiting keyed by the client address only.

    Keying on IP (not user) means it also covers anonymous calls, which is the
    relevant case for login/register.
    """

    def get_cache_key(self, request, view):
        return self.cache_format % {
            "scope": self.scope,
            "ident": self.get_ident(request),
        }


class LoginRateThrottle(_PerIPTrottle):
    """Rate limit for POST /auth/login/.

    A lightweight first line against credential stuffing and password
    guessing. Applied explicitly to the login view only (never as a global
    default). Not a complete production anti-brute-force strategy on its own.
    """

    scope = "login"


class RegisterRateThrottle(_PerIPTrottle):
    """Rate limit for POST /auth/register/ — curbs signup spam/abuse.

    Separate scope/budget from login so the two endpoints are not coupled.
    """

    scope = "register"
