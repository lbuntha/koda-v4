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
from .assignment import Assignment, CurriculumOffering, CurriculumPromotion, Placement, ProgressionState
from .recommendation import RecommendationRun, StudentSession
from .notification import Notification, NotificationReceipt

ALL_MODELS = [LoginThrottle, PasswordResetToken, User, Student, Curriculum, CurriculumRelease, QuestionDeck, SvgLibrary, SystemSettings, LearningEvent, ContentAuditEvent, Menu, RoleDef, Grade, Subject, Classroom, ClassEnrollment, MasteryState, ProjectionJob, Assignment, CurriculumOffering, CurriculumPromotion, Placement, ProgressionState, RecommendationRun, StudentSession, Notification, NotificationReceipt]

__all__ = [
    "LoginThrottle", "PasswordResetToken", "User", "Student", "Curriculum", "CurriculumRelease", "QuestionDeck", "SvgLibrary", "SystemSettings", "LearningEvent", "ContentAuditEvent",
    "Menu", "RoleDef", "Grade", "Subject", "Classroom", "ClassEnrollment", "MasteryState", "ProjectionJob", "Assignment", "CurriculumOffering", "CurriculumPromotion", "Placement", "ProgressionState", "RecommendationRun", "StudentSession",
    "Notification", "NotificationReceipt", "ALL_MODELS",
]
