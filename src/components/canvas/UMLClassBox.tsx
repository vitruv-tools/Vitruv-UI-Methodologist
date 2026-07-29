import React, {
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import type { UMLVisibility } from '../../utils/ecoreToUml';
import {
  UmlAddAttributeRow,
  UmlAddOperationRow,
  UmlAttributeRow,
  UmlOperationRow,
} from './UMLClassMemberRows';
import {
  UML_CLASS_BOX_EDIT_WIDTH,
  UML_CLASS_BOX_WIDTH,
  UML_CLASS_EMPTY_OPERATION_SECTION_HEIGHT,
  UML_CLASS_NAME_EDIT_HEIGHT,
  UML_CLASS_NAME_SECTION_HEIGHT,
  UML_CLASS_STEREOTYPE_SECTION_HEIGHT,
} from './umlDiagramClassMetrics';
import { handleUmlInlineEditKeyDown } from './umlDiagramKeyboardUtils';
import { UML } from './umlDiagramTheme';
import type {
  UmlDiagramClass,
  UmlDiagramEditState,
} from './umlDiagramTypes';

type ClassBoxDragPointRef = RefObject<{
  sx: number;
  sy: number;
  ox: number;
  oy: number;
} | null>;
type ClassBoxDidDragRef = RefObject<boolean>;
type ReactionPortSide = 'left' | 'right';

function isClassBoxEditing(
  edit: UmlDiagramEditState | null,
  classId: string,
): boolean {
  return edit?.classId === classId
    && (edit.kind === 'name' || edit.kind === 'attr' || edit.kind === 'op');
}

function isClassEditingName(
  edit: UmlDiagramEditState | null,
  classId: string,
): boolean {
  return edit?.classId === classId && edit.kind === 'name';
}

function getClassBoxNameSectionHeight(
  cls: UmlDiagramClass,
  isEditingName: boolean,
): number {
  const isAbstractOrIface = cls.isAbstract || cls.isInterface;
  if (!isEditingName) {
    if (isAbstractOrIface) return UML_CLASS_STEREOTYPE_SECTION_HEIGHT;
    return UML_CLASS_NAME_SECTION_HEIGHT;
  }
  if (isAbstractOrIface) {
    return Math.max(
      UML_CLASS_STEREOTYPE_SECTION_HEIGHT,
      UML_CLASS_NAME_EDIT_HEIGHT + 8,
    );
  }
  return UML_CLASS_NAME_EDIT_HEIGHT;
}

function getClassBoxBorder(selected: boolean, connectSource: boolean): string {
  if (connectSource || selected) return `2.5px solid ${UML.primary}`;
  return `1.5px solid ${UML.border}`;
}

function isClassBoxHighlighted(
  selected: boolean,
  connectSource: boolean,
): boolean {
  return selected || connectSource;
}

function getClassBoxBoxShadow(
  isEditingBox: boolean,
  highlighted: boolean,
): string {
  if (isEditingBox) {
    return `0 0 0 4px ${UML.primaryRing}, 0 12px 28px rgba(4,148,132,0.18)`;
  }
  if (highlighted) {
    return `0 0 0 3px ${UML.primaryRing}, 0 4px 14px rgba(15,23,42,0.08)`;
  }
  return '0 2px 8px rgba(15,23,42,0.06)';
}

function getClassBoxZIndex(
  isEditingBox: boolean,
  selected: boolean,
): number {
  if (isEditingBox) return 25;
  if (selected) return 15;
  return 1;
}

function getClassBoxSectionPadding(isEditingBox: boolean): string {
  return isEditingBox ? '6px 0 4px' : '3px 0 2px';
}

function getClassBoxOuterStyle(params: {
  boxBorder: string;
  boxShadow: string;
  boxZIndex: number;
}): React.CSSProperties {
  return {
    width: '100%',
    border: params.boxBorder,
    borderRadius: 8,
    background: UML.surface,
    boxShadow: params.boxShadow,
    userSelect: 'none',
    fontFamily: UML.fontMono,
    fontSize: 12,
    cursor: 'grab',
    zIndex: params.boxZIndex,
    transition: 'width 0.22s ease, box-shadow 0.22s ease',
  };
}

function getClassBoxWrapperStyle(params: {
  cls: UmlDiagramClass;
  offsetX: number;
  offsetY: number;
  displayW: number;
}): React.CSSProperties {
  return {
    position: 'absolute',
    left: params.cls.x + params.offsetX,
    top: params.cls.y + params.offsetY,
    width: params.displayW,
  };
}

function getClassBoxAriaLabel(
  cls: UmlDiagramClass,
  selected: boolean,
  connectSource: boolean,
): string {
  let kind = 'class';
  if (cls.isInterface) kind = 'interface';
  else if (cls.isAbstract) kind = 'abstract class';

  let state = '';
  if (connectSource) state = ', connection source';
  else if (selected) state = ', selected';

  return `UML ${kind} ${cls.name}${state}`;
}

function shouldIgnoreClassBoxKeyboardEvent(
  event: React.KeyboardEvent,
): boolean {
  const target = event.target as HTMLElement;
  return target !== event.currentTarget
    && Boolean(target.closest('input, button, select, textarea'));
}

function handleClassBoxKeyDown(
  event: React.KeyboardEvent,
  interactive: boolean,
  onSelect: () => void,
): void {
  if (!interactive) return;
  if (event.key !== 'Enter' && event.key !== ' ') return;
  if (shouldIgnoreClassBoxKeyboardEvent(event)) return;
  event.preventDefault();
  onSelect();
}

function handleClassBoxSelectClick(
  event: React.MouseEvent,
  didDragRef: ClassBoxDidDragRef,
  onSelect: () => void,
): void {
  event.stopPropagation();
  if (didDragRef.current) {
    didDragRef.current = false;
    return;
  }
  onSelect();
}

function getClassBoxInteractionProps(params: {
  interactive: boolean;
  selected: boolean;
  boxAriaLabel: string;
  didDragRef: ClassBoxDidDragRef;
  onBoxMouseDown: (event: React.MouseEvent) => void;
  onSelect: () => void;
}): Pick<
  React.HTMLAttributes<HTMLDivElement>,
  | 'role'
  | 'aria-label'
  | 'aria-selected'
  | 'tabIndex'
  | 'onMouseDown'
  | 'onClick'
  | 'onKeyDown'
> {
  return {
    role: 'group',
    'aria-label': params.boxAriaLabel,
    'aria-selected': params.selected,
    tabIndex: params.interactive ? 0 : -1,
    onMouseDown: params.onBoxMouseDown,
    onClick: event => handleClassBoxSelectClick(
      event,
      params.didDragRef,
      params.onSelect,
    ),
    onKeyDown: event => handleClassBoxKeyDown(
      event,
      params.interactive,
      params.onSelect,
    ),
  };
}

function getClassBoxNameSectionBackground(
  isEditingName: boolean,
  selected: boolean,
): string {
  if (isEditingName || selected) return UML.primarySoft;
  return UML.surfaceMuted;
}

function getClassBoxNameSectionPadding(isEditingName: boolean): string {
  if (isEditingName) return '8px 12px';
  return '4px 8px';
}

function getClassBoxNameSectionStyle(
  nameSectionH: number,
  nameSectionBackground: string,
  nameSectionPadding: string,
): React.CSSProperties {
  return {
    height: nameSectionH,
    background: nameSectionBackground,
    borderBottom: `1.5px solid ${UML.border}`,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: nameSectionPadding,
    gap: 1,
    transition: 'height 0.22s ease, padding 0.22s ease',
  };
}

function getClassBoxNameSectionAriaLabel(
  cls: UmlDiagramClass,
  selected: boolean,
): string {
  if (selected) return `Class name: ${cls.name}. Press Enter to edit.`;
  return `Class name: ${cls.name}. Press Enter to select.`;
}

function handleClassBoxNameSectionKeyDown(
  event: React.KeyboardEvent,
  interactive: boolean,
  selected: boolean,
  edit: UmlDiagramEditState | null,
  classId: string,
  onSelect: () => void,
  onStartEditName: () => void,
): void {
  if (!interactive) return;
  if (event.key !== 'Enter' && event.key !== ' ') return;
  if (shouldIgnoreClassBoxKeyboardEvent(event)) return;
  event.preventDefault();
  event.stopPropagation();
  if (!selected) {
    onSelect();
    return;
  }
  if (edit?.classId !== classId) {
    onStartEditName();
  }
}

function handleClassBoxNameSectionClick(
  event: React.MouseEvent,
  interactive: boolean,
  selected: boolean,
  edit: UmlDiagramEditState | null,
  classId: string,
  didDragRef: ClassBoxDidDragRef,
  onSelect: () => void,
  onStartEditName: () => void,
): void {
  event.stopPropagation();
  if (didDragRef.current) {
    didDragRef.current = false;
    return;
  }
  if (!interactive) return;
  if (!selected) {
    onSelect();
    return;
  }
  if (edit?.classId !== classId) {
    onStartEditName();
  }
}

function getClassBoxNameSectionInteractionProps(params: {
  interactive: boolean;
  selected: boolean;
  edit: UmlDiagramEditState | null;
  classId: string;
  didDragRef: ClassBoxDidDragRef;
  onSelect: () => void;
  onStartEditName: () => void;
}): Pick<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onDoubleClick' | 'onClick' | 'onKeyDown'
> {
  return {
    onDoubleClick: event => {
      event.stopPropagation();
      params.onStartEditName();
    },
    onClick: event => handleClassBoxNameSectionClick(
      event,
      params.interactive,
      params.selected,
      params.edit,
      params.classId,
      params.didDragRef,
      params.onSelect,
      params.onStartEditName,
    ),
    onKeyDown: event => handleClassBoxNameSectionKeyDown(
      event,
      params.interactive,
      params.selected,
      params.edit,
      params.classId,
      params.onSelect,
      params.onStartEditName,
    ),
  };
}

type ClassBoxDragCleanup = () => void;

function startClassBoxDrag({
  event,
  cls,
  scale,
  dragRef,
  didDragRef,
  onDragStart,
  onMove,
  onDragEnd,
}: {
  event: React.MouseEvent;
  cls: UmlDiagramClass;
  scale: number;
  dragRef: ClassBoxDragPointRef;
  didDragRef: ClassBoxDidDragRef;
  onDragStart: () => void;
  onMove: (id: string, x: number, y: number) => void;
  onDragEnd: () => void;
}): ClassBoxDragCleanup | null {
  const target = event.target as HTMLElement;
  if (
    target.closest(
      'input, select, textarea, [data-no-drag], [data-reaction-port]',
    )
  ) {
    return null;
  }
  event.stopPropagation();
  didDragRef.current = false;
  onDragStart();
  dragRef.current = {
    sx: event.clientX,
    sy: event.clientY,
    ox: cls.x,
    oy: cls.y,
  };

  const handleMouseMove = (mouseEvent: MouseEvent) => {
    if (!dragRef.current) return;
    if (
      Math.abs(mouseEvent.clientX - dragRef.current.sx) > 3
      || Math.abs(mouseEvent.clientY - dragRef.current.sy) > 3
    ) {
      didDragRef.current = true;
    }
    onMove(
      cls.id,
      dragRef.current.ox
        + (mouseEvent.clientX - dragRef.current.sx) / scale,
      dragRef.current.oy
        + (mouseEvent.clientY - dragRef.current.sy) / scale,
    );
  };

  const cleanup = () => {
    globalThis.removeEventListener('mousemove', handleMouseMove);
    globalThis.removeEventListener('mouseup', handleMouseUp);
  };

  const handleMouseUp = () => {
    dragRef.current = null;
    onDragEnd();
    cleanup();
  };

  globalThis.addEventListener('mousemove', handleMouseMove);
  globalThis.addEventListener('mouseup', handleMouseUp);
  return cleanup;
}

interface ClassBoxNameSectionProps {
  cls: UmlDiagramClass;
  edit: UmlDiagramEditState | null;
  interactive: boolean;
  selected: boolean;
  isEditingName: boolean;
  nameSectionH: number;
  didDragRef: ClassBoxDidDragRef;
  onSelect: () => void;
  onStartEditName: () => void;
  onSaveName: (name: string) => void;
  onCancelEdit: () => void;
  onEditChange: (edit: UmlDiagramEditState) => void;
}

const ClassBoxNameSection = ({
  cls,
  edit,
  interactive,
  selected,
  isEditingName,
  nameSectionH,
  didDragRef,
  onSelect,
  onStartEditName,
  onSaveName,
  onCancelEdit,
  onEditChange,
}: ClassBoxNameSectionProps) => {
  const isAbstractOrIface = cls.isAbstract || cls.isInterface;
  const isEditingThisName = edit?.kind === 'name' && edit.classId === cls.id;
  const stereotypeLabel = cls.isInterface ? 'interface' : 'abstract';
  const nameFontStyle = cls.isAbstract ? 'italic' : 'normal';
  const nameSectionBackground = getClassBoxNameSectionBackground(
    isEditingName,
    selected,
  );
  const nameSectionPadding = getClassBoxNameSectionPadding(isEditingName);
  const nameSectionStyle = getClassBoxNameSectionStyle(
    nameSectionH,
    nameSectionBackground,
    nameSectionPadding,
  );
  const nameSectionAriaLabel = getClassBoxNameSectionAriaLabel(cls, selected);
  const nameSectionInteractionProps = getClassBoxNameSectionInteractionProps({
    interactive,
    selected,
    edit,
    classId: cls.id,
    didDragRef,
    onSelect,
    onStartEditName,
  });

  const stereotype = isAbstractOrIface ? (
    <span
      style={{
        fontSize: 10,
        color: '#444444',
        fontStyle: 'italic',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      }}
    >
      «{stereotypeLabel}»
    </span>
  ) : null;

  if (isEditingThisName && edit?.kind === 'name') {
    return (
      <fieldset
        aria-label={`Editing class name: ${cls.name}`}
        style={{
          ...nameSectionStyle,
          border: 'none',
          margin: 0,
          minWidth: 0,
        }}
      >
        {stereotype}
        <input
          autoFocus
          value={edit.val}
          onChange={event => onEditChange({
            ...edit,
            val: event.target.value,
          })}
          onKeyDown={event => handleUmlInlineEditKeyDown(
            event,
            () => onSaveName(edit.val),
            onCancelEdit,
          )}
          onBlur={() => onSaveName(edit.val)}
          onClick={event => event.stopPropagation()}
          aria-label={`Class name for ${cls.name}`}
          style={{
            width: '94%',
            textAlign: 'center',
            border: `2px solid ${UML.primary}`,
            borderRadius: 6,
            padding: '7px 10px',
            fontSize: 14,
            fontWeight: 700,
            fontFamily: UML.fontSans,
            color: UML.ink,
            background: UML.surface,
            outline: 'none',
            boxShadow: `0 0 0 3px ${UML.primaryRing}`,
          }}
        />
      </fieldset>
    );
  }

  return (
    <button
      type="button"
      disabled={!interactive}
      aria-label={nameSectionAriaLabel}
      {...nameSectionInteractionProps}
      style={{
        ...nameSectionStyle,
        border: 'none',
        margin: 0,
        width: '100%',
        boxSizing: 'border-box',
        cursor: interactive ? 'grab' : 'default',
        font: 'inherit',
        textAlign: 'center',
      }}
    >
      {stereotype}
      <span
        style={{
          fontWeight: 700,
          fontSize: 13,
          color: '#000000',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          fontStyle: nameFontStyle,
          textAlign: 'center',
          wordBreak: 'break-all',
        }}
      >
        {cls.name}
      </span>
    </button>
  );
};

export interface UMLClassBoxProps {
  cls: UmlDiagramClass;
  offsetX: number;
  offsetY: number;
  scale: number;
  selected: boolean;
  connectSource: boolean;
  interactive: boolean;
  edit: UmlDiagramEditState | null;
  reactionsMode: boolean;
  onReactionPortMouseDown?: (
    event: React.MouseEvent,
    classId: string,
    side: ReactionPortSide,
  ) => void;
  onSelect: () => void;
  onMove: (id: string, x: number, y: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onStartEditName: () => void;
  onSaveName: (name: string) => void;
  onStartEditAttr: (attrId: string) => void;
  onSaveAttr: (
    attrId: string,
    name: string,
    type: string,
    visibility: UMLVisibility,
  ) => void;
  onCancelEdit: () => void;
  onAddAttr: () => void;
  onDeleteAttr: (attrId: string) => void;
  onStartEditOp: (opId: string) => void;
  onSaveOp: (
    opId: string,
    name: string,
    returnType: string,
    visibility: UMLVisibility,
  ) => void;
  onAddOp: () => void;
  onDeleteOp: (opId: string) => void;
  onDelete: () => void;
  onEditChange: (edit: UmlDiagramEditState) => void;
}

export const UMLClassBox = ({
  cls,
  offsetX,
  offsetY,
  scale,
  selected,
  connectSource,
  interactive,
  edit,
  reactionsMode,
  onReactionPortMouseDown,
  onSelect,
  onDragStart,
  onMove,
  onDragEnd,
  onStartEditName,
  onSaveName,
  onStartEditAttr,
  onSaveAttr,
  onCancelEdit,
  onAddAttr,
  onDeleteAttr,
  onStartEditOp,
  onSaveOp,
  onAddOp,
  onDeleteOp,
  onDelete,
  onEditChange,
}: UMLClassBoxProps) => {
  const dragRef: ClassBoxDragPointRef = useRef<{
    sx: number;
    sy: number;
    ox: number;
    oy: number;
  } | null>(null);
  const didDragRef: ClassBoxDidDragRef = useRef(false);
  const dragCleanupRef = useRef<ClassBoxDragCleanup | null>(null);
  const [hoveredAttr, setHoveredAttr] = useState<string | null>(null);
  const [hoveredOp, setHoveredOp] = useState<string | null>(null);

  useEffect(() => () => {
    dragCleanupRef.current?.();
    dragCleanupRef.current = null;
    dragRef.current = null;
  }, []);

  const isEditingBox = isClassBoxEditing(edit, cls.id);
  const isEditingName = isClassEditingName(edit, cls.id);
  const displayW = isEditingBox
    ? UML_CLASS_BOX_EDIT_WIDTH
    : UML_CLASS_BOX_WIDTH;
  const nameSectionH = getClassBoxNameSectionHeight(cls, isEditingName);
  const sectionPadding = getClassBoxSectionPadding(isEditingBox);
  const wrapperStyle = getClassBoxWrapperStyle({
    cls,
    offsetX,
    offsetY,
    displayW,
  });
  const boxHighlighted = isClassBoxHighlighted(selected, connectSource);
  const boxBorder = getClassBoxBorder(selected, connectSource);
  const boxShadow = getClassBoxBoxShadow(isEditingBox, boxHighlighted);
  const boxZIndex = getClassBoxZIndex(isEditingBox, selected);
  const boxStyle = getClassBoxOuterStyle({
    boxBorder,
    boxShadow,
    boxZIndex,
  });
  const boxAriaLabel = getClassBoxAriaLabel(
    cls,
    selected,
    connectSource,
  );

  const handleBoxMouseDown = (event: React.MouseEvent) => {
    const dragCleanup = startClassBoxDrag({
      event,
      cls,
      scale,
      dragRef,
      didDragRef,
      onDragStart,
      onMove,
      onDragEnd,
    });
    if (dragCleanup) {
      dragCleanupRef.current = dragCleanup;
    }
  };

  const boxInteractionProps = getClassBoxInteractionProps({
    interactive,
    selected,
    boxAriaLabel,
    didDragRef,
    onBoxMouseDown: handleBoxMouseDown,
    onSelect,
  });

  return (
    <div style={wrapperStyle}>
      <div
        data-classbox
        {...boxInteractionProps}
        style={boxStyle}
      >
        <ClassBoxNameSection
          cls={cls}
          edit={edit}
          interactive={interactive}
          selected={selected}
          isEditingName={isEditingName}
          nameSectionH={nameSectionH}
          didDragRef={didDragRef}
          onSelect={onSelect}
          onStartEditName={onStartEditName}
          onSaveName={onSaveName}
          onCancelEdit={onCancelEdit}
          onEditChange={onEditChange}
        />

        <div
          style={{
            borderBottom: `1px solid ${UML.border}`,
            padding: sectionPadding,
            background: UML.surface,
            transition: 'padding 0.22s ease',
          }}
        >
          {cls.attributes.map(attr => (
            <UmlAttributeRow
              key={attr.id}
              attr={attr}
              expanded={isEditingBox}
              editing={edit}
              hovered={hoveredAttr === attr.id}
              showDelete={interactive && selected}
              onMouseEnter={() => setHoveredAttr(attr.id)}
              onMouseLeave={() => setHoveredAttr(null)}
              onDoubleClick={() => onStartEditAttr(attr.id)}
              onSave={(name, type, visibility) => onSaveAttr(
                attr.id,
                name,
                type,
                visibility,
              )}
              onCancel={onCancelEdit}
              onDelete={() => onDeleteAttr(attr.id)}
              onEditChange={(name, type, visibility) => onEditChange({
                classId: cls.id,
                kind: 'attr',
                attrId: attr.id,
                name,
                type,
                visibility,
              })}
            />
          ))}
          {interactive && <UmlAddAttributeRow onClick={onAddAttr} />}
        </div>

        <div
          style={{
            padding: sectionPadding,
            background: '#ffffff',
            minHeight: UML_CLASS_EMPTY_OPERATION_SECTION_HEIGHT,
            transition: 'padding 0.22s ease',
          }}
        >
          {cls.operations.map(op => (
            <UmlOperationRow
              key={op.id}
              op={op}
              expanded={isEditingBox}
              editing={edit}
              hovered={hoveredOp === op.id}
              showDelete={interactive && selected}
              onMouseEnter={() => setHoveredOp(op.id)}
              onMouseLeave={() => setHoveredOp(null)}
              onDoubleClick={() => onStartEditOp(op.id)}
              onSave={(name, returnType, visibility) => onSaveOp(
                op.id,
                name,
                returnType,
                visibility,
              )}
              onCancel={onCancelEdit}
              onDelete={() => onDeleteOp(op.id)}
              onEditChange={(name, returnType, visibility) => onEditChange({
                classId: cls.id,
                kind: 'op',
                opId: op.id,
                name,
                returnType,
                visibility,
              })}
            />
          ))}
          {interactive && <UmlAddOperationRow onClick={onAddOp} />}
        </div>
      </div>

      {interactive && selected && (
        <button
          type="button"
          data-no-drag
          title="Delete class"
          aria-label={`Delete class ${cls.name}`}
          onClick={event => {
            event.stopPropagation();
            onDelete();
          }}
          style={{
            position: 'absolute',
            top: -10,
            right: -10,
            width: 20,
            height: 20,
            borderRadius: '50%',
            border: '1px solid #fecaca',
            background: '#fef2f2',
            color: '#dc2626',
            fontSize: 11,
            lineHeight: 1,
            cursor: 'pointer',
            zIndex: 2,
          }}
        >
          ✕
        </button>
      )}

      {reactionsMode && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none',
            borderRadius: 6,
            border: '2px dashed rgba(168,85,247,0.5)',
            boxShadow: '0 0 8px rgba(168,85,247,0.2)',
            animation: 'reactionPulse 2s ease-in-out infinite',
          }}
        >
          <button
            type="button"
            aria-label={`Right reaction port for ${cls.name}`}
            data-reaction-port
            data-class-id={cls.id}
            data-port-side="right"
            onMouseDown={onReactionPortMouseDown
              ? event => onReactionPortMouseDown(event, cls.id, 'right')
              : undefined}
            style={{
              position: 'absolute',
              top: '50%',
              right: -7,
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: '#a855f7',
              border: '2px solid #fff',
              transform: 'translateY(-50%)',
              boxShadow: '0 0 6px rgba(168,85,247,0.6)',
              pointerEvents: 'auto',
              cursor: 'crosshair',
              padding: 0,
            }}
          />
          <button
            type="button"
            aria-label={`Left reaction port for ${cls.name}`}
            data-reaction-port
            data-class-id={cls.id}
            data-port-side="left"
            onMouseDown={onReactionPortMouseDown
              ? event => onReactionPortMouseDown(event, cls.id, 'left')
              : undefined}
            style={{
              position: 'absolute',
              top: '50%',
              left: -7,
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: '#a855f7',
              border: '2px solid #fff',
              transform: 'translateY(-50%)',
              boxShadow: '0 0 6px rgba(168,85,247,0.6)',
              pointerEvents: 'auto',
              cursor: 'crosshair',
              padding: 0,
            }}
          />
        </div>
      )}
    </div>
  );
};
