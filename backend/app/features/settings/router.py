from collections import defaultdict
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pymongo.errors import DuplicateKeyError

from ...core.audit import record_audit
from ...core.config import settings as env_settings
from ...core.deps import get_current_admin, get_current_user
from ...core.runtime_settings import get_system_settings, resolve_openai_api_key
from ...core.security import encrypt_secret
from ...core.scoring_config import default_scoring_config
from ..progression.service import create_rescore_job, run_rescore_job
from ...models.user import Role, User
from ...models.academic import Grade, Subject, resolve_layout_band
from ...models.audit import ContentAuditEvent
from ...models.content import Curriculum
from ...models.mastery import ProjectionJob
from ...models.event import LearningEvent
from ...models.student import Student
from ..progression.projection import build_mastery_states
from .schemas import ALLOWED_AI_MODELS, GradeIn, ScoringPreviewIn, SettingsOut, SettingsUpdate, SubjectIn
from .simulator import compare_mastery_states, delivery_impact

router = APIRouter(prefix="/settings", tags=["settings"])


def _out(doc, api_key: str | None) -> SettingsOut:
    scoring = doc.scoring or default_scoring_config()
    return SettingsOut(
        sound_enabled=doc.sound_enabled,
        ai_model=doc.ai_model,
        api_key_configured=bool(api_key),
        api_key_hint=f"••••{api_key[-4:]}" if api_key else None,
        scoring=scoring,
        scoring_revision=doc.scoring_revision,
    )


@router.get("", response_model=SettingsOut)
async def get_settings(user: User = Depends(get_current_user)):
    doc = await get_system_settings()
    output = _out(doc, await resolve_openai_api_key(doc))
    if user.role != Role.admin:
        output.api_key_hint = None
    return output


def _settings_snapshot(doc) -> dict:
    """Audit-safe snapshot — records whether an API key is set, never the key."""
    return {
        "sound_enabled": doc.sound_enabled,
        "ai_model": doc.ai_model,
        "api_key_set": bool(doc.openai_api_key_encrypted),
    }


def _scoring_snapshot(doc) -> dict:
    return {
        "revision": doc.scoring_revision,
        "config": doc.scoring or default_scoring_config(),
    }


@router.put("", response_model=SettingsOut)
async def update_settings(
    body: SettingsUpdate,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_admin),
):
    if body.ai_model is not None and body.ai_model not in ALLOWED_AI_MODELS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unsupported AI model")
    doc = await get_system_settings()
    before = _settings_snapshot(doc)
    scoring_before = _scoring_snapshot(doc)
    if body.sound_enabled is not None:
        doc.sound_enabled = body.sound_enabled
    if body.ai_model is not None:
        doc.ai_model = body.ai_model
    if body.clear_api_key:
        doc.openai_api_key_encrypted = None
    elif body.openai_api_key is not None and body.openai_api_key.strip():
        doc.openai_api_key_encrypted = encrypt_secret(body.openai_api_key.strip())
    if body.scoring is not None:
        if body.scoring_revision != doc.scoring_revision:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "Scoring configuration changed in another session; reload before saving",
            )
        doc.scoring = body.scoring.model_dump()
        doc.scoring_revision += 1
    doc.updated_at = datetime.now(timezone.utc)
    await doc.save()
    after = _settings_snapshot(doc)
    if before != after:
        await record_audit(
            actor=user, resource_type="system_settings", action="settings_updated",
            before=before, after=after,
        )
    scoring_after = _scoring_snapshot(doc)
    if scoring_before != scoring_after:
        job = await create_rescore_job(doc.scoring_revision)
        background_tasks.add_task(run_rescore_job, job.job_id)
        scoring_after = {**scoring_after, "rescore_job_id": job.job_id}
        await record_audit(
            actor=user,
            resource_type="scoring_config",
            action="scoring_config_updated",
            revision=doc.scoring_revision,
            before=scoring_before,
            after=scoring_after,
        )
    return _out(doc, await resolve_openai_api_key(doc))


@router.post("/test-ai")
async def test_ai_connection(_: User = Depends(get_current_admin)):
    doc = await get_system_settings()
    api_key = await resolve_openai_api_key(doc)
    if not api_key:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "OpenAI API key is not configured")
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(
                f"{env_settings.openai_base_url}/models",
                headers={"Authorization": f"Bearer {api_key}"},
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"OpenAI connection failed: {exc}")
    if response.status_code >= 400:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "OpenAI rejected the configured API key")
    return {"ok": True}


@router.get("/rescore-jobs")
async def list_rescore_jobs(
    limit: int = 20,
    _: User = Depends(get_current_admin),
):
    rows = await ProjectionJob.find_all().sort("-created_at").limit(min(max(limit, 1), 100)).to_list()
    return {"jobs": [row.model_dump(mode="json") for row in rows]}


@router.get("/rescore-jobs/{job_id}")
async def get_rescore_job(job_id: str, _: User = Depends(get_current_admin)):
    row = await ProjectionJob.find_one(ProjectionJob.job_id == job_id)
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Re-score job not found")
    return row.model_dump(mode="json")


@router.post("/scoring-preview")
async def preview_scoring(
    body: ScoringPreviewIn,
    _: User = Depends(get_current_admin),
):
    """Replay verified events under a draft config without writing any state."""
    doc = await get_system_settings()
    if body.scoring_revision != doc.scoring_revision:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Scoring configuration changed in another session; reload before simulating",
        )
    now_ms = round(datetime.now(timezone.utc).timestamp() * 1000)
    events = await LearningEvent.find(
        LearningEvent.verified == True,
        {"curriculum_skill_id": {"$type": "string"}},
    ).sort("student_id", "client_timestamp_ms").to_list()
    by_student: dict[str, list[dict]] = defaultdict(list)
    for event in events:
        by_student[event.student_id].append(event.model_dump(mode="python"))

    current_states: list[dict] = []
    proposed_states: list[dict] = []
    current_config = doc.scoring or default_scoring_config()
    proposed_config = body.scoring.model_dump()
    for student_id, student_events in by_student.items():
        current_states.extend(build_mastery_states(
            student_id,
            student_events,
            config=current_config,
            now_ms=now_ms,
            scoring_revision=doc.scoring_revision,
        ))
        proposed_states.extend(build_mastery_states(
            student_id,
            student_events,
            config=proposed_config,
            now_ms=now_ms,
            scoring_revision=doc.scoring_revision + 1,
        ))
    students = await Student.find_all().to_list()
    output = compare_mastery_states(
        current_states,
        proposed_states,
        student_names={str(student.id): student.name for student in students},
        now_ms=now_ms,
    )
    return {
        "currentRevision": doc.scoring_revision,
        "proposedRevision": doc.scoring_revision + 1,
        **output,
        "deliveryImpact": delivery_impact(current_config, proposed_config),
        "readOnly": True,
    }


def _grade_out(item: Grade) -> dict:
    return {
        "key": item.key,
        "code": item.code,
        "name": item.name,
        "description": item.description,
        "age_range": item.age_range,
        "order": item.order,
        "layout_band": item.layout_band,
        "effective_band": resolve_layout_band(item),
        "active": item.active,
        "revision": item.revision,
        "updated_at": item.updated_at.isoformat(),
    }


def _subject_out(item: Subject) -> dict:
    return {
        "key": item.key,
        "grade_id": item.grade_id,
        "code": item.code,
        "name": item.name,
        "description": item.description,
        "icon": item.icon,
        "color": item.color,
        "order": item.order,
        "active": item.active,
        "revision": item.revision,
        "updated_at": item.updated_at.isoformat(),
    }


async def _catalog_audit(user: User, resource_type: str, action: str, revision: int, summary: dict) -> None:
    await ContentAuditEvent(
        actor_id=str(user.id),
        actor_role=user.role.value if hasattr(user.role, "value") else str(user.role),
        owner_id="system",
        resource_type=resource_type,
        action=action,
        revision=revision,
        summary=summary,
    ).insert()


@router.get("/curriculum-catalog")
async def get_curriculum_catalog(_: User = Depends(get_current_user)):
    grades = await Grade.find_all().sort("order", "name").to_list()
    subjects = await Subject.find_all().sort("grade_id", "order", "name").to_list()
    return {"grades": [_grade_out(item) for item in grades], "subjects": [_subject_out(item) for item in subjects]}


@router.post("/grades", status_code=status.HTTP_201_CREATED)
async def create_grade(body: GradeIn, user: User = Depends(get_current_admin)):
    if body.revision != 0:
        raise HTTPException(status.HTTP_409_CONFLICT, "A new grade must start at revision 0")
    item = Grade(
        **body.model_dump(exclude={"revision"}),
        revision=1,
        created_by=str(user.id),
        updated_by=str(user.id),
    )
    try:
        await item.insert()
    except DuplicateKeyError:
        raise HTTPException(status.HTTP_409_CONFLICT, "Grade key or code already exists")
    await _catalog_audit(user, "grade", "created", item.revision, {"key": item.key, "after": _grade_out(item)})
    return _grade_out(item)


@router.put("/grades/{key}")
async def update_grade(key: str, body: GradeIn, user: User = Depends(get_current_admin)):
    item = await Grade.find_one(Grade.key == key)
    if not item:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Grade not found")
    if body.key != key:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Grade key cannot be changed")
    if body.revision != item.revision:
        raise HTTPException(status.HTTP_409_CONFLICT, "Grade changed in another session; reload before saving")
    before = _grade_out(item)
    for field, value in body.model_dump(exclude={"revision", "key"}).items():
        setattr(item, field, value)
    item.revision += 1
    item.updated_by = str(user.id)
    item.updated_at = datetime.now(timezone.utc)
    try:
        await item.save()
    except DuplicateKeyError:
        raise HTTPException(status.HTTP_409_CONFLICT, "Grade code already exists")
    await _catalog_audit(user, "grade", "updated", item.revision, {"key": key, "before": before, "after": _grade_out(item)})
    return _grade_out(item)


@router.delete("/grades/{key}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_grade(key: str, user: User = Depends(get_current_admin)):
    item = await Grade.find_one(Grade.key == key)
    if not item:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Grade not found")
    if await Subject.find_one(Subject.grade_id == key):
        raise HTTPException(status.HTTP_409_CONFLICT, "Remove this grade's subjects first, or deactivate the grade")
    curricula = await Curriculum.find_all().to_list()
    if any(any(ref.get("id") == key for ref in doc.tree.get("grades", [])) for doc in curricula):
        raise HTTPException(status.HTTP_409_CONFLICT, "Grade is referenced by a curriculum; deactivate it instead")
    await item.delete()
    await _catalog_audit(user, "grade", "deleted", item.revision, {"key": key, "before": _grade_out(item)})


@router.post("/subjects", status_code=status.HTTP_201_CREATED)
async def create_subject(body: SubjectIn, user: User = Depends(get_current_admin)):
    if body.revision != 0:
        raise HTTPException(status.HTTP_409_CONFLICT, "A new subject must start at revision 0")
    if not await Grade.find_one(Grade.key == body.grade_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Selected grade does not exist")
    item = Subject(
        **body.model_dump(exclude={"revision"}),
        revision=1,
        created_by=str(user.id),
        updated_by=str(user.id),
    )
    try:
        await item.insert()
    except DuplicateKeyError:
        raise HTTPException(status.HTTP_409_CONFLICT, "Subject key or grade/code combination already exists")
    await _catalog_audit(user, "subject", "created", item.revision, {"key": item.key, "after": _subject_out(item)})
    return _subject_out(item)


@router.put("/subjects/{key}")
async def update_subject(key: str, body: SubjectIn, user: User = Depends(get_current_admin)):
    item = await Subject.find_one(Subject.key == key)
    if not item:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subject not found")
    if body.key != key:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Subject key cannot be changed")
    if body.grade_id != item.grade_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Subject grade cannot be changed")
    if body.revision != item.revision:
        raise HTTPException(status.HTTP_409_CONFLICT, "Subject changed in another session; reload before saving")
    before = _subject_out(item)
    for field, value in body.model_dump(exclude={"revision", "key", "grade_id"}).items():
        setattr(item, field, value)
    item.revision += 1
    item.updated_by = str(user.id)
    item.updated_at = datetime.now(timezone.utc)
    try:
        await item.save()
    except DuplicateKeyError:
        raise HTTPException(status.HTTP_409_CONFLICT, "Subject code already exists for this grade")
    await _catalog_audit(user, "subject", "updated", item.revision, {"key": key, "before": before, "after": _subject_out(item)})
    return _subject_out(item)


@router.delete("/subjects/{key}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subject(key: str, user: User = Depends(get_current_admin)):
    item = await Subject.find_one(Subject.key == key)
    if not item:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subject not found")
    curricula = await Curriculum.find_all().to_list()
    if any(any(ref.get("id") == key for ref in doc.tree.get("subjects", [])) for doc in curricula):
        raise HTTPException(status.HTTP_409_CONFLICT, "Subject is referenced by a curriculum; deactivate it instead")
    await item.delete()
    await _catalog_audit(user, "subject", "deleted", item.revision, {"key": key, "before": _subject_out(item)})
