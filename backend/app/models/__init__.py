"""Beanie document models registered with the ODM on startup."""

from .user import User
from .student import Student
from .content import Curriculum, CurriculumRelease, QuestionDeck, SvgLibrary, SystemSettings
from .event import LearningEvent
from .audit import ContentAuditEvent
from .menu import Menu, RoleDef
from .academic import Grade, Subject
from .classroom import Classroom, ClassEnrollment
from .mastery import MasteryState
from .assignment import Assignment, Placement, ProgressionState

ALL_MODELS = [User, Student, Curriculum, CurriculumRelease, QuestionDeck, SvgLibrary, SystemSettings, LearningEvent, ContentAuditEvent, Menu, RoleDef, Grade, Subject, Classroom, ClassEnrollment, MasteryState, Assignment, Placement, ProgressionState]

__all__ = [
    "User", "Student", "Curriculum", "CurriculumRelease", "QuestionDeck", "SvgLibrary", "SystemSettings", "LearningEvent", "ContentAuditEvent",
    "Menu", "RoleDef", "Grade", "Subject", "Classroom", "ClassEnrollment", "MasteryState", "Assignment", "Placement", "ProgressionState", "ALL_MODELS",
]
