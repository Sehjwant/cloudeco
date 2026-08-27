import { useState } from 'react';
import { Card, Field, Button, Banner, ResultJson, ThumbnailGrid, SpeciesDatalist } from '../components/ui';
import { SPECIES_DATALIST_ID, toScientificName } from '../lib/species';
import { apiFetch } from '../lib/api';
import { useAsyncAction } from '../lib/useAsyncAction';

type SearchResult = { results?: { thumbnailUrl: string; fullUrl: string; label?: string }[] };

export default function SearchBySpecies() {
  const [value, setValue] = useState('');

  const action = useAsyncAction(async () => {
    const species = value
      .split(',')
      .map((s) => toScientificName(s.trim()))
      .filter(Boolean);
    if (!species.length) throw new Error('Enter at least one species.');
    return apiFetch<SearchResult>('/search/species', { method: 'POST', body: { species } });
  });

  return (
    <Card
      title="Search by species"
      description='Returns all files containing at least one match. Example: "Dingo" or "Canis_dingo".'
    >
      <Field label="Species" hint="Start typing a name or select from the list. Comma-separate for multiple.">
        <input
          type="text"
          placeholder="e.g. Macropus_giganteus — Eastern Grey Kangaroo"
          list={SPECIES_DATALIST_ID}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <SpeciesDatalist />
      </Field>

      <div className="actions">
        <Button onClick={action.run} loading={action.loading}>
          Search
        </Button>
      </div>

      {action.error && <Banner kind="error">{action.error}</Banner>}
      {action.result && <ThumbnailGrid items={action.result.results ?? []} />}
      {action.result && !action.result.results && <ResultJson data={action.result} />}
    </Card>
  );
}
