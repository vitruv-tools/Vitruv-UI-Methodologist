import React from 'react';
import { themeVars } from '../../theme/theme';
import type { TypeObjectPattern } from '../../utils/semanticOverlap/types';

const simpleName = (qualifiedName: string | null) => (qualifiedName ? qualifiedName.slice(qualifiedName.lastIndexOf('.') + 1) : '–');

const Row: React.FC<{ role: string; value: string }> = ({ role, value }) => (
  <>
    <dt style={{ fontSize: 12, color: themeVars.textMuted }}>{role}</dt>
    <dd style={{ margin: 0, fontSize: 13, color: themeVars.text }}>{value}</dd>
  </>
);

const byCategory = (classes: Partial<Record<string, string>>) =>
  Object.entries(classes).map(([category, name]) => `${category}: ${simpleName(name ?? null)}`).join(', ') || '–';

/**
 * The type-object patterns behind class ↔ instance correspondences: which classes play the item,
 * type, definition and value role, and which classes of the other metamodel correspond to them.
 */
export const TypeObjectPatternPanel: React.FC<{ patterns: readonly TypeObjectPattern[] }> = ({ patterns }) => {
  if (patterns.length === 0) return null;
  return (
    <section aria-label="Type-object pattern" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {patterns.map(pattern => (
        <div
          key={`${pattern.side}:${pattern.item}`}
          style={{ border: `1px dashed ${themeVars.border}`, borderRadius: 10, background: themeVars.surface, padding: '10px 14px' }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: themeVars.text, marginBottom: 6 }}>
            Type-object pattern in the {pattern.side} metamodel ({Math.round(pattern.confidence * 100)} % confidence)
          </div>
          <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 12, rowGap: 2, margin: 0 }}>
            <Row role="Item" value={simpleName(pattern.item)} />
            <Row role="Type" value={simpleName(pattern.type)} />
            <Row role="Definition" value={simpleName(pattern.definition)} />
            <Row role="Value" value={simpleName(pattern.value)} />
            <Row role="Container" value={simpleName(pattern.container)} />
            <Row role="Definitions by data type" value={byCategory(pattern.definitionsByCategory)} />
            <Row role="Values by data type" value={byCategory(pattern.valuesByCategory)} />
            {pattern.counterpart && (
              <>
                <Row role="Counterpart base" value={simpleName(pattern.counterpart.base)} />
                <Row role="Counterpart subclasses" value={pattern.counterpart.subclasses.map(simpleName).join(', ')} />
                <Row role="Counterpart container" value={simpleName(pattern.counterpart.container)} />
              </>
            )}
          </dl>
        </div>
      ))}
    </section>
  );
};
