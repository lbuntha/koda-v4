"""Shared short-code generation (family codes for parents)."""

import secrets
import string

from fastapi import HTTPException, status

from ..models.user import User

_ALPHABET = string.ascii_uppercase + string.digits


async def unique_family_code(length: int = 6) -> str:
    """A short shareable code, guaranteed not to collide with an existing one."""
    for _ in range(10):
        code = "".join(secrets.choice(_ALPHABET) for _ in range(length))
        if not await User.find_one(User.family_code == code):
            return code
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not allocate family code")
