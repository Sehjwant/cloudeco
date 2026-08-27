import { useState } from 'react';
import { Card, Field, Button, Banner } from '../components/ui';
import { apiFetch } from '../lib/api';
import { useAsyncAction } from '../lib/useAsyncAction';

type ResolveResult = { fullUrl?: string };

export default function SearchByThumbnail() {
  const [thumbnailUrl, setThumbnailUrl] = useState('');

  const action = useAsyncAction(async () => {
    if (!thumbnailUrl.trim()) throw new Error('Paste a thumbnail URL.');
    // Maps a thumbnail URL back to its full-size image URL (rubric 2.2.2).
    return apiFetch<ResolveResult>('/resolve-thumbnail', {
      method: 'POST',
      body: { thumbnailUrl: thumbnailUrl.trim() },
    });
  });

  return (
    <Card
      title="Resolve thumbnail → full image"
      description="Paste a thumbnail URL to retrieve the corresponding full-size image URL."
    >
      <Field label="Thumbnail URL">
        <input
          type="url"
          placeholder="https://…/thumbnails/abc.jpg"
          value={thumbnailUrl}
          onChange={(e) => setThumbnailUrl(e.target.value)}
        />
      </Field>

      <div className="actions">
        <Button onClick={action.run} loading={action.loading}>
          Resolve
        </Button>
      </div>

      {action.error && <Banner kind="error">{action.error}</Banner>}
      {action.result?.fullUrl && (
        <Banner kind="success">
          Full-size image:{' '}
          <a href={action.result.fullUrl} target="_blank" rel="noreferrer">
            {action.result.fullUrl}
          </a>
        </Banner>
      )}
    </Card>
  );
}
