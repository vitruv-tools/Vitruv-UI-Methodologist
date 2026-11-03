import React from 'react';
import type { OverlapTab } from '../../store/SemanticOverlap';
import { themeVars } from '../../theme/theme';
import type { OverlapResult } from '../../utils/semanticOverlap/types';
import { AlternativeSwitcher } from './AlternativeSwitcher';
import { CorrespondenceLinkDiagram } from './CorrespondenceLinkDiagram';
import { CorrespondenceList } from './CorrespondenceList';
import { OverlapSummary } from './OverlapSummary';
import { RepairsPanel } from './RepairsPanel';
import { SimilarityHeatmap } from './SimilarityHeatmap';
import { TypeObjectPatternPanel } from './TypeObjectPatternPanel';

const TABS: { id: OverlapTab; label: string }[] = [
  { id: 'diagram', label: 'Link diagram' },
  { id: 'heatmap', label: 'Heatmap' },
];

/** What the result views show: tab, filter, selection, expanded rows and alternative. */
export interface OverlapResultViewState {
  activeTab: OverlapTab;
  minScore: number;
  selectedCorrespondenceId: string | null;
  collapsedUnmatched: boolean;
  expandedCorrespondenceIds: string[];
  selectedAlternative: number | null;
}

export interface OverlapResultViewActions {
  setActiveTab(tab: OverlapTab): void;
  selectCorrespondence(id: string | null): void;
  setHoveredCell(cell: { row: number; column: number } | null): void;
  setCollapsedUnmatched(value: boolean): void;
  toggleExpanded(correspondenceId: string): void;
  selectAlternative(index: number): void;
}

export interface OverlapResultPanelProps {
  /** The result as shown, i.e. with the selected alternative applied. */
  result: OverlapResult;
  view: OverlapResultViewState;
  actions: OverlapResultViewActions;
}

/** Summary, link diagram, heatmap and correspondence list of one overlap result. */
export const OverlapResultPanel: React.FC<OverlapResultPanelProps> = ({ result, view, actions }) => (
  <>
    <OverlapSummary result={result} />
    {result.alternatives && result.alternatives.length > 1 && (
      <AlternativeSwitcher alternatives={result.alternatives} selected={view.selectedAlternative} onSelect={actions.selectAlternative} />
    )}
    {result.typeObjectPatterns && result.typeObjectPatterns.length > 0 && (
      <TypeObjectPatternPanel patterns={result.typeObjectPatterns} />
    )}
    {result.repairs && result.repairs.length > 0 && <RepairsPanel repairs={result.repairs} />}
    <div role="tablist" aria-label="Result views" style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${themeVars.border}` }}>
      {TABS.map(tab => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={view.activeTab === tab.id}
          onClick={() => actions.setActiveTab(tab.id)}
          style={{
            padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14,
            fontWeight: view.activeTab === tab.id ? 700 : 500,
            color: view.activeTab === tab.id ? themeVars.text : themeVars.textSecondary,
            borderBottom: `2px solid ${view.activeTab === tab.id ? '#049484' : 'transparent'}`,
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
    {/* flexShrink 0: the page is a scrolling flex column, which would otherwise squeeze this row. */}
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(360px, 2fr)', gap: 16, flexShrink: 0 }}>
      <div role="tabpanel" style={{ border: `1px solid ${themeVars.border}`, borderRadius: 12, overflow: 'hidden', background: themeVars.workspaceBg, height: 560 }}>
        {view.activeTab === 'diagram' ? (
          <CorrespondenceLinkDiagram
            result={result}
            minScore={view.minScore}
            selectedId={view.selectedCorrespondenceId}
            collapsedUnmatched={view.collapsedUnmatched}
            expandedIds={view.expandedCorrespondenceIds}
            onSelect={actions.selectCorrespondence}
            onToggleUnmatched={actions.setCollapsedUnmatched}
            onToggleExpand={actions.toggleExpanded}
          />
        ) : (
          <SimilarityHeatmap
            result={result}
            minScore={view.minScore}
            selectedId={view.selectedCorrespondenceId}
            onSelect={actions.selectCorrespondence}
            onCellFocus={actions.setHoveredCell}
          />
        )}
      </div>
      <div style={{ height: 560 }}>
        <CorrespondenceList
          result={result}
          minScore={view.minScore}
          selectedId={view.selectedCorrespondenceId}
          onSelect={actions.selectCorrespondence}
          expandedIds={view.expandedCorrespondenceIds}
          onToggleExpand={actions.toggleExpanded}
        />
      </div>
    </div>
    
  </>
);
