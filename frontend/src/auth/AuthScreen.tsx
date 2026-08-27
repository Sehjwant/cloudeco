import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { Navigate } from 'react-router-dom';
import { cognitoConfigured } from '../amplify';

/**
 * Sign-up captures the attributes the rubric requires: first name (given_name),
 * last name (family_name), email, password. Cognito emails a verification code,
 * which the Authenticator collects on the "Confirm Sign Up" step automatically.
 */
const formFields = {
  signUp: {
    given_name: { label: 'First name', placeholder: 'Jane', order: 1, isRequired: true },
    family_name: { label: 'Last name', placeholder: 'Doe', order: 2, isRequired: true },
    email: { label: 'Email', placeholder: 'you@example.com', order: 3, isRequired: true },
    password: { label: 'Password', order: 4 },
    confirm_password: { label: 'Confirm password', order: 5 },
  },
};

export default function AuthScreen() {
  return (
    <div className="auth-shell">
      <div className="auth-shell__inner">
        <div className="auth-brand">
          <div className="auth-brand__logo">🦘</div>
          <h1>Aussie EcoLens</h1>
          <p>Sign in to upload, tag, and search wildlife media.</p>
        </div>

        {cognitoConfigured ? (
          <Authenticator formFields={formFields} initialState="signUp" loginMechanisms={['email']}>
            {() => <Navigate to="/" replace />}
          </Authenticator>
        ) : (
          <div className="card">
            <div className="card__body">
              <div className="banner banner--error">
                Cognito isn’t configured yet. Add <code>VITE_COGNITO_USER_POOL_ID</code> and{' '}
                <code>VITE_COGNITO_CLIENT_ID</code> to <code>frontend/.env</code>, then restart{' '}
                <code>npm run dev</code>.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
