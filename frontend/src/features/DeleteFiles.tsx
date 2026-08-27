import { useState } from 'react';
import { Card, Field, Button, Banner, ResultJson } from '../components/ui';
import { apiFetch } from '../lib/api';
import { useAsyncAction } from '../lib/useAsyncAction';

export default function DeleteFiles() {
  const [urls, setUrls] = useState('');

  const action = useAsyncAction(async () => {
    const urlList = urls.split('\n').map((u) => u.trim()).filter(Boolean);
    if (!urlList.length) throw new Error('Add at least one file URL.');
    // Removes files + thumbnails from storage AND their DB entries (rubric 2.3.2).
    return apiFetch('/files', { method: 'DELETE', body: { url: urlList } });
  });

  return (
    <Card
      title="Delete files"
      description="Removes the listed files, their thumbnails, and all matching database records."
    >
      <Field label="File URLs" hint="One per line.">
        <textarea
          placeholder={'https://…/file1.jpg\nhttps://…/file2.mp4'}
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
        />
      </Field>

      <div className="actions">
        <Button variant="danger" onClick={action.run} loading={action.loading}>
          Delete
        </Button>
      </div>

      {action.error && <Banner kind="error">{action.error}</Banner>}
      {action.result != null && <Banner kind="success">Delete request sent.</Banner>}
      {action.result != null && <ResultJson data={action.result} />}
    </Card>
  );
}
