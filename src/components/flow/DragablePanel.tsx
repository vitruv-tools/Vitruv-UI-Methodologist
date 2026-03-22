import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Panel } from "reactflow";
import { IconButton, Paper, Popover, Stack, Typography } from "@mui/material";
import {
  DragIndicator,
  Delete,
  Minimize,
  Maximize,
  Close,
  Settings,
  Save,
  Undo,
} from "@mui/icons-material";

/**
 * Properties for rendering the draggable bottom panel and optional toolbar actions.
 */
interface DragablePanelProps {
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
  settings?: React.ReactNode;
  onSave?: () => void;
  onUndo?: () => void;
  onDelete?: () => void;
  className?: string;
  translateX?: string;
  translateY?: string;
}

export interface DragablePanelOptionalToolbarRef {
  save: () => void;
  undo: () => void;
  delete: () => void;
}

/**
 * Imperative API exposed by the draggable panel instance.
 */
export interface DragablePanelRef {
  setSaveHighlighted: (highlighted: boolean) => void;
  close: () => void;
}

/**
 * Renders a draggable panel anchored to the React Flow viewport with optional toolbar actions.
 * Key behaviors:
 * - Anchors bottom-center via React Flow Panel and applies a drag offset on top.
 * - Dragging is bounded to the React Flow viewport with small margins to avoid clipping.
 * - Minimize snaps back to the starting anchor; maximize restores the last dragged position.
 * @param {DragablePanelProps} props - Panel content, callbacks, and positioning options.
 * @param {React.ForwardedRef<DragablePanelRef>} ref - Ref exposing imperative panel controls.
 * @returns {JSX.Element} The draggable panel container.
 */
export const DragablePanel = forwardRef<DragablePanelRef, DragablePanelProps>(({
  title,
  description,
  onClose,
  children,
  settings,
  onSave,
  onUndo,
  onDelete,
  className = "",
  translateX = "-50%",
  translateY = "0%",
}, ref) => {
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [offset, setOffset] = useState({ dx: 0, dy: 0 });
  const [isMinimized, setIsMinimized] = useState(false);
  const [isSaveHighlighted, setIsSaveHighlighted] = useState(false);
  const dragStartRef = useRef({
    // Start mouse x when the current drag started
    startX: 0,
    // Start mouse y when the current drag started
    startY: 0,
    // Start offset x where the current drag started
    startDx: 0,
    // Start offset y where the current drag started
    startDy: 0,
    dxMin: -Infinity,
    dxMax: Infinity,
    dyMin: -Infinity,
    dyMax: Infinity,
  });
  const lastDragOffsetRef = useRef<{ dx: number; dy: number }>({
    dx: 0,
    dy: 0,
  });
  const panelContentRef = useRef<HTMLDivElement>(null);
  // 48 for the toolbar with "Check build", "Save changes" etc.
  const dragAndDropMargins = { top: 16 + 48, bottom: 16, left: 16, right: 16 };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest(".drag-handle")) {
      setIsDragging(true);
      const panelEl =
        panelContentRef.current?.closest(".dragable-panel") || undefined; // Panel root element
      const panelRect = panelEl?.getBoundingClientRect();
      const reactFlow = panelEl?.closest(".react-flow") ?? undefined;
      const reactFlowRect = reactFlow?.getBoundingClientRect();

      // Compute horizontal bounds relative to bottom-center base position
      let dxMin = -Infinity;
      let dxMax = Infinity;
      let dyMin = -Infinity;
      let dyMax = Infinity;
      if (panelRect && reactFlowRect) {
        dxMin = reactFlowRect.left - panelRect.left + dragAndDropMargins.left;
        dxMax =
          reactFlowRect.right - panelRect.right - dragAndDropMargins.right;
        dyMin = reactFlowRect.top - panelRect.top + dragAndDropMargins.top;
        dyMax =
          reactFlowRect.bottom - panelRect.bottom - dragAndDropMargins.bottom;
      }

      dragStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startDx: offset.dx,
        startDy: offset.dy,
        dxMin,
        dxMax,
        dyMin,
        dyMax,
      };
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const { startX, startY, startDx, startDy, dxMin, dxMax, dyMin, dyMax } =
          dragStartRef.current;
        const clampedDx = Math.max(dxMin, Math.min(dxMax, e.clientX - startX));
        const clampedDy = Math.max(dyMin, Math.min(dyMax, e.clientY - startY));
        const clampedOffsetX = startDx + clampedDx;
        const clampedOffsetY = startDy + clampedDy;
        setOffset({ dx: clampedOffsetX, dy: clampedOffsetY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging]);

  useImperativeHandle(
    ref,
    () => ({
      setSaveHighlighted: setIsSaveHighlighted,
      close: onClose,
    }),
    [],
  );

  return (
    <Panel
      // Base position; override to bottom-center via styles
      position="bottom-left"
      style={{
        transform: `translateX(${translateX}) translateY(${translateY}) translate(${offset.dx}px, ${offset.dy}px)`,
        cursor: isDragging ? "grabbing" : "auto",
      }}
      onMouseDown={handleMouseDown}
      className={`dragable-panel ${className}`}
    >
      <Paper
        elevation={8}
        sx={{
          width: "100%",
          p: 2,
          borderRadius: 2,
          bgcolor: "#ffffff",
          border: "1px solid #e5e7eb",
        }}
      >
        <Stack spacing={2}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap={1}
          >
            <Stack
              direction="row"
              alignItems="center"
              gap={0.5}
              className="drag-handle"
              sx={{
                cursor: "grab",
                "&:active": { cursor: "grabbing" },
                userSelect: "none",
                flex: 1,
              }}
              ref={panelContentRef}
            >
              <DragIndicator sx={{ fontSize: 18, color: "text.secondary" }} />
              <Typography
                variant="subtitle1"
                fontWeight={700}
                color="text.primary"
              >
                {title}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ ml: 1 }}
              >
                {description}
              </Typography>
            </Stack>
            <Stack direction="row" gap={0.5}>
              {onUndo && (
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUndo();
                  }}
                  aria-label="undo"
                >
                  <Undo sx={{ fontSize: 18 }} />
                </IconButton>
              )}
              {onSave && (
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSave();
                  }}
                  aria-label="save"
                  sx={
                    isSaveHighlighted
                      ? {
                          color: "#ffffff",
                          bgcolor: "warning.main",
                          "&:hover": {
                            bgcolor: "warning.dark",
                          },
                        }
                      : undefined
                  }
                >
                  <Save sx={{ fontSize: 18 }} />
                </IconButton>
              )}
              {onDelete && (
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  aria-label="delete"
                >
                  <Delete sx={{ fontSize: 18 }} />
                </IconButton>
              )}
              {settings && (
                <>
                  <IconButton
                    ref={settingsButtonRef}
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsSettingsOpen(true);
                    }}
                    aria-label="settings"
                  >
                    <Settings sx={{ fontSize: 18 }} />
                  </IconButton>
                  {isSettingsOpen && (
                    <Popover
                      anchorEl={settingsButtonRef.current}
                      open={isSettingsOpen}
                      onClose={() => setIsSettingsOpen(false)}
                    >
                      {settings}
                    </Popover>
                  )}
                </>
              )}
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isMinimized) {
                    // Minimizing: snap to starting location
                    lastDragOffsetRef.current = { ...offset };
                    setOffset({ dx: 0, dy: 0 });
                    setIsMinimized(true);
                  } else {
                    // Maximizing: restore last drag location
                    setIsMinimized(false);
                    setOffset({ ...lastDragOffsetRef.current });
                  }
                }}
                aria-label={isMinimized ? "maximize" : "minimize"}
              >
                {isMinimized ? (
                  <Maximize sx={{ fontSize: 18 }} />
                ) : (
                  <Minimize sx={{ fontSize: 18 }} />
                )}
              </IconButton>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                aria-label="close"
              >
                <Close sx={{ fontSize: 18 }} />
              </IconButton>
            </Stack>
          </Stack>

          {!isMinimized && children}
        </Stack>
      </Paper>
    </Panel>
  );
});

DragablePanel.displayName = "DragablePanel";
