import { useState } from 'react';
import { Card, Field, Button, Banner } from '../components/ui';
import { apiFetch } from '../lib/api';
import { useAsyncAction } from '../lib/useAsyncAction';

export default function Notifications() {
  const [tag, setTag] = useState('');

  const action = useAsyncAction(async () => {
    if (!tag.trim()) throw new Error('Enter a species tag to watch.');
    return apiFetch('/notifications/subscribe', {
      method: 'POST',
      body: { tag: tag.trim() },
    });
  });

  return (
    <Card
      title="Tag notifications"
      description="Get an email when new media with a species you care about is added. Powered by GCP Pub/Sub."
    >
      <Field label="Watch species" hint="You'll receive an email when new media with this species is detected.">
        <input type="text" placeholder="e.g. Macropus_giganteus" value={tag} onChange={(e) => setTag(e.target.value)} />
      </Field>

      <div className="actions">
        <Button onClick={action.run} loading={action.loading}>
          Subscribe
        </Button>
      </div>

      {action.error && <Banner kind="error">{action.error}</Banner>}
      {action.result != null && (
        <Banner kind="success">Subscribed! You will receive an email notification when new {tag} media is added.</Banner>
      )}
    </Card>
  );
}
