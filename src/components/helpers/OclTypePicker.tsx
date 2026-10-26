import React, { useMemo } from 'react';
import type { HelperTypeResponse } from '../../services/api';
import {
  COLLECTION_KINDS,
  PRIMITIVE_TYPES,
  formatTypeSelection,
  parseTypeSelection,
  type CollectionKind,
} from './helperUtils';

export const pickerControlStyle: React.CSSProperties = {
  padding: '7px 9px',
  border: '1.5px solid var(--v-border)',
  borderRadius: 8,
  fontSize: 13,
  background: 'var(--v-surface-muted)',
  color: 'var(--v-text)',
  fontFamily: 'inherit',
  minWidth: 0,
};

interface OclTypePickerProps {
  value: string;
  onChange: (value: string) => void;
  types: HelperTypeResponse[];
  /** Accessible name prefix, e.g. "Return type". */
  label: string;
  disabled?: boolean;
}

/**
 * Picks an OCL type: a primitive or metamodel type, optionally as a collection.
 * Types the two selects cannot represent (e.g. nested collections) are edited as text.
 */
export const OclTypePicker: React.FC<OclTypePickerProps> = ({ value, onChange, types, label, disabled }) => {
  const selection = parseTypeSelection(value);
  const byMetamodel = useMemo(() => {
    const groups = new Map<string, HelperTypeResponse[]>();
    for (const type of types) {
      if (type.kind === 'DATATYPE') continue;
      groups.set(type.metamodel, [...(groups.get(type.metamodel) ?? []), type]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [types]);

  if (!selection) {
    return (
      <input
        aria-label={`${label} (custom)`}
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        style={{ ...pickerControlStyle, flex: 1, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
      />
    );
  }

  const known =
    (PRIMITIVE_TYPES as readonly string[]).includes(selection.element)
    || types.some(t => t.qualifiedName === selection.element);

  return (
    <div style={{ display: 'flex', gap: 6, flex: 1, minWidth: 0 }}>
      <select
        aria-label={`${label} multiplicity`}
        value={selection.collection ?? ''}
        disabled={disabled}
        onChange={e => onChange(formatTypeSelection({
          ...selection,
          collection: (e.target.value || null) as CollectionKind | null,
        }))}
        style={{ ...pickerControlStyle, flex: '0 0 auto' }}
      >
        <option value="">Single value</option>
        {COLLECTION_KINDS.map(kind => <option key={kind} value={kind}>{kind} of</option>)}
      </select>
      <select
        aria-label={`${label} element type`}
        value={selection.element}
        disabled={disabled}
        onChange={e => onChange(formatTypeSelection({ ...selection, element: e.target.value }))}
        style={{ ...pickerControlStyle, flex: 1 }}
      >
        {!selection.element && <option value="" disabled>Choose a type…</option>}
        {!known && selection.element && <option value={selection.element}>{selection.element}</option>}
        <optgroup label="Primitive types">
          {PRIMITIVE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
        </optgroup>
        {byMetamodel.map(([metamodel, entries]) => (
          <optgroup key={metamodel} label={`Metamodel ${metamodel}`}>
            {entries.map(type => (
              <option key={type.qualifiedName} value={type.qualifiedName}>
                {type.qualifiedName}{type.kind === 'ENUM' ? ' (enum)' : ''}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
};
