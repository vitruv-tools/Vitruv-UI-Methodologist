import React from 'react';
import { themeVars, useTheme } from '../../theme/theme';
import { heatmapColor, heatmapColours, readableTextOn } from '../../utils/semanticOverlap/heatmapColor';
import type { MatrixCell } from '../../utils/semanticOverlap/overviewTypes';

export interface OverlapPairMatrixProps {
  /** Metamodels in matrix order. */
  metamodels: { key: string; name: string }[];
  cells: MatrixCell[][];
  onOpen: (pairId: string) => void;
}

const CELL = 56;
const percent = (value: number | null) => (value === null ? '—' : `${Math.round(value)} %`);

/** Symmetric metamodel × metamodel grid; the stronger the colour, the higher the overlap. */
export const OverlapPairMatrix: React.FC<OverlapPairMatrixProps> = ({ metamodels, cells, onOpen }) => {
  // Re-render on theme changes so the colours follow the theme's heatmap scale.
  useTheme();
  const colours = heatmapColours();
  return (
    <div
      role="grid"
      aria-label="Overlap matrix"
      style={{
        display: 'grid', gridTemplateColumns: `minmax(80px, max-content) repeat(${metamodels.length}, ${CELL}px)`,
        gap: 2, overflow: 'auto', fontSize: 12, alignItems: 'stretch',
      }}
    >
      <div role="row" style={{ display: 'contents' }}>
        <span role="columnheader" />
        {metamodels.map(m => (
          <span key={m.key} role="columnheader" title={m.name} style={{
            color: themeVars.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            textAlign: 'center', padding: '0 2px',
          }}>
            {m.name}
          </span>
        ))}
      </div>
      {metamodels.map((row, i) => (
        <div key={row.key} role="row" style={{ display: 'contents' }}>
          <span role="rowheader" title={row.name} style={{
            color: themeVars.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            alignSelf: 'center', paddingRight: 6,
          }}>
            {row.name}
          </span>
          {metamodels.map((column, j) => {
            const cell = cells[i][j];
            if (cell.pairId === null) {
              return <span key={column.key} role="gridcell" aria-label={`${row.name}: same metamodel`} style={{ height: CELL, background: themeVars.surfaceMuted, borderRadius: 4 }} />;
            }
            const label = `${row.name} ↔ ${column.name}`;
            const pairId = cell.pairId;
            const background = cell.value === null ? themeVars.surfaceMuted : heatmapColor(cell.value / 100, colours);
            return (
              <span key={column.key} role="gridcell">
                <button
                  type="button"
                  disabled={cell.value === null}
                  onClick={() => onOpen(pairId)}
                  aria-label={cell.value === null ? `${label}: not analysed` : `${label}: ${Math.round(cell.value)} % overlap`}
                  title={`${row.name} → ${column.name}: ${percent(i < j ? cell.forward : cell.backward)}\n${column.name} → ${row.name}: ${percent(i < j ? cell.backward : cell.forward)}`}
                  style={{
                    width: CELL, height: CELL, border: 'none', borderRadius: 4, background,
                    color: cell.value === null ? themeVars.textMuted : readableTextOn(background),
                    fontWeight: 600, fontSize: 12, cursor: cell.value === null ? 'default' : 'pointer',
                  }}
                >
                  {percent(cell.value)}
                </button>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};
