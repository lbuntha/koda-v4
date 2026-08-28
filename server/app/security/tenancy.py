"""To whose data.

Every query in the service is built through `scoped()`, which adds `familyId`
from the *token*. A wrong cell in the permission table then leaks nothing across
families, because the filter never had the other family in it.

A repo that builds a raw filter is the bug to catch in review — and the reason
this lives in `security/` rather than beside the repos is that it is a security
control, not a query helper.
"""

from typing import Any

from app.errors import Forbidden
from app.models.auth import Principal


def scoped(principal: Principal, extra: dict[str, Any] | None = None) -> dict[str, Any]:
    if principal.family_id is None:
        # Staff. There is no family to scope to, and quietly returning an
        # unscoped query here is exactly how "an admin reads one family"
        # becomes "an admin reads all of them by accident".
        raise Forbidden("This account is not part of a family.", "no_family")

    query: dict[str, Any] = {"familyId": principal.family_id}
    if extra:
        query.update(extra)
    return query


def own_learner_only(principal: Principal, query: dict[str, Any]) -> dict[str, Any]:
    """A learner device sees its own learner and nobody else's."""
    if principal.role == "learner" and principal.learner_id:
        query["learnerId"] = principal.learner_id
    return query
