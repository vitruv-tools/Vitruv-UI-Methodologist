import React, { useEffect, useRef } from 'react';
import type { UmlModelGroupBounds } from '../../utils/umlModelGroups';

export interface UMLModelGroupWrappersProps {
  modelGroups: UmlModelGroupBounds[];
  offsetX: number;
  offsetY: number;
  vscale: number;
  interactive: boolean;
  removableModelNames: ReadonlySet<string>;
  onRemoveAdditionalModel?: (modelName: string) => void;
  beginGroupDrag: (groupName: string) => void;
  moveGroupDrag: (groupName: string, dx: number, dy: number) => void;
  endGroupDrag: () => void;
  onGroupDragComplete: () => void;
}

export const UMLModelGroupWrappers: React.FC<
  UMLModelGroupWrappersProps
> = ({
  modelGroups,
  offsetX,
  offsetY,
  vscale,
  interactive,
  removableModelNames,
  onRemoveAdditionalModel,
  beginGroupDrag,
  moveGroupDrag,
  endGroupDrag,
  onGroupDragComplete,
}) => {
  const activeGestureRef = useRef<{
    finish: (completed: boolean) => void;
  } | null>(null);

  useEffect(() => () => {
    activeGestureRef.current?.finish(false);
  }, []);

  const handleGroupMouseDown = (
    event: React.MouseEvent,
    groupName: string,
  ) => {
    event.stopPropagation();
    event.preventDefault();
    activeGestureRef.current?.finish(false);

    const startX = event.clientX;
    const startY = event.clientY;
    beginGroupDrag(groupName);

    let active = true;
    let handleMouseUp: () => void;
    const handleMouseMove = (mouseEvent: MouseEvent) => {
      moveGroupDrag(
        groupName,
        (mouseEvent.clientX - startX) / vscale,
        (mouseEvent.clientY - startY) / vscale,
      );
    };
    const finish = (completed: boolean) => {
      if (!active) return;
      active = false;
      try {
        endGroupDrag();
        if (completed) onGroupDragComplete();
      } finally {
        globalThis.removeEventListener('mousemove', handleMouseMove);
        globalThis.removeEventListener('mouseup', handleMouseUp);
        if (activeGestureRef.current?.finish === finish) {
          activeGestureRef.current = null;
        }
      }
    };
    handleMouseUp = () => finish(true);

    activeGestureRef.current = { finish };
    globalThis.addEventListener('mousemove', handleMouseMove);
    globalThis.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <>
      {modelGroups.map(group => {
        const left = group.minX + offsetX;
        const top = group.minY + offsetY;
        const canRemove = interactive
          && removableModelNames.has(group.name)
          && Boolean(onRemoveAdditionalModel);
        return (
          <div
            key={group.name}
            style={{
              position: 'absolute',
              left,
              top,
              width: group.width,
              height: group.height,
              border: `2px solid ${group.color}`,
              borderRadius: 10,
              background: group.fill,
              pointerEvents: 'none',
              zIndex: 0,
            }}
          >
            <div
              data-wrapper-header
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 22,
                background: group.color,
                borderRadius: '8px 8px 0 0',
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 8,
                paddingRight: canRemove ? 4 : 8,
                fontSize: 11,
                fontWeight: 700,
                color: '#fff',
                letterSpacing: 0.3,
                pointerEvents: 'auto',
              }}
            >
              <button
                type="button"
                onMouseDown={interactive
                  ? event => handleGroupMouseDown(event, group.name)
                  : undefined}
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: '100%',
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#fff',
                  letterSpacing: 0.3,
                  cursor: interactive ? 'grab' : 'default',
                  textAlign: 'left',
                }}
              >
                {group.name}
              </button>
              {canRemove && (
                <button
                  type="button"
                  title={`Remove ${group.name}`}
                  aria-label={`Remove ${group.name}`}
                  onClick={event => {
                    event.stopPropagation();
                    onRemoveAdditionalModel?.(group.name);
                  }}
                  style={{
                    width: 18,
                    height: 18,
                    border: 'none',
                    borderRadius: 4,
                    background: 'rgba(255,255,255,0.18)',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                >
                  &times;
                </button>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
};
