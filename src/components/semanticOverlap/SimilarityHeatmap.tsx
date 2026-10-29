import React, { useEffect, useMemo, useRef, useState } from 'react';
import { themeVars, useTheme } from '../../theme/theme';
import { isInstanceCorrespondence } from '../../utils/semanticOverlap/correspondenceKind';
import { visibleCorrespondences } from '../../utils/semanticOverlap/linkDiagramLayout';
import type { OverlapResult } from '../../utils/semanticOverlap/types';
import { formatPercent } from './ScoreEdge';

const MIN_CELL = 6;
const MAX_CELL = 24;
const TARGET_SIZE = 560;
const LABEL_WIDTH = 180;
const LABEL_HEIGHT = 120;

/** Cell under a point of the canvas (pixels relative to its top-left corner). */
export function cellAt(x: number, y: number, cellSize: number): { row: number; column: number } {
  return { row: Math.floor(y / cellSize), column: Math.floor(x / cellSize) };
}

export const heatmapCellSize = (rows: number, columns: number) =>
  Math.min(MAX_CELL, Math.max(MIN_CELL, Math.floor(TARGET_SIZE / Math.max(1, rows, columns))));

const simpleName = (qualifiedName: string) => qualifiedName.slice(qualifiedName.lastIndexOf('.') + 1);

function parseHex(color: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Resolves the theme's heatmap colours (CSS variables) to RGB at draw time. */
function heatmapColours(): [[number, number, number], [number, number, number]] {
  const style = getComputedStyle(document.documentElement);
  return [
    parseHex(style.getPropertyValue('--v-heatmap-low')) ?? [241, 245, 249],
    parseHex(style.getPropertyValue('--v-heatmap-high')) ?? [4, 148, 132],
  ];
}

interface SimilarityHeatmapProps {
  result: OverlapResult;
  minScore: number;
  selectedId: string | null;
  onSelect: (correspondenceId: string | null) => void;
  onCellFocus: (cell: { row: number; column: number } | null) => void;
}

/** Pairwise class similarity as a colour matrix (source rows × target columns). */
export const SimilarityHeatmap: React.FC<SimilarityHeatmapProps> = ({
  result, minScore, selectedId, onSelect, onCellFocus,
}) => {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{ row: number; column: number; x: number; y: number } | null>(null);
  const { rows, columns, overall, perMeasure } = result.classMatrix;
  const cellSize = heatmapCellSize(rows.length, columns.length);

  /** "row,column" → correspondence id (and whether it is class ↔ instance), for every visible pair. */
  const chosen = useMemo(() => {
    const rowIndex = new Map(rows.map((name, i) => [name, i]));
    const columnIndex = new Map(columns.map((name, j) => [name, j]));
    const cells = new Map<string, { id: string; instance: boolean }>();
    for (const c of visibleCorrespondences(result, minScore)) {
      for (const s of c.sources) {
        for (const t of c.targets) {
          cells.set(`${rowIndex.get(s.qualifiedName)},${columnIndex.get(t.qualifiedName)}`, { id: c.id, instance: isInstanceCorrespondence(c) });
        }
      }
    }
    return cells;
  }, [result, rows, columns, minScore]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const [low, high] = heatmapColours();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < rows.length; i++) {
      for (let j = 0; j < columns.length; j++) {
        const value = overall[i * columns.length + j] ?? 0;
        const mix = (k: number) => Math.round(low[k] + (high[k] - low[k]) * value);
        ctx.fillStyle = `rgb(${mix(0)}, ${mix(1)}, ${mix(2)})`;
        ctx.fillRect(j * cellSize, i * cellSize, cellSize - 1, cellSize - 1);
      }
    }
    for (const [key, { id, instance }] of chosen) {
      const [i, j] = key.split(',').map(Number);
      ctx.lineWidth = id === selectedId ? 3 : 2;
      ctx.strokeStyle = id === selectedId ? '#f59e0b' : '#0B1720';
      // Class ↔ instance correspondences are outlined dashed, like their links in the diagram.
      ctx.setLineDash?.(instance ? [3, 2] : []);
      ctx.strokeRect(j * cellSize + 1, i * cellSize + 1, cellSize - 3, cellSize - 3);
    }
    ctx.setLineDash?.([]);
  }, [rows, columns, overall, cellSize, chosen, selectedId, theme]);

  const cellFromEvent = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const cell = cellAt(event.clientX - box.left, event.clientY - box.top, cellSize);
    return cell.row >= 0 && cell.row < rows.length && cell.column >= 0 && cell.column < columns.length ? cell : null;
  };

  const syntacticAt = (k: number) => {
    const { alpha, beta } = result.settings.syntactic;
    return alpha * (perMeasure?.cosine?.[k] ?? 0) + beta * (perMeasure?.levenshtein?.[k] ?? 0);
  };
  const hoverIndex = hover ? hover.row * columns.length + hover.column : -1;

  return (
    <div style={{ overflow: 'auto', maxHeight: '100%', position: 'relative', background: themeVars.surface }}>
      <div style={{ display: 'grid', gridTemplateColumns: `${LABEL_WIDTH}px auto`, gridTemplateRows: `${LABEL_HEIGHT}px auto`, width: 'max-content' }}>
        <div style={{ position: 'sticky', top: 0, left: 0, zIndex: 3, background: themeVars.surface, fontSize: 11, color: themeVars.textMuted, padding: 6, display: 'flex', alignItems: 'flex-end' }}>
          {result.source.name} ↓ / {result.target.name} →
        </div>
        <div style={{ position: 'sticky', top: 0, zIndex: 2, background: themeVars.surface, display: 'flex', alignItems: 'flex-end' }}>
          {columns.map(name => (
            <div key={name} title={name} style={{ width: cellSize, height: LABEL_HEIGHT, position: 'relative', flexShrink: 0 }}>
              <span style={{
                position: 'absolute', bottom: 4, left: cellSize / 2, transformOrigin: 'left bottom', transform: 'rotate(-60deg)',
                whiteSpace: 'nowrap', fontSize: Math.min(11, Math.max(8, cellSize - 4)), color: themeVars.textSecondary,
              }}>
                {simpleName(name)}
              </span>
            </div>
          ))}
        </div>
        <div style={{ position: 'sticky', left: 0, zIndex: 2, background: themeVars.surface }}>
          {rows.map(name => (
            <div key={name} title={name} style={{
              height: cellSize, lineHeight: `${cellSize}px`, fontSize: Math.min(11, Math.max(8, cellSize - 4)),
              textAlign: 'right', paddingRight: 6, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', color: themeVars.textSecondary,
            }}>
              {simpleName(name)}
            </div>
          ))}
        </div>
        <canvas
          ref={canvasRef}
          data-testid="similarity-heatmap-canvas"
          width={columns.length * cellSize}
          height={rows.length * cellSize}
          style={{ cursor: 'pointer', display: 'block' }}
          onMouseMove={event => {
            const cell = cellFromEvent(event);
            setHover(cell ? { ...cell, x: event.nativeEvent.offsetX, y: event.nativeEvent.offsetY } : null);
          }}
          onMouseLeave={() => setHover(null)}
          onClick={event => {
            const cell = cellFromEvent(event);
            if (!cell) return;
            const id = chosen.get(`${cell.row},${cell.column}`)?.id ?? null;
            onSelect(id);
            onCellFocus(id ? null : cell);
          }}
        />
      </div>
      {hover && (
        <div role="tooltip" style={{
          position: 'absolute', left: LABEL_WIDTH + hover.x + 12, top: LABEL_HEIGHT + hover.y + 12, zIndex: 4,
          background: themeVars.surface, border: `1px solid ${themeVars.border}`, borderRadius: 8, padding: '6px 10px',
          fontSize: 12, color: themeVars.text, boxShadow: themeVars.cardShadow, pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          <div style={{ fontWeight: 600 }}>{simpleName(rows[hover.row])} ↔ {simpleName(columns[hover.column])}</div>
          <div>Overall {formatPercent(overall[hoverIndex] ?? 0)}</div>
          <div>Structural {formatPercent(perMeasure?.structural?.[hoverIndex] ?? 0)} · Syntactic {formatPercent(syntacticAt(hoverIndex))}</div>
        </div>
      )}
    </div>
  );
};
