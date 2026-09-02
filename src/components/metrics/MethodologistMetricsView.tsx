import React, { useEffect, useMemo, useState } from 'react';
import type { Edge, Node } from 'reactflow';
import { readStoredViewTypes, type ViewType } from '../../hooks/useViewTypes';
import { apiService } from '../../services/api';
import { APP_FONT } from '../ui/sharedStyles';
import {
  collectMetamodelInputs,
  collectReactionInputs,
  computeMethodologistMetrics,
  type MethodologistMetrics,
} from '../../utils/methodologistMetrics';

const T = {
  surface: 'var(--v-surface)',
  mutedBg: 'var(--v-surface-muted)',
  tableHeader: 'var(--v-table-header)',
  text: 'var(--v-text)',
  secondary: 'var(--v-text-secondary)',
  muted: 'var(--v-text-muted)',
  border: 'var(--v-border)',
  borderSubtle: 'var(--v-border-subtle)',
  cardBorder: 'var(--v-card-border)',
  brand: '#049484',
};

export interface MethodologistMetricsViewProps {
  vsumId?: number | null;
  nodes: Node[];
  edges: Edge[];
  viewTypes: ViewType[];
  /** When false, skip backend fetches (overlay is hidden). */
  enabled?: boolean;
  onClose?: () => void;
}

function formatAvg(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '0';
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

const InsightCard: React.FC<{ label: string; value: string | number; sub?: string }> = ({
  label, value, sub,
}) => (
  <div style={{
    background: T.surface,
    borderRadius: 6,
    border: `1px solid ${T.cardBorder}`,
    padding: '8px 10px',
    minWidth: 0,
  }}>
    <div style={{ fontSize: 10, color: T.muted, fontWeight: 600, marginBottom: 2, letterSpacing: '0.03em' }}>
      {label}
    </div>
    <div style={{ fontSize: typeof value === 'number' ? 18 : 13, fontWeight: 700, color: T.brand, lineHeight: 1.15 }}>
      {value}
    </div>
    {sub && <div style={{ fontSize: 10, color: T.muted, marginTop: 2, lineHeight: 1.3 }}>{sub}</div>}
  </div>
);

const Section: React.FC<{ title: string; caption: string; children: React.ReactNode }> = ({
  title, caption, children,
}) => (
  <section style={{ marginBottom: 16 }}>
    <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 1 }}>{title}</div>
    <div style={{ fontSize: 11, color: T.muted, marginBottom: 8, lineHeight: 1.35 }}>{caption}</div>
    {children}
  </section>
);

function tableStyle(): React.CSSProperties {
  return {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 11,
    color: T.text,
  };
}

function thStyle(align: 'left' | 'right' = 'left'): React.CSSProperties {
  return {
    textAlign: align,
    padding: '6px 8px',
    color: T.muted,
    fontWeight: 600,
    fontSize: 10,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    borderBottom: `1px solid ${T.border}`,
    background: T.tableHeader,
  };
}

function tdStyle(align: 'left' | 'right' = 'left'): React.CSSProperties {
  return {
    textAlign: align,
    padding: '6px 8px',
    borderBottom: `1px solid ${T.borderSubtle}`,
    color: T.secondary,
  };
}

const MetamodelTable: React.FC<{ metrics: MethodologistMetrics }> = ({ metrics }) => (
  <div style={{ overflowX: 'auto', border: `1px solid ${T.border}`, borderRadius: 6, background: T.surface }}>
    <table style={tableStyle()}>
      <thead>
        <tr>
          <th style={thStyle()}>Metamodel</th>
          <th style={thStyle('right')}>Classes</th>
          <th style={thStyle('right')}>Abstract</th>
          <th style={thStyle('right')}>Concrete</th>
          <th style={thStyle('right')}>Attributes</th>
          <th style={thStyle('right')}>Refs (cont. / assoc.)</th>
          <th style={thStyle('right')}>Enums / literals</th>
          <th style={thStyle('right')}>Packages</th>
          <th style={thStyle('right')} title="Depth of Inheritance Tree — how many superclasses sit above a class (roots are 0)">Inheritance max / avg</th>
        </tr>
      </thead>
      <tbody>
        {metrics.metamodels.map(mm => (
          <tr key={mm.name || `metamodel-${mm.classCount}`}>
            <td style={{ ...tdStyle(), fontWeight: 600, color: T.text }}>{mm.name || 'Unnamed'}</td>
            <td style={tdStyle('right')}>{mm.classCount}</td>
            <td style={tdStyle('right')}>{mm.abstractClassCount}</td>
            <td style={tdStyle('right')}>{mm.concreteClassCount}</td>
            <td style={tdStyle('right')}>{mm.attributesTotal}</td>
            <td style={tdStyle('right')}>{mm.containmentReferences} / {mm.nonContainmentReferences}</td>
            <td style={tdStyle('right')}>{mm.enumCount} / {mm.enumLiteralCount}</td>
            <td style={tdStyle('right')}>{mm.packageCount}</td>
            <td style={tdStyle('right')}>{mm.inheritanceDepthMax} / {formatAvg(mm.inheritanceDepthAvg)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const AttributesPerClass: React.FC<{ metrics: MethodologistMetrics }> = ({ metrics }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
    {metrics.metamodels.map(mm => (
      <div key={mm.name} style={{ border: `1px solid ${T.border}`, borderRadius: 6, overflow: 'hidden', background: T.surface }}>
        <div style={{ padding: '6px 10px', background: T.tableHeader, fontSize: 11, fontWeight: 700, color: T.text }}>
          {mm.name || 'Unnamed'}
        </div>
        <table style={tableStyle()}>
          <thead>
            <tr>
              <th style={thStyle()}>Class</th>
              <th style={thStyle('right')}>Attributes</th>
              <th style={thStyle('right')} title="Depth of Inheritance Tree — how many superclasses sit above this class (roots are 0)">Depth</th>
            </tr>
          </thead>
          <tbody>
            {mm.classes.map(cls => (
              <tr key={cls.qualifiedName}>
                <td style={tdStyle()}>
                  {cls.name}
                  {cls.isAbstract ? <span style={{ color: T.muted }}> (abstract)</span> : null}
                </td>
                <td style={tdStyle('right')}>{cls.attributeCount}</td>
                <td style={tdStyle('right')}>{cls.inheritanceDepth}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ))}
  </div>
);

const CorrespondenceTable: React.FC<{ metrics: MethodologistMetrics }> = ({ metrics }) => (
  <div style={{ overflowX: 'auto', border: `1px solid ${T.border}`, borderRadius: 6, background: T.surface }}>
    <table style={tableStyle()}>
      <thead>
        <tr>
          <th style={thStyle()}>Correspondence type</th>
          <th style={thStyle('right')}>Types in file</th>
          <th style={thStyle('right')}>Reactions</th>
          <th style={thStyle('right')}>Routines</th>
          <th style={thStyle('right')}>LOC (file)</th>
          <th style={thStyle()}>LOC per reaction</th>
        </tr>
      </thead>
      <tbody>
        {metrics.correspondenceTypes.map(ct => (
          <tr key={ct.id}>
            <td style={{ ...tdStyle(), fontWeight: 600, color: T.text }}>
              {ct.sourceName} → {ct.targetName}
            </td>
            <td style={tdStyle('right')}>{ct.correspondenceTypeCount}</td>
            <td style={tdStyle('right')}>{ct.reactionCount}</td>
            <td style={tdStyle('right')}>{ct.routineCount}</td>
            <td style={tdStyle('right')}>{ct.linesOfCode}</td>
            <td style={tdStyle()}>
              {ct.reactions.length === 0
                ? '—'
                : ct.reactions.map(r => `${r.name}: ${r.linesOfCode}`).join(', ')}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const MethodologistMetricsView: React.FC<MethodologistMetricsViewProps> = ({
  vsumId,
  nodes,
  edges,
  viewTypes,
  enabled = true,
  onClose,
}) => {
  const [oclContent, setOclContent] = useState('');
  const [codeByEdgeId, setCodeByEdgeId] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!enabled || vsumId == null) {
      setOclContent('');
      return;
    }
    const request = apiService.getRuleSets?.(vsumId);
    if (!request) return;
    let cancelled = false;
    Promise.resolve(request).then(sets => {
      if (cancelled) return;
      setOclContent((sets ?? []).map(s => s.oclContent ?? '').filter(Boolean).join('\n\n'));
    }).catch(() => {
      if (!cancelled) setOclContent('');
    });
    return () => { cancelled = true; };
  }, [enabled, vsumId]);

  useEffect(() => {
    if (!enabled) {
      setCodeByEdgeId({});
      return;
    }
    const missing = edges.filter(e => (
      e.type === 'reactions'
      && !e.data?.code
      && typeof e.data?.reactionFileId === 'number'
    ));
    if (missing.length === 0) {
      setCodeByEdgeId({});
      return;
    }
    let cancelled = false;
    Promise.all(missing.map(async edge => {
      try {
        const code = await apiService.getFile(edge.data.reactionFileId as number);
        return [edge.id, code] as const;
      } catch {
        return [edge.id, ''] as const;
      }
    })).then(entries => {
      if (cancelled) return;
      setCodeByEdgeId(Object.fromEntries(entries));
    });
    return () => { cancelled = true; };
  }, [enabled, edges]);

  const resolvedViewTypes = useMemo(() => {
    if (viewTypes.length > 0 || vsumId == null) return viewTypes;
    return readStoredViewTypes(String(vsumId));
  }, [viewTypes, vsumId]);

  const metrics = useMemo(
    () => computeMethodologistMetrics({
      metamodels: collectMetamodelInputs(nodes),
      reactions: collectReactionInputs(nodes, edges, codeByEdgeId),
      viewTypes: resolvedViewTypes,
      oclContent,
    }),
    [nodes, edges, resolvedViewTypes, oclContent, codeByEdgeId],
  );

  return (
    <div
      data-testid="methodologist-metrics-view"
      style={{
        width: 'min(840px, calc(100vw - 40px))',
        maxHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: T.mutedBg,
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        fontFamily: APP_FONT,
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        padding: '12px 16px',
        background: T.surface,
        borderBottom: `1px solid ${T.border}`,
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 2 }}>
            Basic Metrics
          </div>
          <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.35 }}>
            Size metrics for this VSUM: metamodels, views, correspondences, reactions, and OCL.
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            aria-label="Close metrics"
            title="Close"
            onClick={onClose}
            style={{
              flexShrink: 0,
              width: 40,
              height: 40,
              borderRadius: '50%',
              border: `1.5px solid ${T.border}`,
              background: T.mutedBg,
              color: T.text,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = T.brand;
              e.currentTarget.style.borderColor = T.brand;
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = T.mutedBg;
              e.currentTarget.style.borderColor = T.border;
              e.currentTarget.style.color = T.text;
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 16px 18px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(112px, 1fr))', gap: 6, marginBottom: 16 }}>
          <InsightCard label="Metamodels" value={metrics.metamodels.length} />
          <InsightCard label="Classes" value={metrics.classCount} sub={`${metrics.abstractClassCount} abs. · ${metrics.concreteClassCount} conc.`} />
          <InsightCard label="Attributes" value={metrics.attributesTotal} />
          <InsightCard
            label="References"
            value={metrics.referencesTotal}
            sub={`${metrics.containmentReferences} cont. · ${metrics.nonContainmentReferences} assoc.`}
          />
          <InsightCard label="Enums / literals" value={`${metrics.enumCount} / ${metrics.enumLiteralCount}`} />
          <InsightCard label="Packages" value={metrics.packageCount} sub="Incl. subpackages" />
          <InsightCard
            label="View types"
            value={metrics.viewTypeCount}
            sub={`${metrics.singleViewTypeCount} single · ${metrics.multiViewTypeCount} multi`}
          />
          <InsightCard label="Viewpoints" value={metrics.viewpointCount} sub="Unique labels" />
          <InsightCard label="Corr. types" value={metrics.correspondenceTypeCount} />
          <InsightCard label="Reactions" value={metrics.reactionCount} />
          <InsightCard label="OCL constraints" value={metrics.oclConstraintCount} />
          <InsightCard
            label="Model elements"
            value={metrics.instanceElementTotal}
            sub={metrics.instanceModels.length === 0 ? 'No instance models' : `Across ${metrics.instanceModels.length} models`}
          />
        </div>

        <Section title="Metamodels" caption="Classes, features, enumerations, packages, and inheritance depth per metamodel. Inheritance depth (DIT) is how many superclasses sit above a class; roots are 0.">
          {metrics.metamodels.length === 0 ? (
            <div style={{ fontSize: 12, color: T.muted }}>Add metamodels on the Modeling canvas to populate this table.</div>
          ) : (
            <MetamodelTable metrics={metrics} />
          )}
        </Section>

        {metrics.metamodels.some(mm => mm.classes.length > 0) && (
          <Section title="Attributes per class" caption="Attribute counts and inheritance depth for each classifier. Depth 0 means the class has no superclass in this metamodel.">
            <AttributesPerClass metrics={metrics} />
          </Section>
        )}

        <Section title="Views" caption="View types on the Views canvas. Viewpoints are unique labels; view instances are not stored here.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
            <InsightCard label="View types" value={metrics.viewTypeCount} />
            <InsightCard label="Viewpoints" value={metrics.viewpointCount} />
            <InsightCard label="Views (instances)" value={0} sub="Not persisted" />
          </div>
        </Section>

        <Section title="Correspondences and reactions" caption="Each reactions file is one correspondence specification. Types inside a file come from add correspondence / corresponding to.">
          {metrics.correspondenceTypes.length === 0 ? (
            <div style={{ fontSize: 12, color: T.muted }}>Draw reaction edges between metamodels to populate this table.</div>
          ) : (
            <CorrespondenceTable metrics={metrics} />
          )}
          <div style={{ marginTop: 8, fontSize: 11, color: T.muted }}>
            Correspondence instances: {metrics.correspondenceInstanceCount}
            {metrics.correspondenceInstanceCount === 0 ? ' (none loaded)' : ''}
          </div>
        </Section>
      </div>
    </div>
  );
};
