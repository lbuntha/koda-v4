"""Validated deployment subjects and stable skill-to-subject references."""
from pydantic import Field, field_validator, model_validator
from app.models.common import Model


class Subject(Model):
    id: str = Field(pattern=r"^[a-z][a-z0-9-]{0,63}$")
    name: str = Field(min_length=1, max_length=60)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Subject names cannot be blank.")
        return value


class SubjectCatalog(Model):
    subjects: list[Subject] = Field(max_length=100)
    assignments: dict[str, str] = Field(max_length=1000)

    @model_validator(mode="after")
    def references(self):
        ids = {subject.id for subject in self.subjects}
        names = {subject.name.lower() for subject in self.subjects}
        if len(ids) != len(self.subjects) or len(names) != len(self.subjects):
            raise ValueError("Subject IDs and names must be unique.")
        if any(subject_id not in ids for subject_id in self.assignments.values()):
            raise ValueError("Reassign skills before removing their subject.")
        return self
