import type { ReactNode, ButtonHTMLAttributes } from 'react';
import { SPECIES, SPECIES_DATALIST_ID } from '../lib/species';

/** Render once per page; <input list={SPECIES_DATALIST_ID}> gets suggestions. */
export function SpeciesDatalist() {
  return (
    <datalist id={SPECIES_DATALIST_ID}>
      {SPECIES.map((s) => (
        <option key={s} value={s} />
      ))}
    </datalist>
  );
}

export function Card({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="card">
      <header className="card__header">
        <h2 className="card__title">{title}</h2>
        {description && <p className="card__desc">{description}</p>}
      </header>
      <div className="card__body">{children}</div>
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger';
  loading?: boolean;
};

export function Button({ variant = 'primary', loading, children, disabled, ...rest }: ButtonProps) {
  return (
    <button className={`btn btn--${variant}`} disabled={disabled || loading} {...rest}>
      {loading ? 'Working…' : children}
    </button>
  );
}

export function Banner({ kind, children }: { kind: 'info' | 'error' | 'success'; children: ReactNode }) {
  if (!children) return null;
  return <div className={`banner banner--${kind}`}>{children}</div>;
}

/** Renders a JSON result block — used while backends are still being wired up. */
export function ResultJson({ data }: { data: unknown }) {
  if (data === null || data === undefined) return null;
  return <pre className="result-json">{JSON.stringify(data, null, 2)}</pre>;
}

/** Thumbnail results grid: click a thumbnail to open the full-size asset. */
export function ThumbnailGrid({ items }: { items: { thumbnailUrl: string; fullUrl: string; label?: string }[] }) {
  if (!items.length) return <p className="muted">No results.</p>;
  return (
    <div className="thumb-grid">
      {items.map((item, i) => (
        <a key={i} className="thumb" href={item.fullUrl} target="_blank" rel="noreferrer" title="Open full size">
          <img src={item.thumbnailUrl} alt={item.label ?? 'result'} loading="lazy" />
          {item.label && <span className="thumb__label">{item.label}</span>}
        </a>
      ))}
    </div>
  );
}
