/**
 * Draws a form for any website section from the field list the server sends (ContentSchema.java).
 * Each field type has one control here; lists of things (slides, links, footer columns) can be
 * added to, removed and reordered, and may contain lists themselves.
 */
import { createContext, useContext, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2 } from 'lucide-react';
import type { ContentField, ContentValue } from '../adminApi';
import { ImageField } from '../media/ImageField';
import { AdminButton, LinesField, SelectField, TextArea, TextField, Toggle } from '../ui';
import { cx } from '@/lib/format';

/** Problems from the last save, by place: "slides[0].line1". */
export type FieldErrors = Record<string, string>;

/** Products the "product" fields can point at: slug → name. */
export const ProductChoices = createContext<{ slug: string; name: string; status: string }[]>([]);

const labelOf = (f: ContentField) => (f.required ? `${f.label} *` : f.label);
const join = (base: string, key: string) => (base ? `${base}.${key}` : key);

/** A new, empty item for a list, filled with sensible starting values. */
export function blankItem(fields: ContentField[]): ContentValue {
  const item: ContentValue = {};
  for (const f of fields) {
    item[f.key] =
      f.type === 'toggle' ? false
        : f.type === 'number' ? (f.min ?? 0)
          : f.type === 'select' ? (f.options?.[0]?.value ?? '')
            : f.type === 'list' || f.type === 'strings' ? []
              : '';
  }
  return item;
}

export function FieldList({ fields, value, onChange, path, errors }: {
  fields: ContentField[]; value: ContentValue; onChange: (v: ContentValue) => void; path: string; errors: FieldErrors;
}) {
  return (
    <div className="space-y-5">
      {fields.map((f) => (
        <FieldInput
          key={f.key}
          field={f}
          value={value[f.key]}
          onChange={(v) => onChange({ ...value, [f.key]: v })}
          path={join(path, f.key)}
          errors={errors}
        />
      ))}
    </div>
  );
}

function FieldInput({ field: f, value, onChange, path, errors }: {
  field: ContentField; value: unknown; onChange: (v: unknown) => void; path: string; errors: FieldErrors;
}) {
  const products = useContext(ProductChoices);
  const error = errors[path];
  const str = typeof value === 'string' ? value : value == null ? '' : String(value);

  switch (f.type) {
    case 'text':
      return <TextField label={labelOf(f)} hint={f.hint} error={error} value={str} maxLength={f.max} onChange={onChange} />;
    case 'textarea':
      return <TextArea label={labelOf(f)} hint={f.hint ?? (f.max ? `Up to ${f.max} characters.` : undefined)} error={error} value={str} maxLength={f.max} rows={f.max && f.max > 600 ? 7 : 4} onChange={onChange} />;
    case 'link':
      return <TextField label={labelOf(f)} hint={f.hint} error={error} value={str} maxLength={f.max} placeholder="/shop" onChange={onChange} />;
    case 'number':
      return (
        <TextField
          label={labelOf(f)}
          hint={f.hint ?? (f.min != null && f.max != null ? `From ${f.min} to ${f.max}.` : undefined)}
          error={error}
          type="number"
          min={f.min}
          max={f.max}
          value={typeof value === 'number' ? value : str}
          onChange={(v) => onChange(v === '' ? '' : Number(v))}
          className="max-w-[12rem]"
        />
      );
    case 'select':
      return <SelectField label={labelOf(f)} hint={f.hint} error={error} value={str} options={f.options ?? []} onChange={onChange} />;
    case 'toggle':
      return <Toggle label={f.label} hint={f.hint} checked={value === true} onChange={onChange} />;
    case 'image':
      return (
        <div>
          <ImageField
            label={f.label}
            required={f.required}
            hint={f.hint}
            value={str}
            aspect={/mobile|phone|portrait/i.test(f.key + f.label) ? 'aspect-[4/5]' : 'aspect-[4/3]'}
            onChange={(url) => onChange(url)}
          />
          {error && <p className="mt-1.5 text-xs text-[rgb(var(--c-stamp))]">{error}</p>}
        </div>
      );
    case 'product': {
      const options = [
        ...(f.required ? [] : [{ value: '', label: '— None —' }]),
        ...products.map((p) => ({ value: p.slug, label: p.status === 'published' ? p.name : `${p.name} (${p.status} — not shown)` })),
      ];
      // Keep a saved choice visible even if that product has since been deleted.
      if (str && !products.some((p) => p.slug === str)) options.push({ value: str, label: `${str} (not found)` });
      return <SelectField label={labelOf(f)} hint={f.hint} error={error} value={str} options={options} onChange={onChange} />;
    }
    case 'strings': {
      const lines = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div>
          <LinesField
            label={labelOf(f)}
            hint={f.hint ?? `One per line${f.maxItems ? `, up to ${f.maxItems}` : ''}.`}
            value={lines}
            onChange={onChange}
            rows={Math.min(8, Math.max(3, lines.length + 1))}
          />
          {Object.entries(errors).filter(([k]) => k === path || k.startsWith(`${path}[`)).map(([k, m]) => (
            <p key={k} className="mt-1 text-xs text-[rgb(var(--c-stamp))]">{m}</p>
          ))}
        </div>
      );
    }
    case 'list':
      return <ListField field={f} value={Array.isArray(value) ? (value as ContentValue[]) : []} onChange={onChange} path={path} errors={errors} />;
    default:
      return null;
  }
}

let nextId = 1;

/** A repeatable group: slides, menu links, footer columns, size rows… */
function ListField({ field: f, value, onChange, path, errors }: {
  field: ContentField; value: ContentValue[]; onChange: (v: ContentValue[]) => void; path: string; errors: FieldErrors;
}) {
  // Stable keys so items keep their open/closed state when moved.
  const ids = useRef<number[]>([]);
  if (ids.current.length !== value.length) ids.current = value.map(() => nextId++);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const fields = f.fields ?? [];
  const full = f.maxItems != null && value.length >= f.maxItems;

  const move = (from: number, to: number) => {
    const items = [...value];
    const [it] = items.splice(from, 1);
    items.splice(to, 0, it);
    const keys = [...ids.current];
    const [k] = keys.splice(from, 1);
    keys.splice(to, 0, k);
    ids.current = keys;
    onChange(items);
  };
  const remove = (i: number) => {
    ids.current = ids.current.filter((_, j) => j !== i);
    onChange(value.filter((_, j) => j !== i));
  };
  const add = () => {
    const id = nextId++;
    ids.current = [...ids.current, id];
    setOpen((s) => new Set(s).add(id));
    onChange([...value, blankItem(fields)]);
  };

  const titleOf = (item: ContentValue, i: number) => {
    const labelField = fields.find((x) => x.key === f.itemLabel);
    const raw = labelField ? item[labelField.key] : undefined;
    const text = labelField?.type === 'select' ? labelField.options?.find((o) => o.value === raw)?.label : typeof raw === 'string' ? raw : undefined;
    return text?.trim() || `Item ${i + 1}`;
  };

  return (
    <fieldset>
      <legend className="mb-2 text-xs font-medium">
        {f.label}
        <span className="ml-2 font-normal text-graphite">{value.length}{f.maxItems ? ` of ${f.maxItems}` : ''}</span>
      </legend>
      {errors[path] && <p className="mb-2 text-xs text-[rgb(var(--c-stamp))]">{errors[path]}</p>}
      <ol className="space-y-2">
        {value.map((item, i) => {
          const id = ids.current[i];
          const itemPath = `${path}[${i}]`;
          const hasError = Object.keys(errors).some((k) => k.startsWith(itemPath));
          const isOpen = open.has(id) || hasError;
          const toggle = () => setOpen((s) => {
            const n = new Set(s);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
          });
          return (
            <li key={id} className={cx('border bg-paper', hasError ? 'border-stamp' : 'border-rule')}>
              <div className="flex items-center gap-1 pr-1">
                <button type="button" onClick={toggle} aria-expanded={isOpen} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left text-sm">
                  <span aria-hidden className="w-5 shrink-0 font-mono text-xs text-graphite">{i + 1}</span>
                  <span className="truncate font-medium">{titleOf(item, i)}</span>
                  {item.visible === false && <span className="shrink-0 text-xs text-graphite">(hidden)</span>}
                  <ChevronDown className={cx('ml-auto h-4 w-4 shrink-0 text-graphite transition-transform', isOpen && 'rotate-180')} aria-hidden />
                </button>
                <IconBtn label={`Move ${titleOf(item, i)} up`} disabled={i === 0} onClick={() => move(i, i - 1)}><ArrowUp className="h-4 w-4" /></IconBtn>
                <IconBtn label={`Move ${titleOf(item, i)} down`} disabled={i === value.length - 1} onClick={() => move(i, i + 1)}><ArrowDown className="h-4 w-4" /></IconBtn>
                <IconBtn label={`Remove ${titleOf(item, i)}`} onClick={() => remove(i)}><Trash2 className="h-4 w-4" /></IconBtn>
              </div>
              {isOpen && (
                <div className="border-t border-rule bg-newsprint/40 p-4">
                  <FieldList fields={fields} value={item} onChange={(v) => onChange(value.map((x, j) => (j === i ? v : x)))} path={itemPath} errors={errors} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <AdminButton variant="outline" className="mt-2 h-9 px-3 text-xs" onClick={add} disabled={full}>
        <Plus className="h-3.5 w-3.5" aria-hidden /> {full ? `Limit of ${f.maxItems} reached` : `Add ${singular(f.label)}`}
      </AdminButton>
    </fieldset>
  );
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="flex h-9 w-9 shrink-0 items-center justify-center text-graphite hover:text-ink disabled:opacity-30">
      {children}
    </button>
  );
}

/** "Slides" → "slide", "Menu links" → "menu link", for the Add button. */
function singular(label: string) {
  const first = label.split(/[,(]/)[0].trim().toLowerCase();
  return first.endsWith('ies') ? `${first.slice(0, -3)}y` : first.endsWith('s') ? first.slice(0, -1) : first;
}
