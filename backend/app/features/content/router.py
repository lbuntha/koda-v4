"""Owner-scoped authored content: curriculum, question deck, and SVG library.
Whole-document GET/PUT mirrors the frontend's localStorage read/write."""

from datetime import datetime, timezone
from uuid import uuid4

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from ...models.user import Role, User
from ...models.content import Curriculum, CurriculumRelease, QuestionDeck, SvgLibrary
from ...models.academic import Grade, Subject
from ...models.audit import ContentAuditEvent
from ...core.logging import get_logger
from ...core.deps import get_current_admin, get_current_student, get_current_user
from ...core.runtime_settings import get_system_settings
from ...models.student import Student
from ...models.assignment import Assignment, CurriculumOffering, Placement, ProgressionState
from ...models.mastery import MasteryState
from .offerings import release_includes
from .placement import select_delivery_skill_ids
from .release import (
    ReleaseValidationError,
    build_question_manifest,
    build_release_payload,
    content_hash,
    content_hashes,
)
from .schemas import CurriculumArchiveIn, CurriculumCreateIn, CurriculumIn, CurriculumRolloutIn, QuestionsIn, SvgLibraryIn

logger = get_logger("content")

router = APIRouter(tags=["content"])


def analyze_curriculum_impact(before: dict | None, after: dict) -> dict:
    """Classify changes by their effect on an in-flight learning path."""
    if before is None:
        return {
            "level": "initial",
            "addedSkills": _item_summaries(after.get("skills", []), [item.get("id") for item in after.get("skills", []) if item.get("id")]),
            "removedSkills": [],
            "structuralChanges": [],
        }
    old_skills = {item.get("id"): item for item in before.get("skills", []) if item.get("id")}
    new_skills = {item.get("id"): item for item in after.get("skills", []) if item.get("id")}
    old_units = {item.get("id"): item for item in before.get("units", []) if item.get("id")}
    new_units = {item.get("id"): item for item in after.get("units", []) if item.get("id")}
    added = sorted(set(new_skills) - set(old_skills))
    removed = sorted(set(old_skills) - set(new_skills))
    structural: list[dict] = []
    for skill_id in sorted(set(old_skills) & set(new_skills)):
        old, new = old_skills[skill_id], new_skills[skill_id]
        changed = [
            field for field in ("unitId", "order", "prerequisiteSkillIds", "placementCheckpoint")
            if old.get(field) != new.get(field)
        ]
        if changed:
            structural.append({"id": skill_id, "label": new.get("label") or skill_id, "fields": changed})
    removed_units = sorted(set(old_units) - set(new_units))
    for unit_id in sorted(set(old_units) & set(new_units)):
        old, new = old_units[unit_id], new_units[unit_id]
        changed = [
            field for field in ("subjectId", "order")
            if old.get(field) != new.get(field)
        ]
        if changed:
            structural.append({"id": unit_id, "label": new.get("label") or unit_id, "fields": changed})
    catalog_changed = any(
        {item.get("id") for item in before.get(key, [])} != {item.get("id") for item in after.get(key, [])}
        for key in ("grades", "subjects")
    )
    major = bool(removed or removed_units or structural or catalog_changed)
    minor = bool(added or set(new_units) - set(old_units))
    return {
        "level": "major" if major else "minor" if minor else "patch",
        "addedSkills": _item_summaries(after.get("skills", []), added),
        "removedSkills": _item_summaries(before.get("skills", []), removed),
        "structuralChanges": structural,
    }


def apply_delivery_impact(impact: dict, before_manifest: list[dict], after_manifest: list[dict]) -> dict:
    """Escalate when a previously playable skill would lose all activities."""
    before_skills = {item.get("skill_id") for item in before_manifest if item.get("skill_id")}
    after_skills = {item.get("skill_id") for item in after_manifest if item.get("skill_id")}
    lost_delivery = sorted(before_skills - after_skills)
    if not lost_delivery:
        return impact
    existing = {item.get("id") for item in impact["structuralChanges"]}
    labels = {
        item.get("id"): item.get("label") or item.get("id")
        for item in impact.get("removedSkills", []) + impact.get("addedSkills", [])
    }
    changes = [*impact["structuralChanges"]]
    for skill_id in lost_delivery:
        if skill_id not in existing:
            changes.append({"id": skill_id, "label": labels.get(skill_id, skill_id), "fields": ["activities"]})
    return {**impact, "level": "major", "structuralChanges": changes}


def ensure_rollout_is_safe(impact_level: str, strategy: str) -> None:
    if impact_level == "major" and strategy == "active_learners":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Major curriculum changes can only be published for new learners. Keep current learners on their existing release.",
        )


def _role_value(user: User) -> str:
    return user.role.value if hasattr(user.role, "value") else str(user.role)


def _changed_ids(before: list[dict], after: list[dict]) -> dict:
    old = {item.get("id"): item for item in before if item.get("id")}
    new = {item.get("id"): item for item in after if item.get("id")}
    return {
        "added": sorted(set(new) - set(old)),
        "removed": sorted(set(old) - set(new)),
        "updated": sorted(key for key in set(old) & set(new) if old[key] != new[key]),
    }


def _metadata(tree: dict) -> dict:
    return {
        "title": tree.get("title", ""),
        "description": tree.get("description", ""),
        "version": tree.get("version", ""),
        "primaryGradeId": tree.get("primaryGradeId"),
        "primarySubjectId": tree.get("primarySubjectId"),
    }


def _changed_fields(before: dict, after: dict) -> list[str]:
    return sorted(key for key in set(before) | set(after) if before.get(key) != after.get(key))


def _item_summaries(items: list[dict], ids: list[str]) -> list[dict]:
    by_id = {item.get("id"): item for item in items}
    return [
        {"id": item_id, "label": by_id.get(item_id, {}).get("label", item_id)}
        for item_id in ids
    ]


async def _audit(
    user: User,
    owner_id: str,
    resource_type: str,
    action: str,
    revision: int,
    summary: dict,
    curriculum_id: str | None = None,
) -> None:
    await ContentAuditEvent(
        actor_id=str(user.id),
        actor_role=_role_value(user),
        owner_id=owner_id,
        resource_type=resource_type,
        curriculum_id=curriculum_id,
        action=action,
        revision=revision,
        summary=summary,
    ).insert()


async def _resolved_tree(tree: dict) -> dict:
    """Hydrate lightweight curriculum references from the canonical catalogs."""
    output = {**tree}
    grade_catalog = {item.key: item for item in await Grade.find_all().to_list()}
    subject_catalog = {item.key: item for item in await Subject.find_all().to_list()}
    grade_refs = list(tree.get("grades", []))
    subject_refs = list(tree.get("subjects", []))
    output["grades"] = [
        {
            "id": ref.get("id"),
            "label": grade_catalog[ref.get("id")].name,
            "order": ref.get("order", grade_catalog[ref.get("id")].order),
            "description": grade_catalog[ref.get("id")].description,
            "ageRange": grade_catalog[ref.get("id")].age_range,
            "code": grade_catalog[ref.get("id")].code,
            "active": grade_catalog[ref.get("id")].active,
        }
        if ref.get("id") in grade_catalog else ref
        for ref in grade_refs
    ]
    output["subjects"] = [
        {
            "id": ref.get("id"),
            "gradeId": subject_catalog[ref.get("id")].grade_id,
            "label": subject_catalog[ref.get("id")].name,
            "order": ref.get("order", subject_catalog[ref.get("id")].order),
            "description": subject_catalog[ref.get("id")].description,
            "code": subject_catalog[ref.get("id")].code,
            "icon": subject_catalog[ref.get("id")].icon,
            "color": subject_catalog[ref.get("id")].color,
            "active": subject_catalog[ref.get("id")].active,
        }
        if ref.get("id") in subject_catalog else ref
        for ref in subject_refs
    ]
    output["grades"].sort(key=lambda item: (item.get("order", 0), item.get("label", "")))
    output["subjects"].sort(key=lambda item: (item.get("gradeId", ""), item.get("order", 0), item.get("label", "")))
    return output


async def _curriculum_references(tree: dict) -> dict:
    """Validate catalog relations and store only grade/subject reference data."""
    grade_ids = [item.get("id") for item in tree.get("grades", [])]
    subject_ids = [item.get("id") for item in tree.get("subjects", [])]
    grades = {item.key: item for item in await Grade.find({"key": {"$in": grade_ids}}).to_list()}
    subjects = {item.key: item for item in await Subject.find({"key": {"$in": subject_ids}}).to_list()}
    missing_grades = sorted(set(grade_ids) - set(grades))
    missing_subjects = sorted(set(subject_ids) - set(subjects))
    if missing_grades or missing_subjects:
        missing = [*(f"grade:{key}" for key in missing_grades), *(f"subject:{key}" for key in missing_subjects)]
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Curriculum references missing catalog records: {', '.join(missing)}")
    invalid_relations = [key for key, subject in subjects.items() if subject.grade_id not in grade_ids]
    if invalid_relations:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Subjects require their catalog grade: {', '.join(sorted(invalid_relations))}")
    primary_grade_id = tree.get("primaryGradeId")
    primary_subject_id = tree.get("primarySubjectId")
    if primary_grade_id and primary_grade_id not in grades:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Primary grade is not part of this curriculum")
    if primary_subject_id:
        primary_subject = subjects.get(primary_subject_id)
        if not primary_subject:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Primary subject is not part of this curriculum")
        if primary_grade_id and primary_subject.grade_id != primary_grade_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Primary subject does not belong to the primary grade")
    output = {**tree}
    output["grades"] = [{"id": item["id"], "order": item.get("order", grades[item["id"]].order)} for item in tree["grades"]]
    output["subjects"] = [
        {"id": item["id"], "gradeId": subjects[item["id"]].grade_id, "order": item.get("order", subjects[item["id"]].order)}
        for item in tree["subjects"]
    ]
    return output


# ── Curriculum tree ──────────────────────────────────────────────────────────

def _owner_out(user: User) -> dict:
    return {
        "id": str(user.id),
        "name": user.name,
        "email": str(user.email),
        "role": _role_value(user),
    }


async def _ensure_curriculum_id(doc: Curriculum) -> str:
    if doc.curriculum_id:
        return doc.curriculum_id
    doc.curriculum_id = str(doc.id) if doc.id else uuid4().hex
    await doc.save()
    return doc.curriculum_id


async def _curriculum_out(doc: Curriculum, user: User) -> dict:
    curriculum_id = await _ensure_curriculum_id(doc)
    return {
        "exists": True,
        "id": curriculum_id,
        "tree": await _resolved_tree(doc.tree),
        "revision": doc.revision,
        "published": doc.published,
        "archived": doc.archived_at is not None,
        "owner": _owner_out(user),
        "createdAt": doc.created_at,
        "updatedAt": doc.updated_at,
    }


async def _save_curriculum(body: CurriculumIn, user: User, doc: Curriculum | None) -> Curriculum:
    owner_id = str(user.id)
    stored_tree = await _curriculum_references(body.tree)
    other_filter: dict = {"owner_id": owner_id}
    if doc:
        current_curriculum_id = await _ensure_curriculum_id(doc)
        other_filter["curriculum_id"] = {"$ne": current_curriculum_id}
    other_curricula = await Curriculum.find(other_filter).to_list()
    other_skill_ids = {
        skill.get("id")
        for curriculum in other_curricula
        for skill in curriculum.tree.get("skills", [])
        if skill.get("id")
    }
    duplicate_skill_ids = sorted({skill.get("id") for skill in body.tree.get("skills", [])} & other_skill_ids)
    if duplicate_skill_ids:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Skill ids are already used by another curriculum: {', '.join(duplicate_skill_ids)}",
        )
    if doc:
        if body.revision != doc.revision:
            raise HTTPException(status.HTTP_409_CONFLICT, "Curriculum changed in another session; reload before saving")
        curriculum_id = await _ensure_curriculum_id(doc)
        before = await _resolved_tree(doc.tree)
        published_changed = doc.published != body.published
        doc.tree = stored_tree
        doc.published = body.published
        doc.revision += 1
        doc.updated_at = datetime.now(timezone.utc)
        await doc.save()
    else:
        if body.revision != 0:
            raise HTTPException(status.HTTP_409_CONFLICT, "Curriculum revision is stale")
        curriculum_id = uuid4().hex
        before = {"grades": [], "subjects": [], "units": [], "skills": []}
        published_changed = body.published
        doc = Curriculum(
            curriculum_id=curriculum_id,
            owner_id=owner_id,
            tree=stored_tree,
            published=body.published,
            revision=1,
        )
        await doc.insert()

    changes = {key: _changed_ids(before.get(key, []), body.tree.get(key, [])) for key in ("grades", "subjects", "units", "skills")}
    if doc.revision == 1:
        await _audit(user, owner_id, "curriculum", "created", doc.revision, {
            "metadata": _metadata(body.tree),
            "counts": {key: len(body.tree.get(key, [])) for key in ("grades", "subjects", "units", "skills")},
            "published": body.published,
        }, curriculum_id)
    else:
        before_metadata = _metadata(before)
        after_metadata = _metadata(body.tree)
        metadata_fields = _changed_fields(before_metadata, after_metadata)
        if metadata_fields:
            await _audit(user, owner_id, "curriculum", "metadata_updated", doc.revision, {
                "changedFields": metadata_fields,
                "before": before_metadata,
                "after": after_metadata,
            }, curriculum_id)
        if published_changed:
            await _audit(
                user,
                owner_id,
                "curriculum",
                "published" if body.published else "unpublished",
                doc.revision,
                {"published": body.published},
                curriculum_id,
            )
        for resource_key in ("units", "skills"):
            singular = resource_key[:-1]
            for change_key, action_suffix in (("added", "added"), ("updated", "updated"), ("removed", "removed")):
                ids = changes[resource_key][change_key]
                if not ids:
                    continue
                source = before.get(resource_key, []) if change_key == "removed" else body.tree.get(resource_key, [])
                await _audit(user, owner_id, "curriculum", f"{singular}_{action_suffix}", doc.revision, {
                    "items": _item_summaries(source, ids),
                }, curriculum_id)
        reference_changes = {key: changes[key] for key in ("grades", "subjects") if any(changes[key].values())}
        if reference_changes:
            await _audit(user, owner_id, "curriculum", "scope_updated", doc.revision, reference_changes, curriculum_id)
        if not metadata_fields and not published_changed and not reference_changes and not any(
            any(changes[key].values()) for key in ("units", "skills")
        ):
            await _audit(user, owner_id, "curriculum", "saved", doc.revision, {}, curriculum_id)
    return doc


@router.get("/curricula")
async def list_curricula(user: User = Depends(get_current_user)):
    documents = await Curriculum.find(Curriculum.owner_id == str(user.id)).sort("-updated_at").to_list()
    grade_catalog = {item.key: item for item in await Grade.find_all().to_list()}
    subject_catalog = {item.key: item for item in await Subject.find_all().to_list()}
    rows = []
    for doc in documents:
        curriculum_id = await _ensure_curriculum_id(doc)
        grade_ids = [item.get("id") for item in doc.tree.get("grades", [])]
        subject_ids = [item.get("id") for item in doc.tree.get("subjects", [])]
        rows.append({
            "id": curriculum_id,
            "title": doc.tree.get("title") or "Untitled curriculum",
            "description": doc.tree.get("description") or "",
            "version": doc.tree.get("version") or "1.0",
            "grades": [{"id": key, "label": grade_catalog[key].name if key in grade_catalog else key} for key in grade_ids],
            "subjects": [{"id": key, "label": subject_catalog[key].name if key in subject_catalog else key} for key in subject_ids],
            "primaryGradeId": doc.tree.get("primaryGradeId") or (grade_ids[0] if grade_ids else None),
            "primarySubjectId": doc.tree.get("primarySubjectId") or (subject_ids[0] if subject_ids else None),
            "status": "archived" if doc.archived_at else "published" if doc.published else "draft",
            "revision": doc.revision,
            "unitCount": len(doc.tree.get("units", [])),
            "skillCount": len(doc.tree.get("skills", [])),
            "createdAt": doc.created_at,
            "updatedAt": doc.updated_at,
            "owner": _owner_out(user),
        })
    return {"curricula": rows}


@router.post("/curricula", status_code=status.HTTP_201_CREATED)
async def create_curriculum(body: CurriculumCreateIn, user: User = Depends(get_current_user)):
    grade = await Grade.find_one(Grade.key == body.primary_grade_id)
    subject = await Subject.find_one(Subject.key == body.primary_subject_id)
    if not grade or not grade.active:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Selected grade is unavailable")
    if not subject or not subject.active or subject.grade_id != grade.key:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Selected subject is unavailable for this grade")
    tree = {
        "id": uuid4().hex,
        "title": body.title.strip(),
        "description": body.description.strip(),
        "version": body.version.strip(),
        "primaryGradeId": grade.key,
        "primarySubjectId": subject.key,
        "grades": [{"id": grade.key, "order": grade.order}],
        "subjects": [{"id": subject.key, "gradeId": grade.key, "order": subject.order}],
        "units": [],
        "skills": [],
    }
    doc = await _save_curriculum(CurriculumIn(tree=tree, revision=0, published=False), user, None)
    return await _curriculum_out(doc, user)


@router.get("/curricula/{curriculum_id}")
async def get_curriculum_by_id(curriculum_id: str, user: User = Depends(get_current_user)):
    doc = await Curriculum.find_one({"curriculum_id": curriculum_id, "owner_id": str(user.id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Curriculum not found")
    return await _curriculum_out(doc, user)


@router.put("/curricula/{curriculum_id}")
async def put_curriculum_by_id(curriculum_id: str, body: CurriculumIn, user: User = Depends(get_current_user)):
    doc = await Curriculum.find_one({"curriculum_id": curriculum_id, "owner_id": str(user.id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Curriculum not found")
    if doc.archived_at:
        raise HTTPException(status.HTTP_409_CONFLICT, "Restore this curriculum before editing")
    saved = await _save_curriculum(body, user, doc)
    return {"ok": True, "revision": saved.revision, "updatedAt": saved.updated_at}


@router.patch("/curricula/{curriculum_id}/archive")
async def archive_curriculum(curriculum_id: str, body: CurriculumArchiveIn, user: User = Depends(get_current_user)):
    doc = await Curriculum.find_one({"curriculum_id": curriculum_id, "owner_id": str(user.id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Curriculum not found")
    is_archived = doc.archived_at is not None
    if is_archived != body.archived:
        doc.archived_at = datetime.now(timezone.utc) if body.archived else None
        if body.archived:
            doc.published = False
        doc.revision += 1
        doc.updated_at = datetime.now(timezone.utc)
        await doc.save()
        await _audit(
            user,
            str(user.id),
            "curriculum",
            "archived" if body.archived else "restored",
            doc.revision,
            {"archived": body.archived},
            curriculum_id,
        )
    return await _curriculum_out(doc, user)

# ── Immutable releases (Phase 0) ─────────────────────────────────────────────

async def _next_release_revision(curriculum_id: str) -> int:
    """Release revisions are their own monotonic sequence, independent of the
    draft's mutable `revision` — so an immutable release number never rewinds
    even if the draft is edited and re-saved between publishes."""
    latest = (
        await CurriculumRelease.find(CurriculumRelease.curriculum_id == curriculum_id)
        .sort("-revision")
        .first_or_none()
    )
    return (latest.revision + 1) if latest else 1


async def _publish_release(doc: Curriculum, user: User) -> CurriculumRelease:
    """Resolve the draft (hydrated tree + owner's questions + assets) into one
    validated, hashed, immutable `CurriculumRelease`."""
    owner_id = doc.owner_id
    resolved_tree = await _resolved_tree(doc.tree)
    deck = await QuestionDeck.find_one(QuestionDeck.owner_id == owner_id)
    svg = await SvgLibrary.find_one(SvgLibrary.owner_id == owner_id)

    try:
        payload = build_release_payload(
            tree=resolved_tree,
            questions=deck.questions if deck else [],
            assets=svg.assets if svg else [],
            technique_thumbnails=svg.technique_thumbnails if svg else {},
        )
    except ReleaseValidationError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Cannot publish release: {exc}")

    curriculum_id = await _ensure_curriculum_id(doc)
    revision = await _next_release_revision(curriculum_id)
    release = CurriculumRelease(
        release_id=uuid4().hex,
        curriculum_id=curriculum_id,
        owner_id=owner_id,
        revision=revision,
        tree=payload["tree"],
        question_manifest=payload["question_manifest"],
        asset_manifest=payload["asset_manifest"],
        content_hashes=payload["content_hashes"],
        published_by=str(user.id),
    )
    await release.insert()
    await _audit(user, owner_id, "curriculum_release", "published", revision, {
        "releaseId": release.release_id,
        "counts": {
            "skills": len(resolved_tree.get("skills", [])),
            "questions": len(payload["question_manifest"]),
            "assets": len(payload["asset_manifest"]),
        },
        "contentHashes": payload["content_hashes"],
    }, curriculum_id)
    return release


def _release_out(release: CurriculumRelease) -> dict:
    """Summary view — never returns the private `grading` blobs in the manifest."""
    return {
        "releaseId": release.release_id,
        "curriculumId": release.curriculum_id,
        "revision": release.revision,
        "questionCount": len(release.question_manifest),
        "assetCount": len(release.asset_manifest),
        "contentHashes": release.content_hashes,
        "publishedBy": release.published_by,
        "publishedAt": release.published_at,
    }


async def _latest_release(curriculum_id: str) -> CurriculumRelease | None:
    return (
        await CurriculumRelease.find(CurriculumRelease.curriculum_id == curriculum_id)
        .sort("-revision")
        .first_or_none()
    )


async def _release_impact(
    doc: Curriculum,
    *,
    grade_id: str | None = None,
    subject_id: str | None = None,
) -> dict:
    curriculum_id = await _ensure_curriculum_id(doc)
    latest = await _latest_release(curriculum_id)
    resolved_tree = await _resolved_tree(doc.tree)
    impact = analyze_curriculum_impact(latest.tree if latest else None, resolved_tree)
    deck = await QuestionDeck.find_one(QuestionDeck.owner_id == doc.owner_id)
    svg = await SvgLibrary.find_one(SvgLibrary.owner_id == doc.owner_id)
    try:
        prospective = build_release_payload(
            tree=resolved_tree,
            questions=deck.questions if deck else [],
            assets=svg.assets if svg else [],
            technique_thumbnails=svg.technique_thumbnails if svg else {},
        )
    except ReleaseValidationError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Cannot publish release: {exc}")
    impact = apply_delivery_impact(
        impact,
        latest.question_manifest if latest else [],
        prospective["question_manifest"],
    )

    assignment_filter: dict = {
        "curriculum_id": curriculum_id,
        "status": "active",
    }
    if grade_id:
        assignment_filter["grade_id"] = grade_id
    if subject_id:
        assignment_filter["subject_id"] = subject_id
    assignments = await Assignment.find(assignment_filter).to_list()
    learner_ids = {item.student_id for item in assignments}
    removed_skill_ids = [item["id"] for item in impact["removedSkills"]]
    affected_learner_ids: set[str] = set()
    if learner_ids and removed_skill_ids:
        mastery_rows = await MasteryState.find({
            "curriculum_id": curriculum_id,
            "student_id": {"$in": list(learner_ids)},
            "skill_id": {"$in": removed_skill_ids},
            "plays": {"$gt": 0},
        }).to_list()
        affected_learner_ids = {item.student_id for item in mastery_rows}

    return {
        **impact,
        "currentRelease": _release_out(latest) if latest else None,
        "activeAssignments": len(assignments),
        "activeLearners": len(learner_ids),
        "affectedLearners": len(affected_learner_ids),
    }


@router.get("/curricula/{curriculum_id}/release-impact")
async def get_release_impact(
    curriculum_id: str,
    grade_id: str | None = None,
    subject_id: str | None = None,
    user: User = Depends(get_current_user),
):
    doc = await Curriculum.find_one({"curriculum_id": curriculum_id, "owner_id": str(user.id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Curriculum not found")
    if bool(grade_id) != bool(subject_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Choose both a grade and subject")
    if grade_id and subject_id:
        resolved_tree = await _resolved_tree(doc.tree)
        if not release_includes(resolved_tree, grade_id, subject_id):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Draft does not include this grade and subject")
    return await _release_impact(doc, grade_id=grade_id, subject_id=subject_id)


@router.post("/curricula/{curriculum_id}/publish-rollout", status_code=status.HTTP_201_CREATED)
async def publish_and_rollout(
    curriculum_id: str,
    body: CurriculumRolloutIn,
    user: User = Depends(get_current_admin),
):
    """Publish once, update the offering, and optionally migrate safe active assignments."""
    doc = await Curriculum.find_one({"curriculum_id": curriculum_id, "owner_id": str(user.id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Curriculum not found")
    if doc.archived_at:
        raise HTTPException(status.HTTP_409_CONFLICT, "Restore this curriculum before publishing")

    grade = await Grade.find_one(Grade.key == body.grade_id)
    subject = await Subject.find_one(Subject.key == body.subject_id, Subject.grade_id == body.grade_id)
    if not grade or not subject:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Selected subject does not belong to this grade")
    if not grade.active or not subject.active:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Activate the grade and subject before publishing")

    impact = await _release_impact(doc, grade_id=body.grade_id, subject_id=body.subject_id)
    resolved_tree = await _resolved_tree(doc.tree)
    if not release_includes(resolved_tree, body.grade_id, body.subject_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Draft does not include this grade and subject")
    ensure_rollout_is_safe(impact["level"], body.strategy)

    release = await _publish_release(doc, user)
    now = datetime.now(timezone.utc)
    offering = await CurriculumOffering.find_one(
        CurriculumOffering.grade_id == body.grade_id,
        CurriculumOffering.subject_id == body.subject_id,
    )
    if offering:
        offering.curriculum_id = curriculum_id
        offering.release_id = release.release_id
        offering.active = True
        offering.revision += 1
        offering.updated_by = str(user.id)
        offering.updated_at = now
        await offering.save()
    else:
        offering = CurriculumOffering(
            grade_id=body.grade_id,
            subject_id=body.subject_id,
            curriculum_id=curriculum_id,
            release_id=release.release_id,
            active=True,
            created_by=str(user.id),
            updated_by=str(user.id),
        )
        await offering.insert()

    updated_assignments: list[Assignment] = []
    if body.strategy == "active_learners":
        updated_assignments = await Assignment.find({
            "curriculum_id": curriculum_id,
            "grade_id": body.grade_id,
            "subject_id": body.subject_id,
            "status": "active",
        }).to_list()
        for assignment in updated_assignments:
            assignment.release_id = release.release_id
            assignment.updated_at = now
            await assignment.save()
            progression = await ProgressionState.find_one(
                ProgressionState.student_id == assignment.student_id,
                ProgressionState.assignment_id == str(assignment.id),
            )
            if progression:
                progression.release_id = release.release_id
                progression.updated_at = now
                await progression.save()

    learner_ids = {item.student_id for item in updated_assignments}
    await _audit(
        user,
        str(user.id),
        "curriculum_rollout",
        body.strategy,
        release.revision,
        {
            "releaseId": release.release_id,
            "gradeId": body.grade_id,
            "subjectId": body.subject_id,
            "impactLevel": impact["level"],
            "activeAssignmentsBeforePublish": impact["activeAssignments"],
            "assignmentsUpdated": len(updated_assignments),
            "learnersUpdated": len(learner_ids),
        },
        curriculum_id,
    )
    doc.published = True
    doc.updated_at = now
    await doc.save()
    return {
        "release": _release_out(release),
        "rollout": {
            "strategy": body.strategy,
            "impactLevel": impact["level"],
            "offeringUpdated": True,
            "assignmentsUpdated": len(updated_assignments),
            "learnersUpdated": len(learner_ids),
        },
    }


@router.post("/curricula/{curriculum_id}/releases", status_code=status.HTTP_201_CREATED)
async def publish_release(curriculum_id: str, user: User = Depends(get_current_user)):
    doc = await Curriculum.find_one({"curriculum_id": curriculum_id, "owner_id": str(user.id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Curriculum not found")
    if doc.archived_at:
        raise HTTPException(status.HTTP_409_CONFLICT, "Restore this curriculum before publishing")
    release = await _publish_release(doc, user)
    return _release_out(release)


@router.get("/curricula/{curriculum_id}/drift")
async def get_release_drift(curriculum_id: str, user: User = Depends(get_current_user)):
    """Does the draft still say what the newest release says?

    Editing a published curriculum changes nothing for anyone assigned to it — only
    publishing does — and until now nothing said so. That silence has cost real time twice:
    Grade 1 Mathematics carried rewards its only release never had, and a sorting ladder sat
    at 40 authored levels while learners played the 24 in the release.

    Compared by the release's own content hashes, so "different" here means exactly what it
    will mean when the next release is cut. Deliberately does not validate the draft: a draft
    that cannot publish yet is still worth telling the author has drifted.
    """
    doc = await Curriculum.find_one({"curriculum_id": curriculum_id, "owner_id": str(user.id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Curriculum not found")

    latest = (
        await CurriculumRelease.find(CurriculumRelease.curriculum_id == curriculum_id)
        .sort("-revision")
        .first_or_none()
    )
    if not latest:
        return {"hasRelease": False, "revision": None, "drifted": [], "publishedAt": None}

    resolved_tree = await _resolved_tree(doc.tree)
    deck = await QuestionDeck.find_one(QuestionDeck.owner_id == doc.owner_id)
    svg = await SvgLibrary.find_one(SvgLibrary.owner_id == doc.owner_id)
    skills_by_id = {
        skill.get("id"): skill
        for skill in resolved_tree.get("skills", [])
        if isinstance(skill, dict) and skill.get("id")
    }
    draft_hashes = content_hashes(
        tree=resolved_tree,
        question_manifest=build_question_manifest(
            deck.questions if deck else [],
            set(skills_by_id),
            skills_by_id=skills_by_id,
            technique_thumbnails=svg.technique_thumbnails if svg else {},
        ),
        asset_manifest=[
            {"content_hash": content_hash(asset)} for asset in (svg.assets if svg else [])
        ],
    )
    drifted = [
        part for part, digest in draft_hashes.items()
        if latest.content_hashes.get(part) != digest
    ]
    return {
        "hasRelease": True,
        "revision": latest.revision,
        "drifted": drifted,
        "publishedAt": latest.published_at,
    }


@router.get("/curricula/{curriculum_id}/releases")
async def list_releases(curriculum_id: str, user: User = Depends(get_current_user)):
    owned = await Curriculum.find_one({"curriculum_id": curriculum_id, "owner_id": str(user.id)})
    if not owned:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Curriculum not found")
    releases = (
        await CurriculumRelease.find(CurriculumRelease.curriculum_id == curriculum_id)
        .sort("-revision")
        .to_list()
    )
    return {"releases": [_release_out(r) for r in releases]}


@router.get("/curriculum")
async def get_curriculum(user: User = Depends(get_current_user)):
    doc = await Curriculum.find({"owner_id": str(user.id), "archived_at": None}).sort("-updated_at").first_or_none()
    if doc:
        return await _curriculum_out(doc, user)
    return {"exists": False, "id": None, "tree": None, "revision": 0, "published": False, "archived": False, "owner": _owner_out(user), "createdAt": None, "updatedAt": None}


@router.put("/curriculum")
async def put_curriculum(body: CurriculumIn, user: User = Depends(get_current_user)):
    owner_id = str(user.id)
    doc = await Curriculum.find({"owner_id": owner_id, "archived_at": None}).sort("-updated_at").first_or_none()
    saved = await _save_curriculum(body, user, doc)
    return {"ok": True, "revision": saved.revision, "updatedAt": saved.updated_at}


# ── Question deck ────────────────────────────────────────────────────────────

@router.get("/questions")
async def get_questions(user: User = Depends(get_current_user)):
    doc = await QuestionDeck.find_one(QuestionDeck.owner_id == str(user.id))
    if not doc:
        return {"exists": False, "questions": [], "revision": 0}
    return {"exists": True, "questions": doc.questions, "revision": doc.revision}


@router.put("/questions")
async def put_questions(body: QuestionsIn, user: User = Depends(get_current_user)):
    owner_id = str(user.id)
    doc = await QuestionDeck.find_one(QuestionDeck.owner_id == owner_id)
    curricula = await Curriculum.find({"owner_id": owner_id, "archived_at": None}).to_list()
    if curricula:
        valid_skill_ids = {
            skill.get("id")
            for curriculum in curricula
            for skill in curriculum.tree.get("skills", [])
        }
        # Only references this request *introduces* are rejected.
        #
        # Validating the whole deck deadlocked the studio: deleting one skill in the
        # curriculum studio orphaned a question, and from then on every save of the entire
        # 110-question deck failed with 400 — including saves that had nothing to do with the
        # orphan, and including the deck the server itself had just served. There was no way
        # out from inside the app. A pre-existing orphan is now carried through untouched and
        # logged, so authoring keeps working while the inconsistency stays visible.
        already_referenced = {
            question.get("skillId")
            for question in (doc.questions if doc else [])
            if question.get("skillId")
        }
        referenced = {q.get("skillId") for q in body.questions if q.get("skillId")}
        invalid = sorted((referenced - valid_skill_ids) - already_referenced)
        if invalid:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Questions reference missing curriculum skills: {', '.join(invalid)}")
        stale = sorted((referenced & already_referenced) - valid_skill_ids)
        if stale:
            logger.warning(
                "question deck references deleted skills owner_id=%s skills=%s",
                owner_id, stale,
            )
    if doc:
        if body.revision != doc.revision:
            raise HTTPException(status.HTTP_409_CONFLICT, "Question deck changed in another session; reload before saving")
        before = doc.questions
        doc.questions = body.questions
        doc.revision += 1
        doc.updated_at = datetime.now(timezone.utc)
        await doc.save()
    else:
        if body.revision != 0:
            raise HTTPException(status.HTTP_409_CONFLICT, "Question deck revision is stale")
        before = []
        doc = QuestionDeck(owner_id=owner_id, questions=body.questions, revision=1)
        await doc.insert()
    await _audit(
        user,
        owner_id,
        "question_deck",
        "created" if doc.revision == 1 else "updated",
        doc.revision,
        _changed_ids(before, body.questions),
    )
    before_by_id = {item.get("id"): item for item in before}
    after_by_id = {item.get("id"): item for item in body.questions}
    assignments = []
    for question_id in sorted(set(before_by_id) | set(after_by_id)):
        previous = before_by_id.get(question_id, {})
        current = after_by_id.get(question_id, {})
        before_skill_id = previous.get("skillId")
        after_skill_id = current.get("skillId")
        if before_skill_id == after_skill_id:
            continue
        assignments.append({
            "questionId": question_id,
            "title": current.get("title") or previous.get("title") or question_id,
            "beforeSkillId": before_skill_id,
            "afterSkillId": after_skill_id,
        })
    if assignments:
        skill_curricula = {
            skill.get("id"): curriculum.curriculum_id
            for curriculum in curricula
            for skill in curriculum.tree.get("skills", [])
            if skill.get("id") and curriculum.curriculum_id
        }
        assignments_by_curriculum: dict[str, list[dict]] = {}
        for assignment in assignments:
            curriculum_ids = {
                skill_curricula.get(assignment.get("beforeSkillId")),
                skill_curricula.get(assignment.get("afterSkillId")),
            } - {None}
            for curriculum_id in curriculum_ids:
                assignments_by_curriculum.setdefault(curriculum_id, []).append(assignment)
        for curriculum_id, curriculum_assignments in assignments_by_curriculum.items():
            await _audit(user, owner_id, "curriculum", "worksheet_assignment_changed", doc.revision, {
                "assignments": curriculum_assignments,
            }, curriculum_id)
    return {"ok": True, "revision": doc.revision}


@router.get("/learning/curriculum")
async def get_published_curriculum(student: Student = Depends(get_current_student)):
    """Deliver the immutable release and skill selected by the kid's assignment.

    Placement and learning must use the same pinned release. Selecting the newest
    global release here would make the stored placement irreproducible and could
    send a student into another teacher's curriculum.
    """
    assignments = await Assignment.find(
        Assignment.student_id == str(student.id),
        Assignment.status == "active",
    ).sort("priority", "created_at").to_list()
    if not assignments:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No active curriculum assignment is available")

    assignment = assignments[0]
    release = await CurriculumRelease.find_one(CurriculumRelease.release_id == assignment.release_id)
    if not release:
        raise HTTPException(status.HTTP_409_CONFLICT, "The assigned curriculum release is no longer available")

    progression = await ProgressionState.find_one(
        ProgressionState.student_id == str(student.id),
        ProgressionState.assignment_id == str(assignment.id),
    )
    if assignment.placement_required and not progression:
        pending = await Placement.find_one(
            Placement.student_id == str(student.id),
            Placement.assignment_id == str(assignment.id),
        )
        if not pending or pending.status in {"pending", "in_progress"}:
            raise HTTPException(status.HTTP_409_CONFLICT, "Complete placement before starting this assignment")

    available_skill_ids = {
        entry.get("skill_id")
        for entry in release.question_manifest
        if entry.get("skill_id")
    }
    delivery_skill_ids = select_delivery_skill_ids(
        release.tree,
        assignment.scope,
        progression.frontier_skill_id if progression else None,
        progression.eligible_skill_ids if progression else [],
        available_skill_ids,
    )
    if not delivery_skill_ids:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "The assigned curriculum has no playable questions in scope")

    questions = []
    for entry in release.question_manifest:
        if entry.get("skill_id") not in delivery_skill_ids:
            continue
        playable = dict(entry.get("playable") or {})
        playable.setdefault("difficulty", entry.get("difficulty", "medium"))
        questions.append(playable)
    return {
        "assignmentId": str(assignment.id),
        "releaseId": release.release_id,
        "curriculumId": release.curriculum_id,
        "revision": release.revision,
        "tree": release.tree,
        "questions": questions,
        # A question names its artwork by id rather than carrying a copy of the markup, and a
        # student never loads an editable SVG library. These frozen snapshots are what the
        # player resolves those ids against — the same immutable copies `/learning/assets`
        # serves one at a time for skill thumbnails.
        "assets": [
            row["snapshot"] for row in release.asset_manifest
            if isinstance(row.get("snapshot"), dict)
        ],
        "frontierSkillId": progression.frontier_skill_id if progression else delivery_skill_ids[0],
        "eligibleSkillIds": progression.eligible_skill_ids if progression else [],
        "deliverySkillIds": delivery_skill_ids,
    }


@router.get("/content-audit")
async def get_content_audit(
    limit: int = 100,
    resource_type: str | None = None,
    curriculum_id: str | None = None,
    user: User = Depends(get_current_user),
):
    owner_filter = (
        {"$or": [{"owner_id": str(user.id)}, {"owner_id": "system"}]}
        if _role_value(user) == "admin"
        else {"owner_id": str(user.id)}
    )
    conditions = [owner_filter]
    if resource_type:
        conditions.append({"resource_type": resource_type})
    if curriculum_id:
        conditions.append({"curriculum_id": curriculum_id})
    audit_filter = {"$and": conditions} if len(conditions) > 1 else owner_filter
    rows = (
        await ContentAuditEvent.find(audit_filter)
        .sort("-occurred_at")
        .limit(min(limit, 500))
        .to_list()
    )
    actor_ids = {row.actor_id for row in rows}
    actor_object_ids = []
    for actor_id in actor_ids:
        try:
            actor_object_ids.append(PydanticObjectId(actor_id))
        except Exception:
            continue
    actors = {
        str(item.id): item
        for item in await User.find({"_id": {"$in": actor_object_ids}}).to_list()
    } if actor_object_ids else {}
    events = []
    for row in rows:
        output = row.model_dump(mode="json")
        actor = actors.get(row.actor_id)
        output["actor"] = {
            "id": row.actor_id,
            "name": actor.name if actor else "System",
            "email": str(actor.email) if actor else None,
            "role": row.actor_role,
        }
        events.append(output)
    return {"events": events}


# ── SVG asset library ───────────────────────────────────────────────────────

@router.get("/svg-assets")
async def get_svg_assets(user: User = Depends(get_current_user)):
    doc = await SvgLibrary.find_one(SvgLibrary.owner_id == str(user.id))
    if not doc:
        return {"exists": False, "assets": [], "overrides": {},
                "deletedSystemAssetIds": [], "techniqueThumbnails": {},
                "masteryGateAssets": {}, "revision": 0}
    return {"exists": True, "assets": doc.assets, "overrides": doc.overrides,
            "deletedSystemAssetIds": doc.deleted_system_asset_ids,
            "techniqueThumbnails": doc.technique_thumbnails,
            "masteryGateAssets": doc.mastery_gate_assets, "revision": doc.revision}


@router.get("/svg-assets/usage")
async def get_svg_asset_usage(user: User = Depends(get_current_user)):
    """Which curriculum skills reference each asset in this owner's library.

    The link lives on the skill (`presentation.thumbnailAssetId`), so the Assets page has no
    way to know an asset is in use — or that deleting it would strand a skill's artwork.
    This reads the owner's draft curricula and inverts the reference.
    """
    usage: dict[str, list[dict[str, str]]] = {}
    async for doc in Curriculum.find(Curriculum.owner_id == str(user.id)):
        if doc.archived_at:
            continue
        title = (doc.tree or {}).get("title") or "Untitled curriculum"
        for skill in (doc.tree or {}).get("skills", []):
            asset_id = (skill.get("presentation") or {}).get("thumbnailAssetId")
            if not asset_id:
                continue
            usage.setdefault(asset_id, []).append({
                "curriculumId": doc.curriculum_id or str(doc.id),
                "curriculumTitle": title,
                "skillId": skill.get("id"),
                "skillLabel": skill.get("label") or skill.get("id"),
            })
    return {"usage": usage}


@router.put("/svg-assets")
async def put_svg_assets(body: SvgLibraryIn, user: User = Depends(get_current_user)):
    owner_id = str(user.id)
    assets = [asset.model_dump(by_alias=True, exclude_none=True) for asset in body.assets]
    overrides = {key: value.model_dump() for key, value in body.overrides.items()}
    doc = await SvgLibrary.find_one(SvgLibrary.owner_id == owner_id)
    if doc:
        if body.revision != doc.revision:
            raise HTTPException(status.HTTP_409_CONFLICT, "SVG library changed in another session; reload before saving")
        doc.assets = assets
        doc.overrides = overrides
        doc.deleted_system_asset_ids = body.deleted_system_asset_ids
        doc.technique_thumbnails = body.technique_thumbnails
        doc.mastery_gate_assets = body.mastery_gate_assets
        doc.revision += 1
        doc.updated_at = datetime.now(timezone.utc)
        await doc.save()
    else:
        if body.revision != 0:
            raise HTTPException(status.HTTP_409_CONFLICT, "SVG library revision is stale")
        doc = SvgLibrary(owner_id=owner_id, assets=assets, overrides=overrides,
                         deleted_system_asset_ids=body.deleted_system_asset_ids,
                         technique_thumbnails=body.technique_thumbnails,
                         mastery_gate_assets=body.mastery_gate_assets, revision=1)
        await doc.insert()
    if user.role == Role.admin:
        # Students cannot read an admin's editable library. Publish only the four selected,
        # already-sanitized asset records through global settings for learner celebrations.
        assets_by_id = {asset["id"]: asset for asset in assets}
        system_settings = await get_system_settings()
        system_settings.mastery_gate_assets = {
            level: assets_by_id[asset_id]
            for level, asset_id in body.mastery_gate_assets.items()
        }
        system_settings.updated_at = datetime.now(timezone.utc)
        await system_settings.save()
    return {"ok": True, "revision": doc.revision}
