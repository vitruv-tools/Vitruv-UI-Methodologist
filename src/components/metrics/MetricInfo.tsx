import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { APP_FONT } from '../ui/sharedStyles';
import { METRIC_DEFINITIONS, type MetricId } from '../../utils/metricDefinitions';

const POPOVER_WIDTH = 300;
const VIEWPORT_MARGIN = 8;
const GAP = 6;

type Position = { left: number; top?: number; bottom?: number };

function computePosition(anchor: DOMRect, popoverHeight: number): Position {
  const maxLeft = window.innerWidth - POPOVER_WIDTH - VIEWPORT_MARGIN;
  const left = Math.max(VIEWPORT_MARGIN, Math.min(anchor.left + anchor.width / 2 - POPOVER_WIDTH / 2, maxLeft));
  const fitsBelow = anchor.bottom + GAP + popoverHeight <= window.innerHeight - VIEWPORT_MARGIN;
  if (fitsBelow || anchor.top < popoverHeight + GAP) return { left, top: anchor.bottom + GAP };
  return { left, bottom: window.innerHeight - anchor.top + GAP };
}

const SECTIONS: Array<{ key: 'represents' | 'measures' | 'calculation' | 'interpretation'; title: string }> = [
  { key: 'represents', title: 'What it is' },
  { key: 'measures', title: 'What it measures' },
  { key: 'calculation', title: 'How it is calculated' },
  { key: 'interpretation', title: 'How to read it' },
];

export const MetricInfo: React.FC<{ id: MetricId }> = ({ id }) => {
  const definition = METRIC_DEFINITIONS[id];
  const tooltipId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const open = hovered || focused || pinned;

  const reposition = useCallback(() => {
    const anchor = buttonRef.current?.getBoundingClientRect();
    if (!anchor) return;
    setPosition(computePosition(anchor, popoverRef.current?.offsetHeight ?? 220));
  }, []);

  useLayoutEffect(() => {
    if (open) reposition();
    else setPosition(null);
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setPinned(false);
      setHovered(false);
      setFocused(false);
    };
    const onPointerDown = (event: MouseEvent) => {
      if (!buttonRef.current?.contains(event.target as Node)) setPinned(false);
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    document.addEventListener('keydown', close);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
      document.removeEventListener('keydown', close);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open, reposition]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`About ${definition.label}`}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        data-testid={`metric-info-${id}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onClick={() => {
          if (!pinned) {
            setPinned(true);
            return;
          }
          setPinned(false);
          setHovered(false);
          setFocused(false);
        }}
        style={{
          flexShrink: 0,
          width: 14,
          height: 14,
          padding: 0,
          borderRadius: '50%',
          border: '1px solid currentColor',
          background: 'transparent',
          color: 'var(--v-text-muted)',
          fontFamily: APP_FONT,
          fontSize: 9,
          fontWeight: 700,
          lineHeight: '12px',
          textAlign: 'center',
          textTransform: 'none',
          letterSpacing: 0,
          cursor: 'help',
          opacity: open ? 1 : 0.75,
        }}
      >
        ?
      </button>
      {open && createPortal(
        <div
          ref={popoverRef}
          id={tooltipId}
          role="tooltip"
          style={{
            position: 'fixed',
            left: position?.left ?? 0,
            top: position?.top,
            bottom: position?.bottom,
            visibility: position ? 'visible' : 'hidden',
            zIndex: 3000,
            width: POPOVER_WIDTH,
            boxSizing: 'border-box',
            pointerEvents: 'none',
            padding: '10px 12px',
            borderRadius: 8,
            background: '#0f172a',
            color: '#ffffff',
            fontFamily: APP_FONT,
            fontSize: 11,
            lineHeight: 1.4,
            textAlign: 'left',
            textTransform: 'none',
            letterSpacing: 0,
            whiteSpace: 'normal',
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.28)',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{definition.label}</div>
          {SECTIONS.map(section => (
            <div key={section.key} style={{ marginTop: 5 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#5eead4' }}>{section.title}</div>
              <div style={{ color: 'rgba(255,255,255,0.86)' }}>{definition[section.key]}</div>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
};

export const MetricLabel: React.FC<{ id: MetricId; children?: React.ReactNode }> = ({ id, children }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: '100%' }}>
    <span style={{ minWidth: 0 }}>{children ?? METRIC_DEFINITIONS[id].label}</span>
    <MetricInfo id={id} />
  </span>
);
