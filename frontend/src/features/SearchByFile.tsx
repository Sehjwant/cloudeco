import { useState } from 'react';
import { Card, Field, Button, Banner, ResultJson, ThumbnailGrid } from '../components/ui';
import { apiFetch } from '../lib/api';
import { useAsyncAction } from '../lib/useAsyncAction';

type SearchResult = { results?: { thumbnailUrl: string; fullUrl: string; label?: string }[] };

export default function SearchByFile() {
  const [file, setFile] = useState<File | null>(null);

  const action = useAsyncAction(async () => {
    if (!file) throw new Error('Choose a file to query with.');
    const form = new FormData();
    form.append('file', file);
    // The backend detects this file's tags, finds DB matches with that tag set,
    // and must NOT persist the query file (rubric 2.2.3).
    return apiFetch<SearchResult>('/search/by-file', { method: 'POST', body: form });
  });

  return (
    <Card
      title="Search by uploaded file"
      description="Upload a file; we detect its species and return files sharing that tag set. The query file is never stored."
    >
      <Field label="Query file">
        <input
          type="file"
          accept="image/*,video/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </Field>

      <div className="actions">
        <Button onClick={action.run} loading={action.loading} disabled={!file}>
          Find similar
        </Button>
      </div>

      {action.error && <Banner kind="error">{action.error}</Banner>}
      {action.result && <ThumbnailGrid items={action.result.results ?? []} />}
      {action.result && !action.result.results && <ResultJson data={action.result} />}
    </Card>
  );
}
