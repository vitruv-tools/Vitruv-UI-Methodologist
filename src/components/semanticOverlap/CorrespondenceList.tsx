import React, { useEffect, useMemo, useRef, useState } from 'react';
import { themeVars } from '../../theme/theme';
import { visibleChildren, visibleCorrespondences } from '../../utils/semanticOverlap/linkDiagramLayout';
import type { Correspondence, ElementRef, OverlapResult } from '../../utils/semanticOverlap/types';
import { formatPercent } from './ScoreEdge';

type SortKey = 'score' | 'structural' | 'syntactic';

const SORT_LABELS: Record<SortKey, string> = { score: 'Score', structural: 'Structural', syntactic: 'Syntactic' };

const headerCell: React.CSSProperties = {
  padding: '10px 14px', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
  color: themeVars.textMuted, background: themeVars.tableHeader, textAlign: 'left', position: 'sticky', top: 0,
};
const bodyCell: React.CSSProperties = { padding: '10px 14px', fontSize: 13 };

const names = (refs: ElementRef[]) => refs.map(ref => ref.name).join(', ');

interface CorrespondenceListProps {
  result: OverlapResult;
  minScore: number;
  selectedId: string | null;
  onSelect: (correspondenceId: string | null) => void;
  /** Class correspondences whose attribute/reference correspondences are shown. */
  expandedIds: readonly string[];
  onToggleExpand: (correspondenceId: string) => void;
}

/**
 * Sortable table of the correspondences at or above the threshold; class rows expand to their
 * attribute and reference correspondences.
 */
export const CorrespondenceList: React.FC<CorrespondenceListProps> = ({
  result, minScore, selectedId, onSelect, expandedIds, onToggleExpand,
}) => {
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const selectedRow = useRef<HTMLTableRowElement>(null);
  const rows = useMemo(() => {
    const visible = visibleCorrespondences(result, minScore);
    const value = (c: typeof visible[number]) => (sortKey === 'score' ? c.score : c.scores[sortKey] ?? 0);
    return [...visible].sort((a, b) => value(b) - value(a));
  }, [result, minScore, sortKey]);

  useEffect(() => {
    selectedRow.current?.scrollIntoView?.({ block: 'nearest' });
  }, [selectedId]);

  const renderRow = (c: Correspondence, nested: boolean, expandable: boolean, expanded: boolean) => {
    const selected = c.id === selectedId;
    const nameCell: React.CSSProperties = {
      ...bodyCell,
      fontWeight: nested ? 400 : 500,
      fontStyle: nested ? 'italic' : 'normal',
      color: nested ? themeVars.textSecondary : themeVars.text,
      paddingLeft: nested ? 38 : 14,
    };
    return (
      <tr
        key={c.id}
        ref={selected ? selectedRow : undefined}
        aria-selected={selected}
        aria-level={nested ? 2 : 1}
        onClick={() => onSelect(selected ? null : c.id)}
        style={{
          cursor: 'pointer',
          borderBottom: `1px solid ${themeVars.borderSubtle}`,
          background: selected ? themeVars.brandSoft : themeVars.surface,
          boxShadow: selected ? 'inset 3px 0 0 #049484' : 'none',
        }}
      >
        <td style={nameCell}>
          {expandable && (
            <button
              type="button"
              aria-expanded={expanded}
              aria-label={`${expanded ? 'Hide' : 'Show'} attribute and reference matches of ${names(c.sources)}`}
              onClick={event => { event.stopPropagation(); onToggleExpand(c.id); }}
              style={{
                marginRight: 6, border: `1px solid ${themeVars.border}`, borderRadius: 4, background: 'transparent',
                color: themeVars.textSecondary, cursor: 'pointer', fontSize: 11, lineHeight: '14px', padding: '0 4px',
              }}
            >
              {expanded ? '−' : '+'}
            </button>
          )}
          {names(c.sources)}
        </td>
        <td style={{ ...nameCell, paddingLeft: 14 }}>{names(c.targets)}</td>
        <td style={{ ...bodyCell, color: themeVars.text, fontWeight: nested ? 500 : 600 }}>{formatPercent(c.score)}</td>
        <td style={{ ...bodyCell, color: themeVars.textSecondary }}>{formatPercent(c.scores.structural)}</td>
        <td style={{ ...bodyCell, color: themeVars.textSecondary }}>{formatPercent(c.scores.syntactic)}</td>
      </tr>
    );
  };

  if (rows.length === 0) {
    return (
      <div style={{ padding: 16, fontSize: 13, color: themeVars.textMuted }}>
        No correspondences at or above {formatPercent(minScore)}.
      </div>
    );
  }

  return (
    <div style={{ overflow: 'auto', maxHeight: '100%', border: `1px solid ${themeVars.border}`, borderRadius: 12, background: themeVars.surface }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }} aria-label="Correspondences">
        <thead>
          <tr>
            <th style={headerCell}>{result.source.name}</th>
            <th style={headerCell}>{result.target.name}</th>
            {(Object.keys(SORT_LABELS) as SortKey[]).map(key => (
              <th key={key} style={headerCell} aria-sort={sortKey === key ? 'descending' : 'none'}>
                <button
                  type="button"
                  onClick={() => setSortKey(key)}
                  style={{ all: 'unset', cursor: 'pointer', fontWeight: sortKey === key ? 700 : 600 }}
                >
                  {SORT_LABELS[key]}{sortKey === key ? ' ↓' : ''}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(c => {
            const children = visibleChildren(c, minScore);
            const expanded = expandedIds.includes(c.id);
            return (
              <React.Fragment key={c.id}>
                {renderRow(c, false, children.length > 0, expanded)}
                {expanded && children.map(child => renderRow(child, true, false, false))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
