"""How a token arrives, and how /docs helps you get one.

Two declarations for one mechanism — the wire format is a bearer token either
way, and the service is not an OAuth2 provider:

* `bearer_scheme` is the truth: `Authorization: Bearer <jwt>`.
* `oauth2_scheme` exists so Swagger UI offers a username/password box and
  fetches the token itself, instead of asking a developer to paste one. It
  points at `/v1/auth/token`, a form-encoded alias of `/v1/auth/login`.

Why not "real" OAuth2: the flows that matter there — authorization code with
PKCE, scopes, third-party clients — solve *delegated* access, letting an app act
for a user against someone else's API. Koda's app and API are the same product
and the same origin, so all that would add is ceremony. The password grant that
would fit is deprecated in OAuth 2.1 anyway; here it earns its place only as a
convenience for the docs page.
"""

from fastapi.security import HTTPBearer, OAuth2PasswordBearer

bearer_scheme = HTTPBearer(
    auto_error=False,
    description="Access token from POST /v1/auth/login",
)

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/v1/auth/token",
    auto_error=False,
    description="Sign in here and Swagger keeps the token for you",
)
