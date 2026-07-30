from datetime import datetime, timezone
from uuid import uuid4

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.errors import DuplicateKeyError

from ...core.audit import record_audit
from ...core.deps import get_current_student, get_current_user
from ...core.logging import get_logger
from ...core.permissions import authorize_guardian_read
from ...core.runtime_settings import get_system_settings
from ...models.assignment import Assignment, Placement, ProgressionState
from ...models.content import CurriculumRelease
from ...models.student import Student
from ...models.user import Role, User
from ..content.placement import PlacementError, build_placement, compute_placement
from .schemas import AssignmentIn, AssignmentStatusIn, PlacementSubmitIn

logger = get_logger("placement")

router = APIRouter(tags=["placement"])

ADULT_ROLES = {Role.admin.value, Role.parent.value, Role.teacher.value}


def _role(user: User) -> str:
    return user.role.value if hasattr(user.role, "value") else str(user.role)


def _require_adult(user: User) -> None:
    if _role(user) not in ADULT_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Adult account required")


async def _get_by_id(model: type, raw_id: str):
    """Fetch a document by string ObjectId, returning None on any bad/missing id."""
    try:
        return await model.get(PydanticObjectId(raw_id))
    except Exception:
        return None


def _assignment_out(item: Assignment) -> dict:
    return {
        "id": str(item.id),
        "ownerId": item.owner_id,
        "studentId": item.student_id,
        "curriculumId": item.curriculum_id,
        "releaseId": item.release_id,
        "gradeId": item.grade_id,
        "scope": item.scope,
        "mode": item.mode,
        "schedule": item.schedule,
        "priority": item.priority,
        "placementRequired": item.placement_required,
        "status": item.status,
        "createdAt": item.created_at,
        "updatedAt": item.updated_at,
    }


def _release_dict(release: CurriculumRelease) -> dict:
    return {
        "release_id": release.release_id,
        "curriculum_id": release.curriculum_id,
        "revision": release.revision,
        "tree": release.tree,
        "question_manifest": release.question_manifest,
    }


async def _student_or_404(student_id: str) -> Student:
    student = await _get_by_id(Student, student_id)
    if not student:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")
    return student


async def _assignment_for_student(assignment_id: str, student_id: str) -> Assignment:
    assignment = await _get_by_id(Assignment, assignment_id)
    if not assignment or assignment.student_id != student_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assignment not found")
    return assignment


async def _owned_assignment_or_404(assignment_id: str, user: User) -> Assignment:
    """An assignment the caller may manage: admins see all, others only their own."""
    assignment = await _get_by_id(Assignment, assignment_id)
    if not assignment or (_role(user) != Role.admin.value and assignment.owner_id != str(user.id)):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assignment not found")
    return assignment


async def _release_for_create(body: AssignmentIn, user: User) -> CurriculumRelease:
    release = await CurriculumRelease.find_one(CurriculumRelease.release_id == body.release_id)
    if not release or release.curriculum_id != body.curriculum_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Release does not belong to this curriculum")
    if _role(user) != Role.admin.value and release.owner_id != str(user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only assign your own published release")
    grade_ids = {item.get("id") for item in release.tree.get("grades", [])}
    if body.grade_id not in grade_ids:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Grade is not included in this release")
    scope_ids = set(body.scope.ids)
    if body.scope.kind == "grades" and not scope_ids <= grade_ids:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Scope contains an unknown grade")
    if body.scope.kind == "units":
        known = {item.get("id") for item in release.tree.get("units", [])}
        if not scope_ids <= known:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Scope contains an unknown unit")
    if body.scope.kind == "skills":
        known = {item.get("id") for item in release.tree.get("skills", [])}
        if not scope_ids <= known:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Scope contains an unknown skill")
    return release


@router.get("/assignments")
async def list_assignments(user: User = Depends(get_current_user)):
    query = {} if _role(user) == Role.admin.value else {"owner_id": str(user.id)}
    rows = await Assignment.find(query).sort("-updated_at").to_list()
    return {"assignments": [_assignment_out(row) for row in rows]}


@router.get("/assignment-students")
async def list_assignable_students(user: User = Depends(get_current_user)):
    _require_adult(user)
    students = await Student.find_all().to_list()
    output = []
    for student in students:
        if _role(user) != Role.admin.value:
            try:
                await authorize_guardian_read(str(student.id), user)
            except HTTPException:
                continue
        output.append({"id": str(student.id), "name": student.name, "avatar": student.avatar})
    return {"students": output}


@router.post("/assignments", status_code=status.HTTP_201_CREATED)
async def create_assignment(body: AssignmentIn, user: User = Depends(get_current_user)):
    _require_adult(user)
    await _student_or_404(body.student_id)
    await authorize_guardian_read(body.student_id, user)
    release = await _release_for_create(body, user)
    assignment = Assignment(
        owner_id=str(user.id),
        student_id=body.student_id,
        curriculum_id=body.curriculum_id,
        release_id=body.release_id,
        grade_id=body.grade_id,
        scope=body.scope.model_dump(),
        mode=body.mode,
        schedule=body.schedule,
        priority=body.priority,
        placement_required=body.placement_required,
    )
    try:
        await assignment.insert()
    except DuplicateKeyError:
        raise HTTPException(status.HTTP_409_CONFLICT, "An active assignment already covers this release and scope")
    await record_audit(
        actor=user,
        owner_id=str(user.id),
        resource_type="assignment",
        action="created",
        curriculum_id=body.curriculum_id,
        summary={"assignmentId": str(assignment.id), "studentId": body.student_id, "releaseId": body.release_id},
    )
    return _assignment_out(assignment)


@router.get("/assignments/{assignment_id}")
async def get_assignment(assignment_id: str, user: User = Depends(get_current_user)):
    assignment = await _owned_assignment_or_404(assignment_id, user)
    return _assignment_out(assignment)


@router.patch("/assignments/{assignment_id}")
async def update_assignment(assignment_id: str, body: AssignmentStatusIn, user: User = Depends(get_current_user)):
    assignment = await _owned_assignment_or_404(assignment_id, user)
    before = {"status": assignment.status, "release_id": assignment.release_id}

    if body.release_id and body.release_id != assignment.release_id:
        release = await CurriculumRelease.find_one(CurriculumRelease.release_id == body.release_id)
        if not release:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Release not found")
        # A release from another curriculum would silently repoint the learner at unrelated
        # skills, orphaning their placement, progression, and mastery for this assignment.
        if release.curriculum_id != assignment.curriculum_id:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "That release belongs to a different curriculum",
            )
        assignment.release_id = body.release_id

    if body.status:
        assignment.status = body.status

    assignment.updated_at = datetime.now(timezone.utc)
    await assignment.save()
    after = {"status": assignment.status, "release_id": assignment.release_id}
    await record_audit(
        actor=user,
        owner_id=assignment.owner_id,
        resource_type="assignment",
        action="release_upgraded" if before["release_id"] != after["release_id"] else "status_changed",
        curriculum_id=assignment.curriculum_id,
        before=before,
        after=after,
    )
    return _assignment_out(assignment)


def _placement_items(placement: Placement, release: CurriculumRelease) -> list[dict]:
    by_id = {entry.get("question_id"): entry for entry in release.question_manifest}
    items = []
    for manifest_item in placement.item_manifest:
        playable = dict((by_id.get(manifest_item.get("question_id")) or {}).get("playable") or {})
        if not playable:
            continue
        playable["skillId"] = manifest_item.get("skill_id")
        playable["difficulty"] = manifest_item.get("difficulty")
        playable["placementItemId"] = manifest_item.get("question_id")
        items.append(playable)
    return items


def _placement_out(placement: Placement, release: CurriculumRelease) -> dict:
    return {
        "placementId": str(placement.id),
        "assignmentId": placement.assignment_id,
        "releaseId": placement.release_id,
        "status": placement.status,
        "items": _placement_items(placement, release) if placement.status in {"pending", "in_progress"} else [],
        "frontierSkillId": placement.frontier_skill_id,
        "eligibleSkillIds": placement.eligible_skill_ids,
        "scoreBySkill": placement.score_by_skill,
        "completedAt": placement.completed_at,
    }


async def _get_or_create_placement(assignment: Assignment) -> tuple[Placement, CurriculumRelease]:
    release = await CurriculumRelease.find_one(CurriculumRelease.release_id == assignment.release_id)
    if not release:
        raise HTTPException(status.HTTP_409_CONFLICT, "The assigned release is no longer available")
    placement = await Placement.find_one(
        Placement.student_id == assignment.student_id,
        Placement.assignment_id == str(assignment.id),
    )
    if placement:
        return placement, release
    settings_doc = await get_system_settings()
    placement_config = (settings_doc.scoring or {}).get("placement") or {}
    seed = f"{assignment.student_id}:{assignment.id}:{assignment.release_id}"
    generated = build_placement(_release_dict(release), assignment.scope, placement_config, seed)
    # A checkpoint skill with no authored questions contributes no items, so the learner is
    # placed on thinner evidence than the design assumes — silently, and the placement then
    # governs everything they are shown. Sparse authoring is the usual cause and is fixable,
    # but only if someone knows.
    covered = len({item["skill_id"] for item in generated["item_manifest"]})
    expected = int(placement_config.get("checkpoint_cap", 8))
    if covered < expected:
        logger.warning(
            "placement sparse student_id=%s release_id=%s skills_covered=%s expected=%s items=%s",
            assignment.student_id, assignment.release_id, covered, expected,
            len(generated["item_manifest"]),
        )
    placement = Placement(
        student_id=assignment.student_id,
        assignment_id=str(assignment.id),
        grade_id=assignment.grade_id,
        curriculum_id=assignment.curriculum_id,
        release_id=assignment.release_id,
        generator_revision=generated["generator_revision"],
        scoring_revision=settings_doc.scoring_revision,
        item_manifest=generated["item_manifest"],
    )
    if not placement.item_manifest:
        placement.status = "skipped"
        placement.frontier_skill_id = generated["skill_order"][0] if generated["skill_order"] else None
        placement.completed_at = datetime.now(timezone.utc)
    await placement.insert()
    if placement.status == "skipped":
        await _upsert_progression(placement)
    return placement, release


async def _upsert_progression(placement: Placement) -> None:
    state = await ProgressionState.find_one(
        ProgressionState.student_id == placement.student_id,
        ProgressionState.assignment_id == placement.assignment_id,
    )
    values = {
        "student_id": placement.student_id,
        "assignment_id": placement.assignment_id,
        "curriculum_id": placement.curriculum_id,
        "release_id": placement.release_id,
        "frontier_skill_id": placement.frontier_skill_id,
        "eligible_skill_ids": placement.eligible_skill_ids,
        "placement_id": str(placement.id),
        "placement_status": placement.status,
        "updated_at": datetime.now(timezone.utc),
    }
    if state:
        for key, value in values.items():
            setattr(state, key, value)
        await state.save()
    else:
        await ProgressionState(**values).insert()


@router.get("/student/placement/quiz")
async def get_student_placement(student: Student = Depends(get_current_student)):
    assignments = await Assignment.find(
        Assignment.student_id == str(student.id),
        Assignment.status == "active",
        Assignment.placement_required == True,
    ).sort("priority", "created_at").to_list()
    for assignment in assignments:
        placement, release = await _get_or_create_placement(assignment)
        if placement.status in {"pending", "in_progress"}:
            return _placement_out(placement, release)
    return {"placementId": None, "status": "none", "items": [], "frontierSkillId": None, "eligibleSkillIds": []}


@router.post("/student/placement/{placement_id}/submit")
async def submit_student_placement(
    placement_id: str,
    body: PlacementSubmitIn,
    student: Student = Depends(get_current_student),
):
    placement = await _get_by_id(Placement, placement_id)
    if not placement or placement.student_id != str(student.id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Placement not found")
    if placement.status not in {"pending", "in_progress"}:
        raise HTTPException(status.HTTP_409_CONFLICT, "Placement is already complete")
    assignment = await _assignment_for_student(placement.assignment_id, str(student.id))
    release = await CurriculumRelease.find_one(CurriculumRelease.release_id == placement.release_id)
    if not release:
        raise HTTPException(status.HTTP_409_CONFLICT, "The assigned release is no longer available")
    expected = {item.get("question_id") for item in placement.item_manifest}
    received = {item.get("questionId") or item.get("question_id") for item in body.responses}
    if received != expected:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Submit one response for every placement question")
    settings_doc = await get_system_settings()
    pass_threshold = (settings_doc.scoring or {}).get("placement", {}).get("pass_threshold", 0.8)
    try:
        result = compute_placement(body.responses, _release_dict(release), placement.item_manifest, pass_threshold)
    except (PlacementError, ValueError) as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    placement.responses = result["responses"]
    placement.score_by_skill = result["score_by_skill"]
    placement.frontier_skill_id = result["frontier_skill_id"]
    placement.eligible_skill_ids = result["eligible_skill_ids"]
    placement.status = "completed"
    placement.completed_at = datetime.now(timezone.utc)
    await placement.save()
    await _upsert_progression(placement)
    return _placement_out(placement, release)


@router.get("/students/{student_id}/placements")
async def list_student_placements(student_id: str, user: User = Depends(get_current_user)):
    await authorize_guardian_read(student_id, user)
    rows = await Placement.find(Placement.student_id == student_id).sort("-created_at").to_list()
    output = []
    for row in rows:
        release = await CurriculumRelease.find_one(CurriculumRelease.release_id == row.release_id)
        if release:
            output.append(_placement_out(row, release))
    return {"placements": output}
