#!/usr/bin/env bash
# Recreate the Aussie EcoLens Cognito User Pool + public App Client.
# Idempotent enough for disaster recovery / standing up a fresh pool.
#
# Usage:  ./infra/create-cognito.sh [aws-profile] [region]
# Example: ./infra/create-cognito.sh student us-east-1
set -euo pipefail

PROFILE="${1:-student}"
REGION="${2:-us-east-1}"

echo "Creating User Pool (profile=$PROFILE region=$REGION)…"
POOL_ID=$(aws cognito-idp create-user-pool \
  --pool-name ecolens-user-pool \
  --region "$REGION" --profile "$PROFILE" \
  --auto-verified-attributes email \
  --username-attributes email \
  --policies '{"PasswordPolicy":{"MinimumLength":8,"RequireUppercase":true,"RequireLowercase":true,"RequireNumbers":true,"RequireSymbols":false}}' \
  --schema '[{"Name":"email","AttributeDataType":"String","Required":true,"Mutable":true},{"Name":"given_name","AttributeDataType":"String","Required":true,"Mutable":true},{"Name":"family_name","AttributeDataType":"String","Required":true,"Mutable":true}]' \
  --account-recovery-setting '{"RecoveryMechanisms":[{"Priority":1,"Name":"verified_email"}]}' \
  --query 'UserPool.Id' --output text)
echo "  POOL_ID=$POOL_ID"

echo "Creating public App Client (no secret, SRP auth for Amplify)…"
CLIENT_ID=$(aws cognito-idp create-user-pool-client \
  --user-pool-id "$POOL_ID" \
  --client-name ecolens-web \
  --no-generate-secret \
  --explicit-auth-flows ALLOW_USER_SRP_AUTH ALLOW_REFRESH_TOKEN_AUTH ALLOW_USER_PASSWORD_AUTH \
  --region "$REGION" --profile "$PROFILE" \
  --query 'UserPoolClient.ClientId' --output text)
echo "  CLIENT_ID=$CLIENT_ID"

echo
echo "Add these to frontend/.env:"
echo "  VITE_COGNITO_USER_POOL_ID=$POOL_ID"
echo "  VITE_COGNITO_CLIENT_ID=$CLIENT_ID"
echo "  VITE_AWS_REGION=$REGION"
