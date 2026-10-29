import React from 'react';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { themeVars } from '../../theme/theme';
import { APPROACH_IDS, APPROACHES } from '../../utils/semanticOverlap/approaches/registry';
import type { ApproachId } from '../../utils/semanticOverlap/approaches/types';

interface ApproachSelectorProps {
  value: ApproachId;
  onChange: (approach: ApproachId) => void;
  disabled?: boolean;
}

/** Chooses the matching approach: the paper approach (frozen) or the improved one. */
export const ApproachSelector: React.FC<ApproachSelectorProps> = ({ value, onChange, disabled }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
    <span style={{ fontSize: 13, fontWeight: 600, color: themeVars.textSecondary }}>Approach</span>
    <ToggleButtonGroup
      exclusive
      size="small"
      aria-label="Matching approach"
      value={value}
      disabled={disabled}
      onChange={(_event, next: ApproachId | null) => {
        if (next && next !== value) onChange(next);
      }}
    >
      {APPROACH_IDS.map(id => (
        <ToggleButton key={id} value={id} sx={{ textTransform: 'none' }}>{APPROACHES[id].label}</ToggleButton>
      ))}
    </ToggleButtonGroup>
  </div>
);
