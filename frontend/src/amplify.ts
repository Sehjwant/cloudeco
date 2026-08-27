import { Amplify } from 'aws-amplify';

const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
const userPoolClientId = import.meta.env.VITE_COGNITO_CLIENT_ID;

export const cognitoConfigured = Boolean(userPoolId && userPoolClientId);

if (!cognitoConfigured) {
  // Surfaced in the UI as well; this just helps while developing.
  console.warn(
    '[EcoLens] Cognito is not configured. Set VITE_COGNITO_USER_POOL_ID and ' +
      'VITE_COGNITO_CLIENT_ID in frontend/.env, then restart `npm run dev`.',
  );
}

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: userPoolId ?? '',
      userPoolClientId: userPoolClientId ?? '',
      // Users sign in with their email address.
      loginWith: { email: true },
    },
  },
});
