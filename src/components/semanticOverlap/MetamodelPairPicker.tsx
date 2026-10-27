import React from 'react';
import { themeVars } from '../../theme/theme';
import type { LibraryMetaModel } from '../../utils/metaModelList';
import { appendMetaModelVersion } from '../../utils/metaModelVersion';

interface MetamodelPairPickerProps {
  models: readonly LibraryMetaModel[];
  sourceId: number | null;
  targetId: number | null;
  disabled?: boolean;
  onSourceChange: (id: number | null) => void;
  onTargetChange: (id: number | null) => void;
  onSwap: () => void;
}

const selectStyle: React.CSSProperties = {
  minWidth: 240, padding: '9px 12px', borderRadius: 8, fontSize: 14,
  border: `1.5px solid ${themeVars.border}`, background: themeVars.inputBg, color: themeVars.text,
};

const label = (model: LibraryMetaModel) => appendMetaModelVersion(model.name, model.version);

const ModelSelect: React.FC<{
  id: string; title: string; models: readonly LibraryMetaModel[]; value: number | null; disabled?: boolean;
  onChange: (id: number | null) => void;
}> = ({ id, title, models, value, disabled, onChange }) => {
  const own = models.filter(m => m.isOwnedByCurrentUser);
  const other = models.filter(m => !m.isOwnedByCurrentUser);
  return (
    <label htmlFor={id} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: themeVars.textSecondary }}>
      {title}
      <select
        id={id}
        value={value ?? ''}
        disabled={disabled}
        onChange={event => onChange(event.target.value === '' ? null : Number(event.target.value))}
        style={selectStyle}
      >
        <option value="">Choose a metamodel…</option>
        {own.length > 0 && (
          <optgroup label="My models">
            {own.map(model => <option key={model.id} value={model.id}>{label(model)}</option>)}
          </optgroup>
        )}
        {other.length > 0 && (
          <optgroup label="Public models">
            {other.map(model => <option key={model.id} value={model.id}>{label(model)}</option>)}
          </optgroup>
        )}
      </select>
    </label>
  );
};

/** Chooses the source and target metamodel from the Model Library. */
export const MetamodelPairPicker: React.FC<MetamodelPairPickerProps> = ({
  models, sourceId, targetId, disabled, onSourceChange, onTargetChange, onSwap,
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
      <ModelSelect id="overlap-source" title="Source metamodel" models={models} value={sourceId} disabled={disabled} onChange={onSourceChange} />
      <button
        type="button"
        onClick={onSwap}
        disabled={disabled || (sourceId === null && targetId === null)}
        aria-label="Swap source and target"
        title="Swap source and target"
        style={{
          height: 40, width: 40, borderRadius: 8, border: `1.5px solid ${themeVars.border}`,
          background: themeVars.surface, color: themeVars.text, cursor: 'pointer', fontSize: 16,
        }}
      >
        ⇄
      </button>
      <ModelSelect id="overlap-target" title="Target metamodel" models={models} value={targetId} disabled={disabled} onChange={onTargetChange} />
    </div>
    {sourceId !== null && sourceId === targetId && (
      <span role="note" style={{ fontSize: 12, color: themeVars.textMuted }}>
        Source and target are the same metamodel — useful as a sanity check: every class should match itself.
      </span>
    )}
  </div>
);
