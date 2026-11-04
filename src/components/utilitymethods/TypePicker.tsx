import React, { useMemo } from 'react';
import type { UtilityMethodTypeResponse } from '../../services/api';
import {
  COLLECTION_KINDS,
  PRIMITIVE_TYPES,
  formatTypeSelection,
  parseTypeSelection,
  type CollectionKind,
} from './utilityMethodUtils';

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

interface TypePickerProps {
  value: string;
  onChange: (value: string) => void;
  types: UtilityMethodTypeResponse[];
  /** Accessible name prefix, e.g. "Return type". */
  label: string;
  disabled?: boolean;
  /** Offers `void`, for return types. */
  allowVoid?: boolean;
  /** Called with the qualified Java name of a metamodel type that was picked by its simple name. */
  onTypeChosen?: (javaName: string) => void;
}

/** The name a metamodel type is written with: its simple name, unless another type shares it. */
function typeName(type: UtilityMethodTypeResponse, types: UtilityMethodTypeResponse[]): string {
  const ambiguous = types.some(other => other !== type && other.name === type.name);
  return ambiguous ? type.javaName : type.name;
}

/**
 * Picks an Xtend/Java type: a value or metamodel type, optionally as a collection.
 * Types the two selects cannot represent (e.g. nested generics) are edited as text.
 */
export const TypePicker: React.FC<TypePickerProps> = ({ value, onChange, types, label, disabled, allowVoid, onTypeChosen }) => {
  const selection = parseTypeSelection(value);
  const byMetamodel = useMemo(() => {
    const groups = new Map<string, UtilityMethodTypeResponse[]>();
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

  const valueTypes: readonly string[] = allowVoid ? [...PRIMITIVE_TYPES, 'void'] : PRIMITIVE_TYPES;
  const known =
    valueTypes.includes(selection.element)
    || types.some(t => typeName(t, types) === selection.element);

  const chooseElement = (element: string) => {
    onChange(formatTypeSelection({ ...selection, element }));
    const chosen = types.find(t => typeName(t, types) === element);
    if (chosen) onTypeChosen?.(chosen.javaName);
  };

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
        onChange={e => chooseElement(e.target.value)}
        style={{ ...pickerControlStyle, flex: 1 }}
      >
        {!selection.element && <option value="" disabled>Choose a type…</option>}
        {!known && selection.element && <option value={selection.element}>{selection.element}</option>}
        <optgroup label="Value types">
          {valueTypes.map(type => <option key={type} value={type}>{type}</option>)}
        </optgroup>
        {byMetamodel.map(([metamodel, entries]) => (
          <optgroup key={metamodel} label={`Metamodel ${metamodel}`}>
            {entries.map(type => (
              <option key={type.javaName} value={typeName(type, types)} title={type.javaName}>
                {typeName(type, types)}{type.kind === 'ENUM' ? ' (enum)' : ''}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
};
