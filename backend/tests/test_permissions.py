"""Unit tests for the student-read authorization decision (core/permissions.py).

Pure decision only (no DB): admins see everyone, parents see guardianed kids,
teachers see ONLY students they have an active enrollment for. This is the rule
that replaces the old "any teacher can read any student" access.
"""

from app.core.permissions import can_read_student
from app.models.user import Role


def test_admin_reads_any_student():
    assert can_read_student(
        role=Role.admin.value, user_id="admin1",
        guardian_parent_ids=[], teacher_has_active_enrollment=False,
    ) is True


def test_parent_reads_only_guardianed_child():
    assert can_read_student(
        role=Role.parent.value, user_id="p1",
        guardian_parent_ids=["p1"], teacher_has_active_enrollment=False,
    ) is True
    assert can_read_student(
        role=Role.parent.value, user_id="p2",
        guardian_parent_ids=["p1"], teacher_has_active_enrollment=False,
    ) is False


def test_teacher_needs_active_enrollment():
    # enrolled → allowed
    assert can_read_student(
        role=Role.teacher.value, user_id="t1",
        guardian_parent_ids=[], teacher_has_active_enrollment=True,
    ) is True
    # NOT enrolled → denied (this is the removed global-teacher access)
    assert can_read_student(
        role=Role.teacher.value, user_id="t1",
        guardian_parent_ids=[], teacher_has_active_enrollment=False,
    ) is False


def test_teacher_being_a_guardian_id_does_not_grant_via_parent_path():
    # a teacher who happens to appear in guardian_parent_ids still needs enrollment
    assert can_read_student(
        role=Role.teacher.value, user_id="t1",
        guardian_parent_ids=["t1"], teacher_has_active_enrollment=False,
    ) is False


def test_student_or_unknown_role_denied():
    assert can_read_student(
        role=Role.student.value, user_id="s1",
        guardian_parent_ids=["s1"], teacher_has_active_enrollment=True,
    ) is False
    assert can_read_student(
        role="something_else", user_id="x",
        guardian_parent_ids=["x"], teacher_has_active_enrollment=True,
    ) is False
