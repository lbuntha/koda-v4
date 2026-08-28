"""The §5 matrix, asserted cell by cell.

If a permission moves, this file is what says so out loud.
"""

import pytest

from app.security.policy import ROLE_PERMISSIONS, platform_can, role_can

ROLE_PERMISSIONS_SNAPSHOT = {role: set(perms) for role, perms in ROLE_PERMISSIONS.items()}

FAMILY_ROLES = ("owner", "parent", "caregiver", "child", "student")

MATRIX = {
    "family:read": {"owner", "parent", "caregiver", "child", "student"},
    "family:update": {"owner", "parent"},
    "family:delete": {"owner"},
    "family:transfer": {"owner"},
    "member:invite": {"owner", "parent"},
    "member:list": {"owner", "parent", "caregiver"},
    "member:role": {"owner"},
    "member:remove": {"owner"},
    "learner:create": {"owner", "parent"},
    "learner:delete": {"owner", "parent"},
    "learner_data:read": {"owner", "parent", "caregiver", "child", "student"},
    # Appending is what a device does after a round; rewriting is nobody's.
    "learner_data:append": {"owner", "parent", "child", "student"},
    "learner_data:write": set(),
    "settings:read": {"owner", "parent", "caregiver", "child", "student"},
    "settings:write": {"owner", "parent", "student"},
    # Split out of `settings:write`: the owner's, not every adult's.
    "scoring:write": {"owner"},
    # Nobody's inside a family: it governs every family on the deployment.
    "system:write": set(),
    "device:list": {"owner", "parent", "caregiver", "child", "student"},
    "device:revoke": {"owner", "parent", "child", "student"},
}


@pytest.mark.parametrize("permission,allowed", MATRIX.items())
def test_family_roles(permission, allowed):
    for role in FAMILY_ROLES:
        assert role_can(role, permission) is (role in allowed), f"{role} / {permission}"


def test_a_child_cannot_change_family_settings():
    """A kid's tablet plays; the skills and art it plays with are a parent's."""
    assert not role_can("child", "settings:write")


def test_learner_is_still_understood_after_the_rename():
    """Tokens and rows written before `child` existed must not stop working."""
    for permission in ("family:read", "learner_data:append", "settings:read"):
        assert role_can("learner", permission) == role_can("child", permission)
    assert not role_can("learner", "settings:write")


def test_a_student_runs_their_own_learning_but_owns_no_children():
    assert role_can("student", "settings:write"), "an older learner manages their own app"
    assert role_can("student", "learner_data:append")
    assert not role_can("student", "learner:create"), "there is nobody under them"
    assert not role_can("student", "member:invite")


def test_re_pricing_xp_is_the_owners():
    """Split out of `settings:write`, so a parent keeps skills and art without
    being able to re-price what a child already earned."""
    assert role_can("owner", "scoring:write")
    for role in ("parent", "caregiver", "child", "student"):
        assert not role_can(role, "scoring:write"), role
    assert role_can("parent", "settings:write"), "skills and art are still theirs"


def test_a_family_can_still_hand_scoring_to_a_parent():
    """The split is a default, not a wall — that is what the Roles page is for."""
    from app.security.policy import effective_permissions

    granted = effective_permissions("parent", extra=["scoring:write"])
    assert "scoring:write" in granted
    assert granted - {"scoring:write"} == effective_permissions("parent")


def test_a_developer_builds_content_and_sees_no_child():
    assert platform_can("developer", "settings:write")
    assert platform_can("developer", "scoring:write"), "scoring is content they tune"
    assert not platform_can("developer", "learner_data:read")
    assert not platform_can("developer", "family:read"), "content is not a family"
    assert not platform_can("developer", "device:revoke")


def test_a_caregiver_changes_nothing():
    for permission in MATRIX:
        if permission.endswith(
            (":write", ":append", ":update", ":delete", ":create", ":role", ":remove")
        ):
            assert not role_can("caregiver", permission)


def test_nobody_rewrites_a_childs_record():
    for role in FAMILY_ROLES:
        assert not role_can(role, "learner_data:write")


def test_staff_never_read_a_childs_record_by_role_alone():
    for staff in ("support", "developer", "admin"):
        assert not platform_can(staff, "learner_data:read")
        assert not platform_can(staff, "learner_data:append")
        assert not platform_can(staff, "learner_data:write")


def test_an_admin_manages_content_but_not_a_childs_record():
    assert platform_can("admin", "settings:write"), "skills and art are an operator's job"
    assert platform_can("admin", "scoring:write")
    assert not platform_can("admin", "learner_data:read"), "a record still takes a grant"


def test_support_is_read_only():
    assert platform_can("support", "family:read")
    assert not platform_can("support", "device:revoke")
    assert not platform_can("none", "family:read")


def test_rights_start_from_the_role():
    from app.security.policy import effective_permissions

    assert effective_permissions("caregiver") == ROLE_PERMISSIONS_SNAPSHOT["caregiver"]


def test_a_grant_adds_one_permission_without_changing_the_role():
    from app.security.policy import effective_permissions

    caregiver = effective_permissions("caregiver")
    with_extra = effective_permissions("caregiver", extra=["settings:write"])

    assert "settings:write" in with_extra
    assert with_extra - {"settings:write"} == caregiver, "nothing else moved"


def test_a_denial_removes_one_permission():
    from app.security.policy import effective_permissions

    parent = effective_permissions("parent")
    without = effective_permissions("parent", denied=["settings:write"])

    assert "settings:write" not in without
    assert without | {"settings:write"} == parent


def test_the_switchboard_belongs_to_the_operator_and_to_nobody_else():
    """An owner runs their family; an operator runs the service."""
    from app.security.policy import effective_permissions

    for role in FAMILY_ROLES:
        assert not role_can(role, "system:write")
    assert platform_can("admin", "system:write")
    assert not platform_can("developer", "system:write"), "building content is not operating"
    # And it cannot be handed over by a row, the way `settings:write` can.
    assert "system:write" not in effective_permissions("owner", extra=["system:write"])


def test_rewriting_a_record_cannot_be_granted_to_anyone():
    from app.security.policy import effective_permissions

    assert "learner_data:write" not in effective_permissions("owner", extra=["learner_data:write"])


def test_an_invented_permission_is_ignored_rather_than_trusted():
    from app.security.policy import effective_permissions

    assert "settings:everything" not in effective_permissions("caregiver",
                                                              extra=["settings:everything"])


def test_the_role_table_and_the_effective_set_agree_about_shared_content():
    """Two answers to one question is how a page offers what an API refuses.

    `/family/permissions` serves `ROLE_PERMISSIONS` directly — it is what the
    Menu screen groups its audience tabs by — while tokens carry
    `effective_permissions`. Subtracting a permission in only one of them puts
    an entry in the Parents tab that no parent can open.
    """
    from app.security import policy

    for role in ("owner", "parent", "caregiver", "student", "child"):
        assert not policy.role_can(role, "content:write"), role
        assert "content:write" not in policy.effective_permissions(role), role

    # And an exception list cannot smuggle it in either.
    granted = policy.effective_permissions("parent", extra=["content:write"])
    assert "content:write" not in granted

    # It is a platform role's, and both operators keep it.
    assert policy.platform_can("admin", "content:write")
    assert policy.platform_can("developer", "content:write")
