import { useEffect, useState } from 'react';
import { fetchUserAttributes } from 'aws-amplify/auth';
import { Card, Button, Banner } from '../components/ui';
import { getIdToken } from '../lib/api';

export default function Developer() {
  const [attrs, setAttrs] = useState<Record<string, string | undefined>>({});
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchUserAttributes().then(setAttrs).catch(() => {});
  }, []);

  async function reveal() {
    setToken((await getIdToken()) ?? '(no token)');
  }

  async function copy() {
    const t = token ?? (await getIdToken());
    if (t) {
      await navigator.clipboard.writeText(t);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <Card
      title="Account & developer tools"
      description="Your Cognito profile and the ID token to authorise backend API calls (e.g. in Postman)."
    >
      <div className="token-box">
        <div>
          <strong>Name:</strong> {attrs.given_name} {attrs.family_name}
        </div>
        <div>
          <strong>Email:</strong> {attrs.email}{' '}
          {attrs.email_verified === 'true' ? '✓ verified' : '(unverified)'}
        </div>
      </div>

      <Banner kind="info">
        Backend calls must send <code>Authorization: Bearer &lt;ID token&gt;</code>. Functions verify
        it against the Cognito JWKS endpoint — no shared AWS account needed.
      </Banner>

      <div className="actions">
        <Button variant="ghost" onClick={reveal}>
          Reveal ID token
        </Button>
        <Button onClick={copy}>{copied ? 'Copied ✓' : 'Copy ID token'}</Button>
      </div>

      {token && <div className="token-value">{token}</div>}
    </Card>
  );
}
