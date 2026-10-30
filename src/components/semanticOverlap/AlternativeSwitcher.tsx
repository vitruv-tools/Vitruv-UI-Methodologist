import React from 'react';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { themeVars } from '../../theme/theme';
import type { Alternative } from '../../utils/semanticOverlap/types';

const LABEL_TEXT: Record<string, string> = { lexical: 'Lexical', balanced: 'Balanced', structural: 'Structural' };

/** "Balanced, lexical" for an alternative that stands for several merged ones. */
const labelOf = (alternative: Alternative) =>
  alternative.label.split(', ').map(label => LABEL_TEXT[label] ?? label).join(' · ');

/**
 * Switches between the alternative results of a run: one leaning on names, one on structure, and
 * the balanced default. Shown only for results with alternatives.
 */
export const AlternativeSwitcher: React.FC<{
  alternatives: readonly Alternative[];
  selected: number | null;
  onSelect: (index: number) => void;
}> = ({ alternatives, selected, onSelect }) => (
  <div role="group" aria-label="Alternative results" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
    <span style={{ fontSize: 12, color: themeVars.textSecondary }}>Alternative</span>
    <ToggleButtonGroup
      size="small"
      exclusive
      value={selected}
      onChange={(_event, next: number | null) => { if (next !== null) onSelect(next); }}
    >
      {alternatives.map((alternative, index) => (
        <ToggleButton
          key={alternative.label}
          value={index}
          aria-label={`${labelOf(alternative)}${alternative.isDefault ? ' (default)' : ''}`}
          title={`Lexical ${alternative.objectives.lexical.toFixed(2)} · structural ${alternative.objectives.structural.toFixed(2)}`}
          sx={{ textTransform: 'none', fontSize: 12 }}
        >
          {labelOf(alternative)}
          {alternative.isDefault && <span style={{ marginLeft: 6, fontSize: 10, color: themeVars.textMuted }}>default</span>}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  </div>
);
