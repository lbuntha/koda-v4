"""Query helpers for repos.

Tenancy — the `familyId` filter every query carries — lives in
`app.security.tenancy`, because it is a security control rather than a
convenience. Re-exported here so a repo reads naturally.
"""

from app.security.tenancy import own_learner_only, scoped

__all__ = ["own_learner_only", "scoped"]
