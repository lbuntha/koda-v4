"""Shared administrative audit (Phase 0, item 7).

Sensitive mutations must be traceable: who did it, what changed (before → after),
why (reason), and at what revision. Kept in `core/` so any feature records an
audit without cross-feature imports. The change-diff is a pure function so it is
unit-testable; the insert is a thin async wrapper.

Resource types this covers (endpoints for several land in later phases; they call
`record_audit` when they do):
  * `assignment`            — assign / pause / re-anchor a curriculum
  * `roster`                — classroom + enrollment changes
  * `scoring_config`        — admin settings / scoring-knob edits
  * `curriculum_release`    — publishing an immutable release
  * `progression_override`  — a manual mastery/frontier override

Never place secrets (API keys, PINs) in `before`/`after` — record a boolean like
`api_key_set` instead.
"""

from __future__ import annotations

from typing import Any

from ..models.audit import ContentAuditEvent
from ..models.user import User

AUDITED_RESOURCES = frozenset({
    "assignment", "roster", "scoring_config", "system_settings",
    "curriculum_release", "progression_override",
    "student_data",
})


def diff_fields(before: dict, after: dict) -> dict:
    """Compute the changed keys and their before/after values.

    Returns `{"changed": [...], "before": {...}, "after": {...}}` restricted to the
    keys whose value actually changed — so an audit records the delta, not a full
    dump. A key present on only one side counts as changed (added/removed).
    """
    keys = sorted(set(before) | set(after))
    changed = [k for k in keys if before.get(k) != after.get(k)]
    return {
        "changed": changed,
        "before": {k: before.get(k) for k in changed},
        "after": {k: after.get(k) for k in changed},
    }


def _role_value(user: User) -> str:
    return user.role.value if hasattr(user.role, "value") else str(user.role)


async def record_audit(
    *,
    actor: User,
    resource_type: str,
    action: str,
    owner_id: str = "",
    revision: int = 0,
    reason: str | None = None,
    before: dict | None = None,
    after: dict | None = None,
    summary: dict[str, Any] | None = None,
    curriculum_id: str | None = None,
) -> ContentAuditEvent:
    """Insert one audit record. `before`/`after` may be full snapshots; the diff
    is computed and stored in `summary.changed` when both are given."""
    stored_summary = dict(summary or {})
    if before is not None and after is not None and "changed" not in stored_summary:
        stored_summary["changed"] = diff_fields(before, after)["changed"]

    event = ContentAuditEvent(
        actor_id=str(actor.id),
        actor_role=_role_value(actor),
        owner_id=owner_id,
        resource_type=resource_type,
        curriculum_id=curriculum_id,
        action=action,
        revision=revision,
        reason=reason,
        before=before,
        after=after,
        summary=stored_summary,
    )
    await event.insert()
    return event
