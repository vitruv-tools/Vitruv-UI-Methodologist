import React from 'react';
import { themeVars } from '../../theme/theme';
import { pairError, pairLabel, pairStatus, pairValues } from '../../utils/semanticOverlap/overview';
import type { PairOverlap, PairStatus } from '../../utils/semanticOverlap/overviewTypes';

const STATUS_LABELS: Record<PairStatus, string> = {
  pending: 'waiting',
  running: 'analysing…',
  done: '',
  partial: 'one direction only',
  failed: 'failed',
  'not-analysed': 'not analysed',
};

export interface OverlapPairListProps {
  /** Pairs in the order to show, highest overlap first. */
  pairs: PairOverlap[];
  names: ReadonlyMap<string, string>;
  onOpen: (pairId: string) => void;
}

/** Ranked metamodel pairs with their overlap; a pair with a result opens its closer look. */
export const OverlapPairList: React.FC<OverlapPairListProps> = ({ pairs, names, onOpen }) => (
  <ol aria-label="Pairs by overlap" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
    {pairs.map((pair, rank) => {
      const { value, correspondences } = pairValues(pair);
      const status = pairStatus(pair);
      const error = status === 'failed' ? pairError(pair) : null;
      const label = pairLabel(pair, names);
      return (
        <li key={pair.id}>
          <button
            type="button"
            disabled={value === null}
            onClick={() => onOpen(pair.id)}
            aria-label={value === null ? `${label}: ${STATUS_LABELS[status]}` : `${label}: ${Math.round(value)} % overlap, open details`}
            style={{
              width: '100%', display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr) auto', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 10, border: `1px solid ${themeVars.border}`, background: themeVars.surface,
              color: themeVars.text, textAlign: 'left', cursor: value === null ? 'default' : 'pointer', fontSize: 14,
            }}
          >
            <span style={{ color: themeVars.textMuted, fontSize: 12 }}>{rank + 1}.</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{label}</span>
              {(STATUS_LABELS[status] || error) && (
                <span style={{ display: 'block', fontSize: 12, color: status === 'failed' ? themeVars.dangerText : themeVars.textMuted }}>
                  {error ?? STATUS_LABELS[status]}
                </span>
              )}
            </span>
            <span style={{ textAlign: 'right' }}>
              <span style={{ display: 'block', fontWeight: 700 }}>{value === null ? '—' : `${Math.round(value)} %`}</span>
              {correspondences !== null && (
                <span style={{ display: 'block', fontSize: 12, color: themeVars.textSecondary }}>
                  {correspondences} {correspondences === 1 ? 'correspondence' : 'correspondences'}
                </span>
              )}
            </span>
          </button>
        </li>
      );
    })}
  </ol>
);
