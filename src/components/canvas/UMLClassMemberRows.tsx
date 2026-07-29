import {
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  buildAttributeTypeOptions,
  buildOperationReturnTypeOptions,
  normalizeAttributeTypeDisplay,
  normalizeOperationReturnType,
  UML_VISIBILITY_OPTIONS,
  type UMLAttribute,
  type UMLOperation,
  type UMLVisibility,
} from '../../utils/ecoreToUml';
import {
  UML_CLASS_ADD_MEMBER_ROW_HEIGHT,
  UML_CLASS_MEMBER_EDIT_ROW_HEIGHT,
  UML_CLASS_MEMBER_ROW_HEIGHT,
} from './umlDiagramClassMetrics';
import { handleUmlInlineEditKeyDown } from './umlDiagramKeyboardUtils';
import { UML } from './umlDiagramTheme';
import type {
  UmlAttributeEditState,
  UmlDiagramEditState,
  UmlOperationEditState,
} from './umlDiagramTypes';

const umlMemberEditFieldStyle: CSSProperties = {
  fontSize: 11,
  border: `1px solid ${UML.primaryBorder}`,
  borderRadius: 4,
  padding: '1px 4px',
  background: UML.surface,
  color: UML.ink,
  fontFamily: UML.fontSans,
};

function getUmlEditFieldStyle(expanded: boolean): CSSProperties {
  if (!expanded) return umlMemberEditFieldStyle;
  return {
    ...umlMemberEditFieldStyle,
    fontSize: 13,
    padding: '4px 6px',
    borderRadius: 5,
    border: `2px solid ${UML.primaryBorder}`,
  };
}

function getUmlEditRowStyle(expanded: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: expanded ? 6 : 2,
    padding: expanded ? '6px 12px' : '1px 6px',
    minHeight: expanded
      ? UML_CLASS_MEMBER_EDIT_ROW_HEIGHT
      : UML_CLASS_MEMBER_ROW_HEIGHT,
    flexWrap: 'nowrap',
  };
}

function getEditSelectValue(options: string[], current: string, fallback: string): string {
  if (options.includes(current)) return current;
  return options[0] ?? fallback;
}

function getEditRowInputName(element: HTMLElement, fallback: string): string {
  const input = element.closest('div')?.querySelector('input') as HTMLInputElement | null;
  return input?.value ?? fallback;
}

function getUmlRowContainerStyle(hovered: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    padding: '0 6px',
    height: UML_CLASS_MEMBER_ROW_HEIGHT,
    background: hovered ? '#f8fafc' : 'transparent',
    gap: 3,
  };
}

function getUmlRowEditButtonStyle(): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    flex: 1,
    gap: 3,
    minWidth: 0,
    border: 'none',
    margin: 0,
    padding: 0,
    background: 'transparent',
    cursor: 'default',
    font: 'inherit',
    textAlign: 'left',
  };
}

function getUmlRowDeleteButtonStyle(hovered: boolean): CSSProperties {
  return {
    flexShrink: 0,
    width: 18,
    height: 18,
    border: 'none',
    borderRadius: 4,
    background: hovered ? '#fee2e2' : '#fef2f2',
    cursor: 'pointer',
    color: '#dc2626',
    fontSize: 11,
    padding: 0,
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  };
}

function shouldIgnoreUmlMemberRowKeyboardEvent(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement;
  return target !== event.currentTarget
    && Boolean(target.closest('input, button, select, textarea'));
}

function handleUmlMemberRowEditKeyDown(
  event: KeyboardEvent,
  onEdit: () => void,
): void {
  if (event.key !== 'Enter' && event.key !== 'F2') return;
  if (shouldIgnoreUmlMemberRowKeyboardEvent(event)) return;
  event.preventDefault();
  onEdit();
}

interface UmlMemberRowDisplayProps {
  ariaLabel: string;
  hovered: boolean;
  showDelete: boolean;
  deleteTitle: string;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onDoubleClick: () => void;
  onDelete: () => void;
  children: ReactNode;
}

const UmlMemberRowDisplay = ({
  ariaLabel,
  hovered,
  showDelete,
  deleteTitle,
  onMouseEnter,
  onMouseLeave,
  onDoubleClick,
  onDelete,
  children,
}: UmlMemberRowDisplayProps) => (
  <div style={getUmlRowContainerStyle(hovered)}>
    <button
      type="button"
      aria-label={ariaLabel}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onDoubleClick();
      }}
      onKeyDown={(event) => handleUmlMemberRowEditKeyDown(event, onDoubleClick)}
      style={getUmlRowEditButtonStyle()}
    >
      {children}
    </button>
    {showDelete && (
      <button
        type="button"
        data-no-drag
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
        title={deleteTitle}
        aria-label={deleteTitle}
        style={getUmlRowDeleteButtonStyle(hovered)}
      >
        ✕
      </button>
    )}
  </div>
);

function getUmlAttributeEditState(
  editing: UmlDiagramEditState | null,
  attrId: string,
): UmlAttributeEditState | null {
  if (editing?.kind !== 'attr' || editing.attrId !== attrId) return null;
  return editing;
}

interface UmlAttributeRowEditorProps {
  editing: UmlAttributeEditState;
  typeOptions: string[];
  expanded: boolean;
  onSave: (name: string, type: string, visibility: UMLVisibility) => void;
  onCancel: () => void;
  onEditChange: (name: string, type: string, visibility: UMLVisibility) => void;
}

const UmlAttributeRowEditor = ({
  editing,
  typeOptions,
  expanded,
  onSave,
  onCancel,
  onEditChange,
}: UmlAttributeRowEditorProps) => {
  const editFieldStyle = getUmlEditFieldStyle(expanded);
  const rowStyle = getUmlEditRowStyle(expanded);
  const selectValue = getEditSelectValue(typeOptions, editing.type, 'String');
  const visibilitySelectWidth = expanded ? 42 : 34;
  const nameInputMinWidth = expanded ? 72 : 40;
  const typeSelectWidth = expanded ? 96 : 76;

  const commitEdit = (name: string, type: string, visibility: UMLVisibility) => {
    onEditChange(name, type, visibility);
    onSave(name, type, visibility);
  };

  const handleVisibilityChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const visibility = event.target.value as UMLVisibility;
    const name = getEditRowInputName(event.currentTarget, editing.name);
    commitEdit(name, editing.type, visibility);
  };

  const handleTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const type = event.target.value;
    const name = getEditRowInputName(event.currentTarget, editing.name);
    commitEdit(name, type, editing.visibility);
  };

  return (
    <div style={rowStyle}>
      <select
        value={editing.visibility}
        onMouseDown={event => event.preventDefault()}
        onChange={handleVisibilityChange}
        style={{
          ...editFieldStyle,
          width: visibilitySelectWidth,
          flexShrink: 0,
          padding: '2px 2px',
        }}
        title="Visibility"
      >
        {UML_VISIBILITY_OPTIONS.map(visibility => (
          <option key={visibility} value={visibility}>{visibility}</option>
        ))}
      </select>
      <input
        autoFocus
        value={editing.name}
        onChange={event => onEditChange(
          event.target.value,
          editing.type,
          editing.visibility,
        )}
        onBlur={event => onSave(
          event.currentTarget.value,
          editing.type,
          editing.visibility,
        )}
        onKeyDown={event => handleUmlInlineEditKeyDown(
          event,
          () => onSave(editing.name, editing.type, editing.visibility),
          onCancel,
        )}
        style={{ ...editFieldStyle, flex: 1, minWidth: nameInputMinWidth }}
      />
      <span style={{ color: UML.textMuted, flexShrink: 0 }}>:</span>
      <select
        value={selectValue}
        onMouseDown={event => event.preventDefault()}
        onChange={handleTypeChange}
        onKeyDown={event => handleUmlInlineEditKeyDown(
          event,
          () => onSave(
            editing.name,
            event.currentTarget.value,
            editing.visibility,
          ),
          onCancel,
        )}
        title="Attribute type (primitive only)"
        style={{
          ...editFieldStyle,
          width: typeSelectWidth,
          color: UML.primary,
          fontWeight: 600,
        }}
      >
        {typeOptions.map(type => (
          <option key={type} value={type}>{type}</option>
        ))}
      </select>
    </div>
  );
};

export interface UmlAttributeRowProps {
  attr: UMLAttribute;
  expanded?: boolean;
  editing: UmlDiagramEditState | null;
  hovered: boolean;
  showDelete?: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onDoubleClick: () => void;
  onSave: (name: string, type: string, visibility: UMLVisibility) => void;
  onCancel: () => void;
  onDelete: () => void;
  onEditChange: (name: string, type: string, visibility: UMLVisibility) => void;
}

export const UmlAttributeRow = ({
  attr,
  expanded = false,
  editing,
  hovered,
  showDelete = false,
  onMouseEnter,
  onMouseLeave,
  onDoubleClick,
  onSave,
  onCancel,
  onDelete,
  onEditChange,
}: UmlAttributeRowProps) => {
  const attributeEditState = getUmlAttributeEditState(editing, attr.id);

  if (attributeEditState) {
    return (
      <UmlAttributeRowEditor
        editing={attributeEditState}
        typeOptions={buildAttributeTypeOptions(attributeEditState.type)}
        expanded={expanded}
        onSave={onSave}
        onCancel={onCancel}
        onEditChange={onEditChange}
      />
    );
  }

  return (
    <UmlMemberRowDisplay
      ariaLabel={`Attribute ${attr.name}: ${normalizeAttributeTypeDisplay(attr.type)}. Press Enter to edit.`}
      hovered={hovered}
      showDelete={!!showDelete}
      deleteTitle="Delete attribute"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onDoubleClick={onDoubleClick}
      onDelete={onDelete}
    >
      <span style={{ color: '#64748b', flexShrink: 0 }}>{attr.visibility ?? '+'}</span>
      <span style={{
        color: '#1e293b',
        flex: 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {attr.name}
      </span>
      <span style={{ color: '#94a3b8', flexShrink: 0 }}>:</span>
      <span style={{ color: UML.primary, flexShrink: 0, fontWeight: 600 }}>
        {normalizeAttributeTypeDisplay(attr.type)}
      </span>
    </UmlMemberRowDisplay>
  );
};

function getUmlAddMemberRowStyle(hovered: boolean): CSSProperties {
  return {
    height: UML_CLASS_ADD_MEMBER_ROW_HEIGHT,
    display: 'flex',
    alignItems: 'center',
    padding: '0 8px',
    gap: 4,
    cursor: 'pointer',
    color: hovered ? UML.primary : UML.textMuted,
    transition: 'color 0.1s',
    fontFamily: UML.fontSans,
    border: 'none',
    margin: 0,
    width: '100%',
    background: 'transparent',
    font: 'inherit',
    textAlign: 'left',
  };
}

interface UmlAddMemberRowProps {
  label: string;
  onClick: () => void;
}

const UmlAddMemberRow = ({ label, onClick }: UmlAddMemberRowProps) => {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      data-no-drag
      aria-label={label}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={getUmlAddMemberRowStyle(hovered)}
    >
      <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
      <span style={{ fontSize: 10 }}>{label}</span>
    </button>
  );
};

export const UmlAddAttributeRow = ({ onClick }: Readonly<{ onClick: () => void }>) => (
  <UmlAddMemberRow label="Add attribute" onClick={onClick} />
);

function getUmlOperationEditState(
  editing: UmlDiagramEditState | null,
  opId: string,
): UmlOperationEditState | null {
  if (editing?.kind !== 'op' || editing.opId !== opId) return null;
  return editing;
}

interface UmlOperationRowEditorProps {
  editing: UmlOperationEditState;
  returnOptions: string[];
  expanded: boolean;
  onSave: (name: string, returnType: string, visibility: UMLVisibility) => void;
  onCancel: () => void;
  onEditChange: (name: string, returnType: string, visibility: UMLVisibility) => void;
}

const UmlOperationRowEditor = ({
  editing,
  returnOptions,
  expanded,
  onSave,
  onCancel,
  onEditChange,
}: UmlOperationRowEditorProps) => {
  const editFieldStyle = getUmlEditFieldStyle(expanded);
  const rowStyle = getUmlEditRowStyle(expanded);
  const selectValue = getEditSelectValue(returnOptions, editing.returnType, 'Void');
  const visibilitySelectWidth = expanded ? 42 : 34;
  const nameInputMinWidth = expanded ? 72 : 40;
  const returnTypeSelectWidth = expanded ? 86 : 68;

  const commitEdit = (
    name: string,
    returnType: string,
    visibility: UMLVisibility,
  ) => {
    onEditChange(name, returnType, visibility);
    onSave(name, returnType, visibility);
  };

  const handleVisibilityChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const visibility = event.target.value as UMLVisibility;
    const name = getEditRowInputName(event.currentTarget, editing.name);
    commitEdit(name, editing.returnType, visibility);
  };

  const handleReturnTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const returnType = event.target.value;
    const name = getEditRowInputName(event.currentTarget, editing.name);
    commitEdit(name, returnType, editing.visibility);
  };

  return (
    <div style={rowStyle}>
      <select
        value={editing.visibility}
        onMouseDown={event => event.preventDefault()}
        onChange={handleVisibilityChange}
        style={{ ...editFieldStyle, width: visibilitySelectWidth, flexShrink: 0 }}
      >
        {UML_VISIBILITY_OPTIONS.map(visibility => (
          <option key={visibility} value={visibility}>{visibility}</option>
        ))}
      </select>
      <input
        autoFocus
        value={editing.name}
        onChange={event => onEditChange(
          event.target.value,
          editing.returnType,
          editing.visibility,
        )}
        onBlur={event => onSave(
          event.currentTarget.value,
          editing.returnType,
          editing.visibility,
        )}
        onKeyDown={event => handleUmlInlineEditKeyDown(
          event,
          () => onSave(
            editing.name,
            editing.returnType,
            editing.visibility,
          ),
          onCancel,
        )}
        style={{ ...editFieldStyle, flex: 1, minWidth: nameInputMinWidth }}
      />
      <span style={{ color: UML.textMuted, flexShrink: 0 }}>() :</span>
      <select
        value={selectValue}
        onMouseDown={event => event.preventDefault()}
        onChange={handleReturnTypeChange}
        onKeyDown={event => handleUmlInlineEditKeyDown(
          event,
          () => onSave(
            editing.name,
            event.currentTarget.value,
            editing.visibility,
          ),
          onCancel,
        )}
        style={{
          ...editFieldStyle,
          width: returnTypeSelectWidth,
          color: UML.primary,
          fontWeight: 600,
        }}
      >
        {returnOptions.map(returnType => (
          <option key={returnType} value={returnType}>{returnType}</option>
        ))}
      </select>
    </div>
  );
};

export interface UmlOperationRowProps {
  op: UMLOperation;
  expanded?: boolean;
  editing: UmlDiagramEditState | null;
  hovered: boolean;
  showDelete?: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onDoubleClick: () => void;
  onSave: (name: string, returnType: string, visibility: UMLVisibility) => void;
  onCancel: () => void;
  onDelete: () => void;
  onEditChange: (name: string, returnType: string, visibility: UMLVisibility) => void;
}

export const UmlOperationRow = ({
  op,
  expanded = false,
  editing,
  hovered,
  showDelete = false,
  onMouseEnter,
  onMouseLeave,
  onDoubleClick,
  onSave,
  onCancel,
  onDelete,
  onEditChange,
}: UmlOperationRowProps) => {
  const operationEditState = getUmlOperationEditState(editing, op.id);

  if (operationEditState) {
    return (
      <UmlOperationRowEditor
        editing={operationEditState}
        returnOptions={buildOperationReturnTypeOptions(operationEditState.returnType)}
        expanded={expanded}
        onSave={onSave}
        onCancel={onCancel}
        onEditChange={onEditChange}
      />
    );
  }

  return (
    <UmlMemberRowDisplay
      ariaLabel={`Operation ${op.name}: ${normalizeOperationReturnType(op.returnType)}. Press Enter to edit.`}
      hovered={hovered}
      showDelete={!!showDelete}
      deleteTitle="Delete operation"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onDoubleClick={onDoubleClick}
      onDelete={onDelete}
    >
      <span style={{ color: '#64748b', flexShrink: 0 }}>{op.visibility ?? '+'}</span>
      <span style={{
        color: '#1e293b',
        flex: 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {op.name}()
      </span>
      <span style={{ color: '#94a3b8', flexShrink: 0 }}>:</span>
      <span style={{ color: UML.primary, flexShrink: 0, fontWeight: 600 }}>
        {normalizeOperationReturnType(op.returnType)}
      </span>
    </UmlMemberRowDisplay>
  );
};

export const UmlAddOperationRow = ({ onClick }: Readonly<{ onClick: () => void }>) => (
  <UmlAddMemberRow label="Add operation" onClick={onClick} />
);
