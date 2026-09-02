import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { readStoredOcl, writeStoredOcl } from '../../utils/oclStorage';
import { downloadBlobAsFile } from '../../utils/downloadFile';
import {
  METRICS_CATEGORIES,
  METRICS_CATEGORY_LABELS,
  derivedMetricRows,
  formatAvg,
  buildMetricsReportZip,
  formatSelectedLabel,
  metricsResultFileName,
  orderedMetricsCategories,
  type MetricsCategory,
} from '../../utils/metricsReport';

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
  projectName?: string | null;
  nodes: Node[];
  edges: Edge[];
  viewTypes: ViewType[];
  /** When false, skip backend fetches (overlay is hidden). */
  enabled?: boolean;
  onClose?: () => void;
}

function namesList(names: string[]): string {
  return names.length === 0 ? '—' : names.join(', ');
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

const InsightList: React.FC<{ label: string; names: string[]; hint?: string }> = ({ label, names, hint }) => (
  <div style={{
    background: T.surface,
    borderRadius: 6,
    border: `1px solid ${T.cardBorder}`,
    padding: '8px 10px',
    minWidth: 0,
  }}>
    <div style={{ fontSize: 10, color: T.muted, fontWeight: 600, marginBottom: 4, letterSpacing: '0.03em' }}>
      {label}{hint ? ` · ${hint}` : ''} ({names.length})
    </div>
    <div style={{ fontSize: 11, color: T.secondary, lineHeight: 1.4, wordBreak: 'break-word' }}>
      {namesList(names)}
    </div>
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
    tableLayout: 'fixed',
  };
}

function thStyle(align: 'left' | 'right' = 'left'): React.CSSProperties {
  return {
    textAlign: align,
    padding: '6px 6px',
    color: T.muted,
    fontWeight: 600,
    fontSize: 10,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
    borderBottom: `1px solid ${T.border}`,
    background: T.tableHeader,
    whiteSpace: 'normal',
    lineHeight: 1.25,
    wordBreak: 'break-word',
  };
}

function tdStyle(align: 'left' | 'right' = 'left'): React.CSSProperties {
  return {
    textAlign: align,
    padding: '6px 6px',
    borderBottom: `1px solid ${T.borderSubtle}`,
    color: T.secondary,
    wordBreak: 'break-word',
  };
}

function tableWrapStyle(): React.CSSProperties {
  return {
    overflow: 'hidden',
    border: `1px solid ${T.border}`,
    borderRadius: 6,
    background: T.surface,
  };
}

const MetamodelTable: React.FC<{ metrics: MethodologistMetrics }> = ({ metrics }) => (
  <div style={{ ...tableWrapStyle() }}>
    <table style={tableStyle()}>
      <thead>
        <tr>
          <th style={{ ...thStyle(), width: '16%' }}>Metamodel</th>
          <th style={thStyle('right')}>Classes</th>
          <th style={thStyle('right')}>Abstract</th>
          <th style={thStyle('right')}>Concrete</th>
          <th style={thStyle('right')}>Attributes</th>
          <th style={thStyle('right')}>Refs (cont. / assoc.)</th>
          <th style={thStyle('right')}>Enums / literals</th>
          <th style={thStyle('right')}>Packages</th>
          <th style={thStyle('right')} title="EOperations on classes">Ops</th>
          <th style={thStyle('right')} title="Number of Children — direct subclasses">Children max / avg</th>
          <th style={thStyle('right')} title="Depth of Inheritance Tree — how many superclasses sit above a class (roots are 0)">Inheritance max / avg</th>
          <th style={thStyle('right')} title="Longest containment (composition) chain below a class">Cont. height</th>
          <th style={thStyle('right')} title="References whose target class lives in another package">Cross-pkg</th>
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
            <td style={tdStyle('right')}>{mm.operationsTotal}</td>
            <td style={tdStyle('right')}>{mm.nocMax} / {formatAvg(mm.nocAvg)}</td>
            <td style={tdStyle('right')}>{mm.inheritanceDepthMax} / {formatAvg(mm.inheritanceDepthAvg)}</td>
            <td style={tdStyle('right')}>{mm.containmentHeightMax}</td>
            <td style={tdStyle('right')}>{mm.crossPackageReferences}</td>
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
              <th style={thStyle('right')} title="EOperations">Ops</th>
              <th style={thStyle('right')} title="Number of Children — direct subclasses">Children</th>
              <th style={thStyle('right')} title="Depth of Inheritance Tree — how many superclasses sit above this class (roots are 0)">Depth</th>
              <th style={thStyle('right')} title="Longest containment chain below this class">Cont. height</th>
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
                <td style={tdStyle('right')}>{cls.operationCount}</td>
                <td style={tdStyle('right')}>{cls.childCount}</td>
                <td style={tdStyle('right')}>{cls.inheritanceDepth}</td>
                <td style={tdStyle('right')}>{cls.containmentHeight}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ))}
  </div>
);

const CoverageTable: React.FC<{ metrics: MethodologistMetrics }> = ({ metrics }) => (
  <div style={{ ...tableWrapStyle() }}>
    <table style={tableStyle()}>
      <thead>
        <tr>
          <th style={thStyle()}>Metamodel</th>
          <th style={thStyle()}>Status</th>
          <th style={thStyle('right')} title="Incoming reaction edges">Fan-in</th>
          <th style={thStyle('right')} title="Outgoing reaction edges">Fan-out</th>
          <th style={thStyle('right')}>Covered classes</th>
          <th style={thStyle()}>Uncovered concrete classes</th>
        </tr>
      </thead>
      <tbody>
        {metrics.metamodelLinks.map(link => (
          <tr key={link.id}>
            <td style={{ ...tdStyle(), fontWeight: 600, color: T.text }}>{link.name || 'Unnamed'}</td>
            <td style={tdStyle()}>{link.isOrphan ? 'Orphan' : 'Linked'}</td>
            <td style={tdStyle('right')}>{link.fanIn}</td>
            <td style={tdStyle('right')}>{link.fanOut}</td>
            <td style={tdStyle('right')}>
              {link.coveredConcreteClassCount} / {link.concreteClassCount}
            </td>
            <td style={tdStyle()}>
              {link.uncoveredClassNames.length === 0 ? '—' : link.uncoveredClassNames.join(', ')}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const DerivedTable: React.FC<{ metrics: MethodologistMetrics }> = ({ metrics }) => {
  const rows = derivedMetricRows(metrics);

  return (
    <div style={{ ...tableWrapStyle() }}>
      <table style={tableStyle()}>
        <thead>
          <tr>
            <th style={{ ...thStyle(), width: '22%' }}>Metric</th>
            <th style={{ ...thStyle('right'), width: '18%' }}>Value</th>
            <th style={thStyle()}>Formula</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.metric}>
              <td style={{ ...tdStyle(), fontWeight: 600, color: T.text }}>{row.metric}</td>
              <td style={{ ...tdStyle('right'), fontWeight: 700, color: T.brand }}>{row.value}</td>
              <td style={tdStyle()}>{row.formula}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const CorrespondenceTable: React.FC<{ metrics: MethodologistMetrics }> = ({ metrics }) => (
  <div style={{ ...tableWrapStyle() }}>
    <table style={tableStyle()}>
      <thead>
        <tr>
          <th style={thStyle()}>Correspondence type</th>
          <th style={thStyle()}>Direction</th>
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
            <td style={tdStyle()}>{ct.direction === 'both-ways' ? 'Both ways' : 'One-way'}</td>
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

const CategoryTabs: React.FC<{
  selected: MetricsCategory[];
  onToggle: (id: MetricsCategory) => void;
  onMarkAll: () => void;
  onDownload: (categories: MetricsCategory[]) => void;
}> = ({ selected, onToggle, onMarkAll, onDownload }) => (
  <div
    style={{
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
      padding: '8px 16px 10px',
      background: T.surface,
      borderBottom: `1px solid ${T.border}`,
      flexShrink: 0,
    }}
  >
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
      <div
        role="group"
        aria-label="Metrics categories"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}
      >
        {METRICS_CATEGORIES.map(id => {
          const marked = selected.includes(id);
          return (
            <button
              key={id}
              type="button"
              aria-pressed={marked}
              data-testid={`metrics-tab-${id}`}
              onClick={() => onToggle(id)}
              style={{
                border: `1px solid ${marked ? T.brand : T.border}`,
                background: marked ? T.brand : T.mutedBg,
                color: marked ? '#fff' : T.text,
                borderRadius: 999,
                padding: '5px 12px',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: APP_FONT,
              }}
            >
              {marked ? `✓ ${METRICS_CATEGORY_LABELS[id]}` : METRICS_CATEGORY_LABELS[id]}
            </button>
          );
        })}
      </div>
      <div data-testid="metrics-marked-label" style={{ fontSize: 11, color: T.muted, lineHeight: 1.35 }}>
        {formatSelectedLabel(selected).replace('Selected — ', 'Marked: ')}
      </div>
    </div>
    <MetricsDownloadMenu
      selected={selected}
      onToggle={onToggle}
      onMarkAll={onMarkAll}
      onDownload={onDownload}
    />
  </div>
);

function downloadButtonStyle(): React.CSSProperties {
  return {
    border: `1px solid ${T.brand}`,
    background: T.surface,
    color: T.brand,
    borderRadius: 6,
    padding: '5px 10px',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: APP_FONT,
    whiteSpace: 'nowrap',
  };
}

function downloadMenuItemStyle(disabled = false): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    textAlign: 'left',
    border: 'none',
    background: 'transparent',
    color: T.text,
    padding: '8px 10px',
    fontSize: 12,
    fontWeight: 600,
    fontFamily: APP_FONT,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    borderRadius: 6,
  };
}

const MetricsDownloadMenu: React.FC<{
  selected: MetricsCategory[];
  onToggle: (id: MetricsCategory) => void;
  onMarkAll: () => void;
  onDownload: (categories: MetricsCategory[]) => void;
}> = ({ selected, onToggle, onMarkAll, onDownload }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const marked = orderedMetricsCategories(selected);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as unknown as HTMLElement)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const download = (categories: MetricsCategory[]) => {
    onDownload(categories);
    setOpen(false);
  };

  return (
    <div ref={rootRef} style={{ position: 'relative', marginLeft: 'auto', flexShrink: 0 }}>
      <button
        type="button"
        data-testid="metrics-download"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
        style={downloadButtonStyle()}
      >
        Download
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Download metrics"
          data-testid="metrics-download-menu"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 6px)',
            zIndex: 20,
            minWidth: 240,
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
            padding: 6,
          }}
        >
          <button
            type="button"
            role="menuitem"
            data-testid="metrics-download-all"
            onClick={() => {
              onMarkAll();
              download([...METRICS_CATEGORIES]);
            }}
            style={downloadMenuItemStyle()}
          >
            All
          </button>
          <div
            data-testid="metrics-download-selected"
            style={{
              padding: '6px 10px 8px',
              fontSize: 11,
              fontWeight: 600,
              color: T.muted,
              lineHeight: 1.35,
            }}
          >
            {formatSelectedLabel(selected)}
          </div>
          <div style={{ height: 1, background: T.border, margin: '0 6px 4px' }} />
          {METRICS_CATEGORIES.map(id => {
            const isMarked = selected.includes(id);
            return (
              <button
                key={id}
                type="button"
                role="menuitemcheckbox"
                aria-checked={isMarked}
                data-testid={`metrics-mark-${id}`}
                onClick={() => onToggle(id)}
                style={{
                  ...downloadMenuItemStyle(),
                  color: isMarked ? T.brand : T.text,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{ width: 16, textAlign: 'center', fontSize: 13, flexShrink: 0 }}
                >
                  {isMarked ? '✓' : ''}
                </span>
                {METRICS_CATEGORY_LABELS[id]}
              </button>
            );
          })}
          <div style={{ height: 1, background: T.border, margin: '4px 6px' }} />
          <button
            type="button"
            role="menuitem"
            data-testid="metrics-download-marked"
            disabled={marked.length === 0}
            onClick={() => marked.length > 0 && download(marked)}
            style={{
              ...downloadMenuItemStyle(marked.length === 0),
              justifyContent: 'center',
              background: marked.length === 0 ? 'transparent' : T.brand,
              color: marked.length === 0 ? T.text : '#fff',
              border: marked.length === 0 ? 'none' : `1px solid ${T.brand}`,
            }}
          >
            Download
          </button>
        </div>
      )}
    </div>
  );
};

export const MethodologistMetricsView: React.FC<MethodologistMetricsViewProps> = ({
  vsumId,
  projectName,
  nodes,
  edges,
  viewTypes,
  enabled = true,
  onClose,
}) => {
  const [oclContent, setOclContent] = useState(() => (
    vsumId == null ? '' : readStoredOcl(String(vsumId))
  ));
  const [codeByEdgeId, setCodeByEdgeId] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<MetricsCategory[]>(['size']);

  useEffect(() => {
    if (!enabled || vsumId == null) return;
    const request = apiService.getRuleSets?.(vsumId);
    if (!request) return;
    let cancelled = false;
    Promise.resolve(request).then(sets => {
      if (cancelled) return;
      const fromApi = (sets ?? []).map(s => s.oclContent ?? '').filter(Boolean).join('\n\n');
      if (fromApi.trim()) {
        writeStoredOcl(String(vsumId), fromApi);
        setOclContent(fromApi);
        return;
      }
      setOclContent(readStoredOcl(String(vsumId)));
    }).catch(() => {
      if (!cancelled) setOclContent(readStoredOcl(String(vsumId)));
    });
    return () => { cancelled = true; };
  }, [enabled, vsumId]);

  useEffect(() => {
    if (!enabled) {
      setCodeByEdgeId({});
      return;
    }
    const missing = edges.filter(edge => (
      edge.type === 'reactions'
      && !(typeof edge.data?.code === 'string' && edge.data.code.trim())
      && typeof edge.data?.reactionFileId === 'number'
    ));
    if (missing.length === 0) {
      setCodeByEdgeId({});
      return;
    }
    let cancelled = false;
    Promise.all(missing.map(async edge => {
      try {
        const code = await apiService.getFile(edge.data.reactionFileId as number);
        return [edge.id, typeof code === 'string' ? code : ''] as const;
      } catch {
        return [edge.id, ''] as const;
      }
    })).then(entries => {
      if (!cancelled) setCodeByEdgeId(Object.fromEntries(entries));
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

  const toggleCategory = (id: MetricsCategory) => {
    setSelected(prev => (
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    ));
  };

  const markAllCategories = () => {
    setSelected([...METRICS_CATEGORIES]);
  };

  const downloadReport = (categories: MetricsCategory[]) => {
    downloadBlobAsFile(
      buildMetricsReportZip(metrics, categories, projectName),
      metricsResultFileName(projectName),
    );
  };

  return (
    <div
      data-testid="methodologist-metrics-view"
      style={{
        width: '100%',
        height: '100%',
        maxHeight: '100%',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: T.mutedBg,
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        fontFamily: APP_FONT,
        overflow: 'hidden',
        boxSizing: 'border-box',
        minWidth: 0,
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
            Size, reactions, coverage, hotspots, and derived ratios. Mark the ones you want to see together.
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

      <CategoryTabs
        selected={selected}
        onToggle={toggleCategory}
        onMarkAll={markAllCategories}
        onDownload={downloadReport}
      />

      <div
        className="themed-scroll"
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '12px 16px 18px' }}
      >
        {selected.length === 0 && (
          <div style={{ fontSize: 12, color: T.muted }}>
            Mark one or more categories above to show them together.
          </div>
        )}

        {selected.includes('size') && (
          <>
            <Section title="Methodology size" caption="The whole methodology on the canvas: metamodels, classes, attributes, associations, and view types — not only OCL.">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(112px, 1fr))', gap: 6 }}>
                <InsightCard label="Metamodels" value={metrics.metamodels.length} />
                <InsightCard label="Classes" value={metrics.classCount} sub={`${metrics.abstractClassCount} abs. · ${metrics.concreteClassCount} conc.`} />
                <InsightCard label="Attributes" value={metrics.attributesTotal} />
                <InsightCard
                  label="Associations"
                  value={metrics.nonContainmentReferences}
                  sub={`${metrics.containmentReferences} containment`}
                />
                <InsightCard
                  label="View types"
                  value={metrics.viewTypeCount}
                  sub={`${metrics.singleViewTypeCount} single · ${metrics.multiViewTypeCount} multi`}
                />
              </div>
            </Section>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(112px, 1fr))', gap: 6, marginBottom: 16 }}>
              <InsightCard label="Enums / literals" value={`${metrics.enumCount} / ${metrics.enumLiteralCount}`} />
              <InsightCard label="Packages" value={metrics.packageCount} sub="Incl. subpackages" />
              <InsightCard
                label="Model elements"
                value={metrics.instanceElementTotal}
                sub={metrics.instanceModels.length === 0 ? 'No instance models' : `Across ${metrics.instanceModels.length} models`}
              />
              <InsightCard label="Operations" value={metrics.operationsTotal} />
              <InsightCard
                label="Children max"
                value={metrics.nocMax}
                sub={`avg ${formatAvg(metrics.nocAvg)}`}
              />
              <InsightCard
                label="Cont. height"
                value={metrics.containmentHeightMax}
                sub={`${metrics.crossPackageReferences} cross-pkg refs`}
              />
            </div>

            <Section title="Metamodels" caption="Classes, features, enumerations, packages, operations, inheritance (DIT), children (NOC), and containment height per metamodel.">
              {metrics.metamodels.length === 0 ? (
                <div style={{ fontSize: 12, color: T.muted }}>Add metamodels on the Modeling canvas to populate this table.</div>
              ) : (
                <MetamodelTable metrics={metrics} />
              )}
            </Section>

            {metrics.metamodels.some(mm => mm.classes.length > 0) && (
              <Section title="Class detail" caption="Attributes, operations, children (NOC), inheritance depth, and containment height for each classifier.">
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
          </>
        )}

        {selected.includes('reactions') && (
          <Section title="Correspondences and reactions" caption="Each reactions file is one correspondence specification. Direction is both-ways when a reverse reaction edge exists. LOC is the size of the reaction code.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(112px, 1fr))', gap: 6, marginBottom: 8 }}>
              <InsightCard label="Reactions" value={metrics.reactionCount} sub={`${metrics.oneWayReactionPairCount} one-way · ${metrics.bidirectionalReactionPairCount} both`} />
              <InsightCard label="Corr. types" value={metrics.correspondenceTypeCount} />
              <InsightCard label="One-way links" value={metrics.oneWayReactionPairCount} />
              <InsightCard label="Both-ways links" value={metrics.bidirectionalReactionPairCount} />
              <InsightCard label="Reaction LOC" value={metrics.reactionTotalLoc} sub={`avg ${formatAvg(metrics.avgLocPerReaction)} / reaction`} />
            </div>
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
        )}

        {selected.includes('coverage') && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(112px, 1fr))', gap: 6, marginBottom: 16 }}>
              <InsightCard
                label="Coverage"
                value={`${metrics.correspondenceCoveragePercent}%`}
                sub={`${metrics.coveredConcreteClassCount} of ${metrics.concreteClassCount} concrete`}
              />
              <InsightCard
                label="Orphans"
                value={metrics.orphanMetamodelCount}
                sub={`${metrics.linkedMetamodelCount} linked`}
              />
              <InsightCard label="OCL constraints" value={metrics.oclConstraintCount} />
            </div>

            <Section title="Consistency coverage" caption="Orphans have no reaction edge. Fan-in / fan-out count those edges. A concrete class is covered when its name appears in a linked reactions file.">
              {metrics.metamodelLinks.length === 0 ? (
                <div style={{ fontSize: 12, color: T.muted }}>Add metamodels on the Modeling canvas to populate this table.</div>
              ) : (
                <CoverageTable metrics={metrics} />
              )}
            </Section>

            <Section title="OCL ↔ reaction gap" caption="Matched by class name in OCL context vs reaction code. Detect-only: we can flag a break but have no reaction to fix it. Repair-only: a reaction exists with no OCL rule.">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 6, marginBottom: 8 }}>
                <InsightList label="Detect only" hint="OCL, no reaction" names={metrics.detectOnlyClassNames} />
                <InsightList label="Repair only" hint="reaction, no OCL" names={metrics.repairOnlyClassNames} />
                <InsightList label="Detect and repair" names={metrics.detectAndRepairClassNames} />
              </div>
              {metrics.oclRulesWithoutReaction.length > 0 && (
                <div style={{ fontSize: 11, color: T.secondary, lineHeight: 1.4 }}>
                  Rules with no reaction: {metrics.oclRulesWithoutReaction.map(rule => `${rule.name} (${rule.contextClass || 'no context'})`).join(', ')}
                </div>
              )}
            </Section>

            <Section title="Unprotected coverage" caption="Concrete classes and associations with no OCL context and no reaction mention — the parts that are neither checked nor kept consistent.">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 6 }}>
                <InsightList label="Unprotected classes" names={metrics.unprotectedClassNames} />
                <InsightList label="Unprotected associations" names={metrics.unprotectedAssociationNames} />
              </div>
            </Section>
          </>
        )}

        {selected.includes('hotspots') && (
          <Section title="Hotspots" caption="Classes that appear in the most OCL rules and reaction files. High scores are the dangerous places to change.">
            {metrics.hotspotClasses.length === 0 ? (
              <div style={{ fontSize: 12, color: T.muted }}>No class names found in OCL or reactions yet.</div>
            ) : (
              <div style={{ ...tableWrapStyle() }}>
                <table style={tableStyle()}>
                  <thead>
                    <tr>
                      <th style={thStyle()}>Class</th>
                      <th style={thStyle()}>Metamodel</th>
                      <th style={thStyle('right')}>OCL rules</th>
                      <th style={thStyle('right')}>Reaction files</th>
                      <th style={thStyle('right')}>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.hotspotClasses.map(hotspot => (
                      <tr key={`${hotspot.metamodel}-${hotspot.className}`}>
                        <td style={{ ...tdStyle(), fontWeight: 600, color: T.text }}>{hotspot.className}</td>
                        <td style={tdStyle()}>{hotspot.metamodel}</td>
                        <td style={tdStyle('right')}>{hotspot.oclRuleCount}</td>
                        <td style={tdStyle('right')}>{hotspot.reactionFileCount}</td>
                        <td style={{ ...tdStyle('right'), fontWeight: 700, color: T.brand }}>{hotspot.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        )}

        {selected.includes('derived') && (
          <Section
            title="Derived / composite"
            caption="Ratios from the counts above. View coverage uses classes in metamodels linked to a view type (static, no deployed VSUM). View element density uses instance model elements when those are loaded."
          >
            <DerivedTable metrics={metrics} />
          </Section>
        )}
      </div>
    </div>
  );
};

