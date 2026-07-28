import {
  useEffect,
  useRef,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import type {
  UMLRelationship,
  UMLRelType,
} from '../../utils/ecoreToUml';
import {
  normalizeMultiplicityDisplay,
  relationshipMultiplicitySelectOptions,
  UML_RELATIONSHIP_MULTIPLICITY_LABELS,
} from '../../utils/umlMultiplicity';
import { DIAGRAM_HINT_TOP, UML } from './umlDiagramTheme';
import {
  UML_RELATIONSHIP_TYPE_LABELS,
  type UmlDiagramClass,
} from './umlDiagramTypes';

const panelInputStyle: CSSProperties = {
  width: '100%',
  fontSize: 12,
  border: `1px solid ${UML.border}`,
  borderRadius: 8,
  padding: '6px 9px',
  boxSizing: 'border-box',
  fontFamily: UML.fontSans,
  color: UML.ink,
};

const panelLabelStyle: CSSProperties = {
  display: 'block',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: UML.textMuted,
  marginBottom: 5,
};

function PanelCheckboxField({
  id,
  label,
  checked,
  onChange,
  style,
}: Readonly<{
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  style?: CSSProperties;
}>) {
  return (
    <label htmlFor={id} style={style}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={event => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function stopDiagramEventBubble(event: { stopPropagation(): void }): void {
  event.stopPropagation();
}

function handleDiagramEditPanelKeyDown(
  event: ReactKeyboardEvent<HTMLDialogElement>,
  onClose: () => void,
): void {
  event.stopPropagation();
  if (event.key === 'Escape') onClose();
}

interface DiagramEditPanelShellProps {
  panelDataAttr: 'class' | 'rel';
  ariaLabel: string;
  onClose: () => void;
  style: CSSProperties;
  children: ReactNode;
}

const DiagramEditPanelShell = ({
  panelDataAttr,
  ariaLabel,
  onClose,
  style,
  children,
}: DiagramEditPanelShellProps) => {
  const panelRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const panelDataAttribute =
    panelDataAttr === 'class'
      ? { 'data-class-edit-panel': true as const }
      : { 'data-rel-edit-panel': true as const };

  return (
    <dialog
      ref={panelRef}
      {...panelDataAttribute}
      open
      aria-label={ariaLabel}
      style={{ ...style, margin: 0, padding: 0 }}
      onClick={stopDiagramEventBubble}
      onMouseDown={stopDiagramEventBubble}
      onKeyDown={event => handleDiagramEditPanelKeyDown(event, onClose)}
      onKeyUp={stopDiagramEventBubble}
    >
      {children}
    </dialog>
  );
};

export interface ClassEditPanelProps {
  cls: UmlDiagramClass;
  classes: UmlDiagramClass[];
  parentId: string | null;
  onUpdate: (
    patch: Partial<Pick<UmlDiagramClass, 'name' | 'isAbstract' | 'isInterface'>>,
  ) => void;
  onSetParent: (parentId: string | null) => void;
  onDelete: () => void;
  onClose: () => void;
}

export const ClassEditPanel = ({
  cls,
  classes,
  parentId,
  onUpdate,
  onSetParent,
  onDelete,
  onClose,
}: ClassEditPanelProps) => (
  <DiagramEditPanelShell
    panelDataAttr="class"
    ariaLabel={`Edit class ${cls.name}`}
    onClose={onClose}
    style={{
      position: 'absolute', top: DIAGRAM_HINT_TOP, left: 12, bottom: 12, zIndex: 35,
      width: 268, background: UML.surface, border: `1px solid ${UML.primaryBorder}`,
      borderRadius: 10, boxShadow: `0 8px 24px ${UML.primaryRing}`,
      display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: UML.fontSans,
    }}
  >
    <div style={{
      padding: '10px 14px', borderBottom: `1px solid ${UML.border}`,
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8,
      background: `linear-gradient(180deg, ${UML.primarySoft} 0%, ${UML.surface} 100%)`,
    }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: UML.primary, textTransform: 'uppercase' }}>Class</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: UML.ink, marginTop: 3 }}>Edit class</div>
      </div>
      <button type="button" onClick={onClose} title="Close panel" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: UML.textMuted, fontSize: 14 }}>✕</button>
    </div>
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
      <label htmlFor={`class-edit-name-${cls.id}`} style={panelLabelStyle}>Class name</label>
      <input
        id={`class-edit-name-${cls.id}`}
        value={cls.name}
        onChange={event => onUpdate({ name: event.target.value })}
        style={{ ...panelInputStyle, marginBottom: 14 }}
      />
      <PanelCheckboxField
        id={`class-edit-abstract-${cls.id}`}
        label="Abstract class"
        checked={cls.isAbstract}
        onChange={checked => onUpdate({ isAbstract: checked })}
        style={{ ...panelLabelStyle, display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', fontSize: 12 }}
      />
      <PanelCheckboxField
        id={`class-edit-interface-${cls.id}`}
        label="Interface"
        checked={cls.isInterface}
        onChange={checked => onUpdate({ isInterface: checked })}
        style={{ ...panelLabelStyle, display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', fontSize: 12, marginBottom: 14 }}
      />
      <label htmlFor={`class-edit-parent-${cls.id}`} style={panelLabelStyle}>Superclass (inheritance)</label>
      <select
        id={`class-edit-parent-${cls.id}`}
        value={parentId ?? ''}
        onChange={event => onSetParent(event.target.value || null)}
        style={{ ...panelInputStyle, marginBottom: 14 }}
      >
        <option value="">(none)</option>
        {classes.filter(classItem => classItem.id !== cls.id).map(classItem => (
          <option key={classItem.id} value={classItem.id}>{classItem.name}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={onDelete}
        style={{
          width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #fecaca',
          background: '#fef2f2', color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}
      >
        Delete class
      </button>
    </div>
    <div style={{ padding: '8px 14px', borderTop: `1px solid ${UML.border}`, fontSize: 10, color: UML.textMuted, lineHeight: 1.45 }}>
      Edit attributes and operations on the class box · Close with ✕
    </div>
  </DiagramEditPanelShell>
);

function getRelationshipEditPanelAriaLabel(rel: UMLRelationship): string {
  const base = `Edit ${rel.type} connection`;
  return rel.label ? `${base}: ${rel.label}` : base;
}

export interface RelationshipEditPanelProps {
  rel: UMLRelationship;
  classes: UmlDiagramClass[];
  onUpdate: (patch: Partial<UMLRelationship>) => void;
  onSwapEndpoints: () => void;
  onClose: () => void;
}

export const RelationshipEditPanel = ({
  rel,
  classes,
  onUpdate,
  onSwapEndpoints,
  onClose,
}: RelationshipEditPanelProps) => (
  <DiagramEditPanelShell
    panelDataAttr="rel"
    ariaLabel={getRelationshipEditPanelAriaLabel(rel)}
    onClose={onClose}
    style={{
      position: 'absolute',
      top: DIAGRAM_HINT_TOP,
      right: 12,
      bottom: 12,
      zIndex: 35,
      width: 268,
      background: UML.surface,
      border: `1px solid ${UML.primaryBorder}`,
      borderRadius: 10,
      boxShadow: `0 8px 24px ${UML.primaryRing}, 0 0 0 1px rgba(4,148,132,0.05)`,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: UML.fontSans,
    }}
  >
    <div style={{
      padding: '10px 14px',
      borderBottom: `1px solid ${UML.border}`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 8,
      background: `linear-gradient(180deg, ${UML.primarySoft} 0%, ${UML.surface} 100%)`,
    }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: UML.primary, textTransform: 'uppercase' }}>
          Connection
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: UML.ink, marginTop: 3 }}>
          Edit relationship
        </div>
      </div>
      <button type="button" onClick={onClose} title="Close panel" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: UML.textMuted, padding: 2, fontSize: 14, lineHeight: 1 }}>✕</button>
    </div>

    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
      <label htmlFor={`rel-edit-source-${rel.id}`} style={panelLabelStyle}>From class</label>
      <select
        id={`rel-edit-source-${rel.id}`}
        value={rel.sourceId}
        onChange={event => {
          const next = event.target.value;
          if (next !== rel.targetId) onUpdate({ sourceId: next });
        }}
        style={{ ...panelInputStyle, marginBottom: 8 }}
      >
        {classes.map(classItem => (
          <option
            key={classItem.id}
            value={classItem.id}
            disabled={classItem.id === rel.targetId}
          >
            {classItem.name}
          </option>
        ))}
      </select>

      <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 10px' }}>
        <button
          type="button"
          onClick={onSwapEndpoints}
          title="Swap direction"
          style={{
            border: `1px solid ${UML.primaryBorder}`,
            borderRadius: 8,
            background: UML.primarySoft,
            color: UML.primary,
            fontSize: 11,
            fontWeight: 600,
            padding: '5px 12px',
            cursor: 'pointer',
          }}
        >
          ⇄ Swap direction
        </button>
      </div>

      <label htmlFor={`rel-edit-target-${rel.id}`} style={panelLabelStyle}>To class</label>
      <select
        id={`rel-edit-target-${rel.id}`}
        value={rel.targetId}
        onChange={event => {
          const next = event.target.value;
          if (next !== rel.sourceId) onUpdate({ targetId: next });
        }}
        style={{ ...panelInputStyle, marginBottom: 14 }}
      >
        {classes.map(classItem => (
          <option
            key={classItem.id}
            value={classItem.id}
            disabled={classItem.id === rel.sourceId}
          >
            {classItem.name}
          </option>
        ))}
      </select>

      <label htmlFor={`rel-edit-label-${rel.id}`} style={panelLabelStyle}>Connection name</label>
      <input
        id={`rel-edit-label-${rel.id}`}
        value={rel.label ?? ''}
        onChange={event => onUpdate({ label: event.target.value })}
        placeholder="e.g. manages, contains"
        style={{ ...panelInputStyle, marginBottom: 14 }}
      />

      <label htmlFor={`rel-edit-type-${rel.id}`} style={panelLabelStyle}>Type</label>
      <select
        id={`rel-edit-type-${rel.id}`}
        value={rel.type}
        onChange={event => onUpdate({ type: event.target.value as UMLRelType })}
        style={{ ...panelInputStyle, marginBottom: 14 }}
      >
        {(Object.keys(UML_RELATIONSHIP_TYPE_LABELS) as UMLRelType[]).map(type => (
          <option key={type} value={type}>{UML_RELATIONSHIP_TYPE_LABELS[type]}</option>
        ))}
      </select>

      {rel.type !== 'inheritance' && (
        <>
          <label htmlFor={`rel-edit-source-mult-${rel.id}`} style={panelLabelStyle}>Source multiplicity</label>
          <select
            id={`rel-edit-source-mult-${rel.id}`}
            value={normalizeMultiplicityDisplay(rel.sourceMultiplicity)}
            onChange={event => onUpdate({
              sourceMultiplicity: event.target.value || undefined,
            })}
            style={{ ...panelInputStyle, marginBottom: 14 }}
          >
            {relationshipMultiplicitySelectOptions(rel.sourceMultiplicity).map(multiplicity => (
              <option key={`src-${multiplicity || 'none'}`} value={multiplicity}>
                {UML_RELATIONSHIP_MULTIPLICITY_LABELS[multiplicity] ?? multiplicity}
              </option>
            ))}
          </select>
          <label htmlFor={`rel-edit-target-mult-${rel.id}`} style={panelLabelStyle}>Target multiplicity</label>
          <select
            id={`rel-edit-target-mult-${rel.id}`}
            value={normalizeMultiplicityDisplay(rel.targetMultiplicity)}
            onChange={event => onUpdate({
              targetMultiplicity: event.target.value || undefined,
            })}
            style={panelInputStyle}
          >
            {relationshipMultiplicitySelectOptions(rel.targetMultiplicity).map(multiplicity => (
              <option key={`tgt-${multiplicity || 'none'}`} value={multiplicity}>
                {UML_RELATIONSHIP_MULTIPLICITY_LABELS[multiplicity] ?? multiplicity}
              </option>
            ))}
          </select>
        </>
      )}
    </div>

    <div style={{ padding: '8px 14px', borderTop: `1px solid ${UML.border}`, fontSize: 10, color: UML.textMuted, lineHeight: 1.45 }}>
      Change type in this panel · Delete key removes selection · Close with ✕
    </div>
  </DiagramEditPanelShell>
);
