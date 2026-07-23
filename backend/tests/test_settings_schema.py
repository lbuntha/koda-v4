"""Validation coverage for persisted server-authoritative scoring settings."""

import pytest
from pydantic import ValidationError

from app.core.scoring_config import default_scoring_config
from app.features.settings.schemas import ScoringConfigIn


def test_default_scoring_config_satisfies_persisted_contract():
    parsed = ScoringConfigIn.model_validate(default_scoring_config())
    assert parsed.placement.checkpoint_cap == 8
    assert parsed.successfulReviewScore == 0.8


def test_scoring_weights_must_sum_to_one():
    config = default_scoring_config()
    config["weights"]["speed"] = 0.5
    with pytest.raises(ValidationError, match="sum to 1"):
        ScoringConfigIn.model_validate(config)


def test_mastery_thresholds_must_be_ordered():
    config = default_scoring_config()
    config["developingScore"] = 0.95
    with pytest.raises(ValidationError, match="thresholds"):
        ScoringConfigIn.model_validate(config)
