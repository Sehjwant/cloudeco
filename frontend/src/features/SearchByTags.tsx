import { useState } from 'react';
import { Card, Field, Button, Banner, ResultJson, ThumbnailGrid, SpeciesDatalist } from '../components/ui';
import { SPECIES_DATALIST_ID, toScientificName } from '../lib/species';
import { apiFetch } from '../lib/api';
import { useAsyncAction } from '../lib/useAsyncAction';

interface TagRow {
  tag: string;
  count: string;
}

type SearchResult = { results?: { thumbnailUrl: string; fullUrl: string; label?: string }[] };

export default function SearchByTags() {
  const [rows, setRows] = useState<TagRow[]>([{ tag: '', count: '1' }]);

  const action = useAsyncAction(async () => {
    const query: Record<string, number> = {};
    for (const r of rows) {
      if (r.tag.trim()) {
        const scientificName = toScientificName(r.tag.trim());
        query[scientificName] = Number(r.count) || 1;
      }
    }
    if (!Object.keys(query).length) throw new Error('Add at least one tag.');
    return apiFetch<SearchResult>('/search/tags', { method: 'POST', body: query });
  });

  const update = (i: number, patch: Partial<TagRow>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <Card
      title="Search by tags + minimum counts"
      description='Logical AND. Example: {"Bos_taurus": 6} finds files with ≥6 cattle; {"Bos_taurus": 2, "Canis_dingo": 1} finds files with ≥2 cattle AND ≥1 dingo.'
    >
      {rows.map((row, i) => (
        <div className="row" key={i}>
          <Field label="Species tag">
            <input
              type="text"
              placeholder="e.g. Macropus_giganteus — Eastern Grey Kangaroo"
              list={SPECIES_DATALIST_ID}
              value={row.tag}
              onChange={(e) => update(i, { tag: e.target.value })}
            />
          </Field>
          <Field label="Min count">
            <input
              type="number"
              min={1}
              value={row.count}
              onChange={(e) => update(i, { count: e.target.value })}
            />
          </Field>
          <Button variant="ghost" onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}>
            Remove
          </Button>
        </div>
      ))}

      <div className="actions">
        <Button variant="ghost" onClick={() => setRows((rs) => [...rs, { tag: '', count: '1' }])}>
          + Add tag
        </Button>
        <Button onClick={action.run} loading={action.loading}>
          Search
        </Button>
      </div>

      <SpeciesDatalist />

      {action.error && <Banner kind="error">{action.error}</Banner>}
      {action.result && <ThumbnailGrid items={action.result.results ?? []} />}
      {action.result && !action.result.results && <ResultJson data={action.result} />}
    </Card>
  );
}
