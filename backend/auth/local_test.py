"""Sanity-check the verifier + config against a real token.

    cd backend/auth
    python -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    export COGNITO_USER_POOL_ID=us-east-1_C1NYDVm0c
    export COGNITO_APP_CLIENT_ID=5e22hu1p0qqlsuvsn286p7f9rv
    python local_test.py "<paste-id-token>"

Get a token from the web app's "Account & tokens" panel → Reveal ID token.
"""

import sys

from verify_jwt import ISSUER, TOKEN_USE, AuthError, verify_token


def main() -> None:
    if len(sys.argv) < 2:
        print("usage: python local_test.py <jwt>")
        raise SystemExit(2)

    print(f"Issuer:    {ISSUER}")
    print(f"token_use: {TOKEN_USE}\n")

    try:
        claims = verify_token(sys.argv[1])
    except AuthError as exc:
        print(f"❌ INVALID: {exc}")
        raise SystemExit(1)

    print("✅ VALID. Claims:")
    for key in ("sub", "email", "email_verified", "given_name", "family_name", "exp"):
        if key in claims:
            print(f"  {key}: {claims[key]}")


if __name__ == "__main__":
    main()
