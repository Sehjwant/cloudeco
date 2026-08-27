/**
 * Species mapping: scientific name → common name
 * Displayed as "Scientific Name — Common Name" in dropdowns
 * Scientific name is sent to backend (matches database)
 */

export const SPECIES_MAP: Record<string, string> = {
  'Alectura_lathami':          'Australian Brushturkey',
  'Antechinus_agilis':         'Agile Antechinus',
  'Bos_taurus':                'Cattle',
  'Burhinus_grallarius':       'Bush Thick-knee',
  'Canis_dingo':               'Dingo',
  'Canis_familiaris':          'Domestic Dog',
  'Capra_hircus':              'Domestic Goat',
  'Casuarius_casuarius':       'Southern Cassowary',
  'Chalcophaps_longirostris':  'Pacific Emerald Dove',
  'Colluricincla_harmonica':   'Grey Shrikethrush',
  'Corcorax_melanorhamphos':   'White-winged Chough',
  'Dacelo_novaeguineae':       'Laughing Kookaburra',
  'Dama_dama':                 'Fallow Deer',
  'Eopsaltria_australis':      'Eastern Yellow Robin',
  'Felis_catus':               'Domestic Cat',
  'Geopelia_humeralis':        'Bar-shouldered Dove',
  'Gymnorhina_tibicen':        'Australian Magpie',
  'Heteromyias_cinereifrons':  'Grey-headed Robin',
  'Homo_sapiens':              'Human',
  'Hypsiprymnodon_moschatus':  'Musky Rat-kangaroo',
  'Isoodon_macrourus':         'Northern Brown Bandicoot',
  'Lepus_europaeus':           'European Hare',
  'Macropus_giganteus':        'Eastern Grey Kangaroo',
  'Megapodius_reinwardt':      'Orange-footed Scrubfowl',
  'Menura_novaehollandiae':    'Superb Lyrebird',
  'Mus_musculus':              'House Mouse',
  'Notamacropus_rufogriseus':  'Red-necked Wallaby',
  'Orthonyx_spaldingii':       'Northern Chowchilla',
  'Oryctolagus_cuniculus':     'European Rabbit',
  'Perameles_nasuta':          'Long-nosed Bandicoot',
  'Pitta_versicolor':          'Noisy Pitta',
  'Rattus':                    'Rat (genus)',
  'Rattus_fuscipes':           'Australian Bush Rat',
  'Rattus_rattus':             'Black Rat',
  'Strepera_graculina':        'Pied Currawong',
  'Sus_scrofa':                'Wild Boar',
  'Tachyglossus_aculeatus':    'Australian Echidna',
  'Thylogale_stigmatica':      'Red-legged Pademelon',
  'Trichosurus_caninus':       'Short-eared Possum',
  'Trichosurus_cunninghami':   'Mountain Brushtail Possum',
  'Trichosurus_vulpecula':     'Common Brushtail Possum',
  'Uromys_caudimaculatus':     'Giant White-tailed Rat',
  'Varanus_varius':            'Lace Monitor',
  'Vombatus_ursinus':          'Common Wombat',
  'Vulpes_vulpes':             'Red Fox',
  'Wallabia_bicolor':          'Swamp Wallaby',
};

/** Display label shown in dropdown: "Macropus_giganteus — Eastern Grey Kangaroo" */
export const SPECIES_OPTIONS: { value: string; label: string }[] = Object.entries(SPECIES_MAP).map(
  ([scientific, common]) => ({
    value: scientific,
    label: `${scientific} — ${common}`,
  })
);

/** Plain list of scientific names for datalist */
export const SPECIES: string[] = SPECIES_OPTIONS.map(s => s.label);

/** Convert display label or common name back to scientific name */
export function toScientificName(input: string): string {
  const trimmed = input.trim();
  // Already a scientific name
  if (SPECIES_MAP[trimmed]) return trimmed;
  // "Macropus_giganteus — Eastern Grey Kangaroo" format
  const dashPart = trimmed.split(' — ')[0].trim();
  if (SPECIES_MAP[dashPart]) return dashPart;
  // Try matching by common name
  const entry = Object.entries(SPECIES_MAP).find(([, common]) =>
    common.toLowerCase() === trimmed.toLowerCase()
  );
  return entry ? entry[0] : trimmed;
}

/** Shared id for the datalist */
export const SPECIES_DATALIST_ID = 'ecolens-species';
