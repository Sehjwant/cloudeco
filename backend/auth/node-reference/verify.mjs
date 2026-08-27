// Node reference verifier for SECOND-CLOUD functions (or Node-based AWS Lambdas).
// Uses AWS's purpose-built library, which fetches+caches the JWKS and checks
// signature, issuer, audience/client_id, expiry, and token_use for you.
//
//   npm install aws-jwt-verify
//
// Env: COGNITO_USER_POOL_ID, COGNITO_APP_CLIENT_ID, COGNITO_TOKEN_USE (default "id")

import { CognitoJwtVerifier } from "aws-jwt-verify";

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  clientId: process.env.COGNITO_APP_CLIENT_ID,
  tokenUse: process.env.COGNITO_TOKEN_USE ?? "id",
});

/** Extract the bearer token from an event's headers (case-insensitive). */
export function extractBearer(event) {
  const headers = event.headers ?? {};
  const entry = Object.entries(headers).find(([k]) => k.toLowerCase() === "authorization");
  const value = entry?.[1];
  if (!value) throw new Error("Missing Authorization header");
  return value.toLowerCase().startsWith("bearer ") ? value.slice(7) : value;
}

/** Verify and return claims, or throw. */
export async function verify(token) {
  return verifier.verify(token);
}

/** API Gateway HTTP API simple-authorizer handler (also fine as a template
 *  for GCP Cloud Functions / Azure Functions — adapt the request/response). */
export async function handler(event) {
  try {
    const claims = await verify(extractBearer(event));
    return {
      isAuthorized: true,
      context: { sub: claims.sub, email: claims.email },
    };
  } catch {
    return { isAuthorized: false };
  }
}
