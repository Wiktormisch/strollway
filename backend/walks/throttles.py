"""A per-IP limit for requests that change data on the walks API."""

from rest_framework.permissions import SAFE_METHODS
from rest_framework.throttling import SimpleRateThrottle


class WriteRateThrottle(SimpleRateThrottle):
    """Counts only POST, PUT, PATCH and DELETE, per IP address.

    Per IP, not per client: a new random X-Client-Id is free, so a per-client limit is
    easy to skip. Reads are not counted, so browsing never hits the limit.
    """

    scope = "writes"

    def allow_request(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return super().allow_request(request, view)

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}
