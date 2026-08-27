"""API Gateway (HTTP API) Lambda authorizer — gate any route with one config.

Attach this Lambda as a REQUEST authorizer (payload format 2.0, simple responses
enabled) to your HTTP API routes. Verified user claims are forwarded to the
downstream handler via `event.requestContext.authorizer.lambda`.

This is the recommended pattern when the API and the User Pool are in the SAME
AWS account but you still want a single shared gate. For separate accounts/clouds
or proxy integrations, use the @require_auth decorator instead.
"""

from verify_jwt import AuthError, extract_bearer_token, verify_token


def handler(event, _context):
    try:
        token = extract_bearer_token(event)
        claims = verify_token(token)
    except AuthError:
        return {"isAuthorized": False}

    # Only scalar values are allowed in the authorizer context.
    return {
        "isAuthorized": True,
        "context": {
            "sub": claims.get("sub", ""),
            "email": claims.get("email", ""),
            "given_name": claims.get("given_name", ""),
            "family_name": claims.get("family_name", ""),
        },
    }
