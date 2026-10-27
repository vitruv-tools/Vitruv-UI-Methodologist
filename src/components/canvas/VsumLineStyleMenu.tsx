import React, { useEffect, useId, useRef, useState } from 'react';


type LineStyle = 'dashed' | 'solid';

const LINE_STYLE_OPTIONS: { value: LineStyle; label: string }[] = [
  { value: 'dashed', label: 'Dashed' },
  { value: 'solid', label: 'Solid' },
];

interface VsumMenuButtonProps {
  ref: React.Ref<HTMLButtonElement>;
  'aria-haspopup'?: 'menu';
  'aria-expanded'?: boolean;
  'aria-controls'?: string;
  onKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
}

interface VsumLineStyleMenuProps {
  lineStyle: LineStyle;
  onLineStyleChange?: (style: LineStyle) => void;
  opensOnActivate: boolean;
  children: (buttonProps: VsumMenuButtonProps) => React.ReactNode;
}

export const VsumLineStyleMenu: React.FC<VsumLineStyleMenuProps> = ({
  lineStyle,
  onLineStyleChange,
  opensOnActivate,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const pendingFocusIndex = useRef<number | null>(null);

  useEffect(() => {
    if (open && pendingFocusIndex.current !== null) {
      itemRefs.current[pendingFocusIndex.current]?.focus();
      pendingFocusIndex.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (wrapperRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        buttonRef.current?.focus();
      }
      setOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  if (!onLineStyleChange) {
    return <>{children({ ref: buttonRef })}</>;
  }

  const selectedIndex = Math.max(0, LINE_STYLE_OPTIONS.findIndex(o => o.value === lineStyle));

  const focusItem = (index: number) => {
    const count = LINE_STYLE_OPTIONS.length;
    itemRefs.current[(index + count) % count]?.focus();
  };

  const openAndFocus = (index: number) => {
    if (open) {
      focusItem(index);
      return;
    }
    pendingFocusIndex.current = index;
    setOpen(true);
  };

  const handlePointerLeave = () => {
    if (itemRefs.current.some(item => item === document.activeElement)) {
      buttonRef.current?.focus();
    }
    setOpen(false);
  };

  const handleButtonKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const activates = event.key === 'Enter' || event.key === ' ';
    if (event.key === 'ArrowDown' || (activates && opensOnActivate)) {
      event.preventDefault();
      openAndFocus(selectedIndex);
    }
  };

  const handleItemKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusItem(index + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusItem(index - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusItem(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusItem(LINE_STYLE_OPTIONS.length - 1);
    }
  };

  return (
    <div
      ref={wrapperRef}
      style={{ position: 'relative', display: 'flex' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={handlePointerLeave}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      {children({
        ref: buttonRef,
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': open ? menuId : undefined,
        onKeyDown: handleButtonKeyDown,
      })}
      {open && (
        <div style={{ position: 'absolute', top: '100%', right: 0, paddingTop: 10, zIndex: 1 }}>
          <div
            id={menuId}
            role="menu"
            aria-label="Reaction arrow style"
            style={{
              display: 'flex',
              flexDirection: 'column',
              minWidth: 92,
              padding: 4,
              borderRadius: 6,
              background: 'var(--v-chrome-bg)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.13), 0 0 0 1px rgba(0,0,0,0.07)',
            }}
          >
            {LINE_STYLE_OPTIONS.map((option, index) => {
              const selected = option.value === lineStyle;
              return (
                <button
                  key={option.value}
                  ref={el => { itemRefs.current[index] = el; }}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  tabIndex={-1}
                  onClick={() => onLineStyleChange(option.value)}
                  onKeyDown={event => handleItemKeyDown(event, index)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 24,
                    padding: '0 8px',
                    border: 'none',
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                    textAlign: 'left',
                    background: selected ? '#e3f2fd' : 'transparent',
                    color: selected ? '#1565c0' : 'var(--v-chrome-icon)',
                    fontFamily: 'inherit',
                  }}
                >
                  <span aria-hidden="true" style={{ width: 10 }}>{selected ? '✓' : ''}</span>
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

