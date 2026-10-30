import React from 'react';
import { themeVars } from '../../theme/theme';
import type { RepairRecord } from '../../utils/semanticOverlap/types';

const RULE_LABELS: Record<RepairRecord['rule'], string> = {
  subclass: 'Subclass outside its superclass’s counterpart',
  'reference-ends': 'Reference ends do not correspond',
  opposite: 'Opposite references mapped inconsistently',
  containment: 'Containment mapped to a plain reference',
};

const simpleNames = (names: readonly string[]) => names.map(name => name.slice(name.lastIndexOf('.') + 1)).join(', ');
const pair = (side: RepairRecord['removed']) =>
  `${simpleNames(side.sources)} ↔ ${simpleNames(side.targets)} (${Math.round(side.score * 100)} %)`;

/** Correspondences removed by consistency repair, with the rule, the one they contradicted and why. */
export const RepairsPanel: React.FC<{ repairs: readonly RepairRecord[] }> = ({ repairs }) => {
  if (repairs.length === 0) return null;
  return (
    <section
      aria-label="Consistency repairs"
      style={{ border: `1px dashed ${themeVars.border}`, borderRadius: 10, background: themeVars.surface, padding: '10px 14px' }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: themeVars.text, marginBottom: 6 }}>
        Removed by consistency repair ({repairs.length})
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {repairs.map(repair => (
          <li key={`${repair.rule}:${pair(repair.removed)}:${pair(repair.kept)}`} style={{ fontSize: 12, color: themeVars.textSecondary }}>
            <span style={{ fontWeight: 600, color: themeVars.text }}>{RULE_LABELS[repair.rule]}</span>
            {': removed '}{pair(repair.removed)}{', kept '}{pair(repair.kept)}
            <div style={{ color: themeVars.textMuted }}>{repair.reason}</div>
          </li>
        ))}
      </ul>
    </section>
  );
};
