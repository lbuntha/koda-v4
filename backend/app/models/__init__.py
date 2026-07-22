"""Beanie document models registered with the ODM on startup."""

from .user import User
from .student import Student
from .content import Curriculum, QuestionDeck
from .event import LearningEvent

ALL_MODELS = [User, Student, Curriculum, QuestionDeck, LearningEvent]

__all__ = ["User", "Student", "Curriculum", "QuestionDeck", "LearningEvent", "ALL_MODELS"]
