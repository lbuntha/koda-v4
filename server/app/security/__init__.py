"""Everything that decides whether a request may happen.

Security in this service is four layers, and each one is a module here. They
are separate because they answer different questions and fail differently:

    1. authentication   who is calling?            principal.py
    2. authorization    may they do this kind      permissions.py + policy.py
                        of thing?
    3. tenancy          to whose data?             tenancy.py
    4. rate limiting    how often may they try?    rate_limit.py

The second and third are the pair that matters. A permission check alone would
let a wrong table entry read another family; a scoped query alone would let any
signed-in person do anything to their own family. Both hold, so either one
failing is contained by the other.

Nothing outside this package reads a token, hashes a password or builds a
`familyId` filter by hand — if you find yourself doing one of those, the thing
you want is already here.
"""

from app.security.passwords import hash_password, needs_rehash, verify_password
from app.security.permissions import (
    AUTHENTICATED,
    CurrentPrincipal,
    principal,
    principal_can,
    require,
)
from app.security.policy import (
    GRANT_ONLY,
    PERMISSIONS,
    PLATFORM_PERMISSIONS,
    ROLE_PERMISSIONS,
    effective_permissions,
    platform_can,
    role_can,
)
from app.security.rate_limit import RateLimit, limiter
from app.security.scheme import bearer_scheme
from app.security.tenancy import own_learner_only, scoped
from app.security.tokens import (
    ACCESS_AUDIENCE,
    ADMIN_AUDIENCE,
    hash_refresh,
    issue_access,
    new_refresh_token,
    read_access,
)

__all__ = [
    "ACCESS_AUDIENCE",
    "ADMIN_AUDIENCE",
    "AUTHENTICATED",
    "CurrentPrincipal",
    "GRANT_ONLY",
    "PERMISSIONS",
    "PLATFORM_PERMISSIONS",
    "ROLE_PERMISSIONS",
    "RateLimit",
    "bearer_scheme",
    "effective_permissions",
    "hash_password",
    "hash_refresh",
    "issue_access",
    "limiter",
    "needs_rehash",
    "new_refresh_token",
    "own_learner_only",
    "platform_can",
    "principal",
    "principal_can",
    "read_access",
    "require",
    "role_can",
    "scoped",
    "verify_password",
]
