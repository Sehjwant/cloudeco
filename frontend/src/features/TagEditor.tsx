import { useState } from 'react';
import { Card, Field, Button, Banner, ResultJson } from '../components/ui';
import { apiFetch } from '../lib/api';
import { useAsyncAction } from '../lib/useAsyncAction';

export default function TagEditor() {
  const [urls, setUrls] = useState('');
  const [tags, setTags] = useState('');
  const [operation, setOperation] = useState('1');

  const action = useAsyncAction(async () => {
    const urlList = urls.split('\n').map((u) => u.trim()).filter(Boolean);
    const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
    if (!urlList.length) throw new Error('Add at least one file URL.');
    if (!tagList.length) throw new Error('Add at least one tag.');
    // operation: 1 = add, 0 = remove. Bulk across all listed URLs (rubric 2.3.1).
    return apiFetch('/tags', {
      method: 'POST',
      body: { url: urlList, tags: tagList, operation: Number(operation) },
    });
  });

  return (
    <Card
      title="Bulk add / remove tags"
      description="Edit tags across many files at once. Operation 1 adds tags; 0 removes them (missing tags are ignored)."
    >
      <Field label="File URLs" hint="One per line.">
        <textarea
          placeholder={'https://…/file1.jpg\nhttps://…/file2.mp4'}
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
        />
      </Field>
      <div className="row">
        <Field label="Tags" hint="Comma-separated.">
          <input type="text" placeholder="koala, wombat" value={tags} onChange={(e) => setTags(e.target.value)} />
        </Field>
        <Field label="Operation">
          <select value={operation} onChange={(e) => setOperation(e.target.value)}>
            <option value="1">Add tags (1)</option>
            <option value="0">Remove tags (0)</option>
          </select>
        </Field>
      </div>

      <div className="actions">
        <Button onClick={action.run} loading={action.loading}>
          Apply
        </Button>
      </div>

      {action.error && <Banner kind="error">{action.error}</Banner>}
      {action.result != null && <Banner kind="success">Tags updated.</Banner>}
      {action.result != null && <ResultJson data={action.result} />}
    </Card>
  );
}
