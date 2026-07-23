"""Beanie document models registered with the ODM on startup."""

from .user import User
from .student import Student
from .content import Curriculum, QuestionDeck, SvgLibrary, SystemSettings
from .event import LearningEvent
from .audit import ContentAuditEvent
from .menu import Menu, RoleDef
from .academic import Grade, Subject

ALL_MODELS = [User, Student, Curriculum, QuestionDeck, SvgLibrary, SystemSettings, LearningEvent, ContentAuditEvent, Menu, RoleDef, Grade, Subject]

__all__ = [
    "User", "Student", "Curriculum", "QuestionDeck", "SvgLibrary", "SystemSettings", "LearningEvent", "ContentAuditEvent",
    "Menu", "RoleDef", "Grade", "Subject", "ALL_MODELS",
]
