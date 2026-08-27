# Backend auth layer — shared Cognito JWT verification

Every protected API must confirm the caller is a real, signed-in EcoLens user.
The frontend sends the Cognito **ID token** as `Authorization: Bearer <token>`;
these helpers verify it **offline** against the User Pool's public JWKS — no call
to AWS per request, so they work from any AWS account/lab or a second cloud.

What gets checked: RS256 **signature**, **issuer**, **audience** (= app client id),
**expiry**, and **token_use**. (Skipping any of these is the classic JWT mistake.)

## Configuration (env vars)

| Variable | Value |
| --- | --- |
| `COGNITO_REGION` | `us-east-1` |
| `COGNITO_USER_POOL_ID` | `us-east-1_C1NYDVm0c` |
| `COGNITO_APP_CLIENT_ID` | `5e22hu1p0qqlsuvsn286p7f9rv` |
| `COGNITO_TOKEN_USE` | `id` |

## Three ways to use it (Python)

**1. Shared API Gateway authorizer** (same AWS account as the pool) — attach
`authorizer.handler` as an HTTP API REQUEST authorizer (simple responses on).
Downstream handlers read claims from `event.requestContext.authorizer.lambda`.

**2. In-handler decorator** (proxy integrations, other accounts) —
```python
from decorator import require_auth

@require_auth
def handler(event, context):
    user = event["user"]          # verified claims: sub, email, given_name, …
    ...
```

**3. Call the verifier directly** —
```python
from verify_jwt import verify_token, AuthError
claims = verify_token(token)      # raises AuthError if invalid
```

## Verify your config locally

```bash
cd backend/auth
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export COGNITO_USER_POOL_ID=us-east-1_C1NYDVm0c
export COGNITO_APP_CLIENT_ID=5e22hu1p0qqlsuvsn286p7f9rv
python local_test.py "<paste ID token from the app's Account & tokens panel>"
```

## Packaging for AWS Lambda (Learner Lab notes)

- Runtime **python3.12**. Bundle deps into the zip (or a Lambda layer):
  ```bash
  pip install -r requirements.txt -t package/
  cp verify_jwt.py authorizer.py decorator.py package/
  cd package && zip -r ../auth.zip . && cd ..
  ```
- Learner Lab **cannot create IAM roles** — assign the existing **`LabRole`** as the
  function's execution role (don't let SAM/CDK try to create one).
- Set the four env vars on the function.

## Second cloud / Node functions

`node-reference/verify.mjs` does the same checks with AWS's `aws-jwt-verify`
library — drop it into a GCP Cloud Function / Azure Function (adapt the
request/response shape) so the second cloud authorises the same Cognito tokens.
