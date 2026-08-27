"""Reusable AWS Cognito JWT verifier shared by all backend APIs.

Verifies a Cognito-issued token **offline** using the User Pool's public JWKS:
signature (RS256), issuer, audience/client_id, expiry, and token_use. No call is
made to AWS per request — only the public signing keys are fetched (and cached),
so this works from any AWS account/lab or a second cloud (GCP/Azure/OCI).

Configuration (environment variables):
    COGNITO_REGION         default "us-east-1"
    COGNITO_USER_POOL_ID   required, e.g. us-east-1_C1NYDVm0c
    COGNITO_APP_CLIENT_ID  required, e.g. 5e22hu1p0qqlsuvsn286p7f9rv
    COGNITO_TOKEN_USE      default "id"  ("id" or "access")
"""

from __future__ import annotations

import os

import jwt  # PyJWT
from jwt import PyJWKClient


class AuthError(Exception):
    """Raised when a token is missing or fails verification."""


def _require_env(name: str, default: str | None = None) -> str:
    value = os.environ.get(name, default)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


REGION = os.environ.get("COGNITO_REGION", "us-east-1")
USER_POOL_ID = _require_env("COGNITO_USER_POOL_ID")
APP_CLIENT_ID = _require_env("COGNITO_APP_CLIENT_ID")
TOKEN_USE = os.environ.get("COGNITO_TOKEN_USE", "id")

ISSUER = f"https://cognito-idp.{REGION}.amazonaws.com/{USER_POOL_ID}"
JWKS_URL = f"{ISSUER}/.well-known/jwks.json"

# Module-level client → caches signing keys across warm Lambda invocations.
_jwks_client = PyJWKClient(JWKS_URL)


def verify_token(token: str) -> dict:
    """Verify a raw JWT string and return its claims, or raise AuthError."""
    if not token:
        raise AuthError("No token provided")

    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(token)
        decode_kwargs = {
            "algorithms": ["RS256"],
            "issuer": ISSUER,
            "options": {"require": ["exp", "iat", "sub", "token_use"]},
        }
        # ID tokens carry `aud` == app client id; access tokens carry `client_id`.
        if TOKEN_USE == "id":
            decode_kwargs["audience"] = APP_CLIENT_ID
        claims = jwt.decode(token, signing_key.key, **decode_kwargs)
    except AuthError:
        raise
    except Exception as exc:  # PyJWT raises several InvalidToken subclasses
        raise AuthError(f"Token verification failed: {exc}") from exc

    if claims.get("token_use") != TOKEN_USE:
        raise AuthError(
            f"Wrong token_use: expected {TOKEN_USE!r}, got {claims.get('token_use')!r}"
        )
    if TOKEN_USE == "access" and claims.get("client_id") != APP_CLIENT_ID:
        raise AuthError("Token client_id does not match the app client")

    return claims


def extract_bearer_token(event: dict) -> str:
    """Pull the bearer token from a Lambda/API Gateway event (case-insensitive)."""
    # REST API TOKEN authorizer
    raw = event.get("authorizationToken")
    if raw:
        return raw[7:] if raw.lower().startswith("bearer ") else raw

    # HTTP/REST proxy events
    headers = event.get("headers") or {}
    for key, value in headers.items():
        if key.lower() == "authorization" and value:
            return value[7:] if value.lower().startswith("bearer ") else value

    # HTTP API authorizer identitySource
    for src in event.get("identitySource") or []:
        if src:
            return src[7:] if src.lower().startswith("bearer ") else src

    raise AuthError("Missing Authorization header")
