"""Beanie document models registered with the ODM on startup."""

from .user import User
from .password_reset import PasswordResetToken
from .throttle import LoginThrottle
from .student import Student
from .content import Curriculum, CurriculumRelease, QuestionDeck, SvgLibrary, SystemSettings
from .event import LearningEvent
from .audit import ContentAuditEvent
from .menu import Menu, RoleDef
from .academic import Grade, Subject
from .classroom import Classroom, ClassEnrollment
from .mastery import MasteryState, ProjectionJob
from .assignment import Assignment, Placement, ProgressionState
from .recommendation import RecommendationRun, StudentSession

ALL_MODELS = [LoginThrottle, PasswordResetToken, User, Student, Curriculum, CurriculumRelease, QuestionDeck, SvgLibrary, SystemSettings, LearningEvent, ContentAuditEvent, Menu, RoleDef, Grade, Subject, Classroom, ClassEnrollment, MasteryState, ProjectionJob, Assignment, Placement, ProgressionState, RecommendationRun, StudentSession]

__all__ = [
    "LoginThrottle", "PasswordResetToken", "User", "Student", "Curriculum", "CurriculumRelease", "QuestionDeck", "SvgLibrary", "SystemSettings", "LearningEvent", "ContentAuditEvent",
    "Menu", "RoleDef", "Grade", "Subject", "Classroom", "ClassEnrollment", "MasteryState", "ProjectionJob", "Assignment", "Placement", "ProgressionState", "RecommendationRun", "StudentSession", "ALL_MODELS",
]
