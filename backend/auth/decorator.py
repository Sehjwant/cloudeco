"""@require_auth — for handlers that verify the token themselves.

Use this when there is no shared API Gateway authorizer: Lambda proxy
integrations, functions in a different AWS account, or a second cloud. It
verifies the bearer token and injects the claims as `event["user"]`, returning
a 401 proxy response if verification fails.

    from decorator import require_auth

    @require_auth
    def handler(event, context):
        user = event["user"]          # verified Cognito claims
        return {"statusCode": 200, "body": f"hi {user['email']}"}
"""

import json
from functools import wraps

from verify_jwt import AuthError, extract_bearer_token, verify_token


def _unauthorized(message: str) -> dict:
    return {
        "statusCode": 401,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({"message": message}),
    }


def require_auth(handler):
    @wraps(handler)
    def wrapper(event, context):
        try:
            token = extract_bearer_token(event)
            event["user"] = verify_token(token)
        except AuthError as exc:
            return _unauthorized(str(exc))
        return handler(event, context)

    return wrapper
