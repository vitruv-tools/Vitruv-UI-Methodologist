import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';

const ACTIONS_MENU_Z_INDEX = 10500;

const DotsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
  </svg>
);

export interface PortalMenuAction {
  label: string;
  onClick: () => void;
  danger?: boolean;
  dividerBefore?: boolean;
}

interface PortalRowActionsMenuProps {
  actions: PortalMenuAction[];
  minWidth?: number;
  /** When provided, the menu closes if this scroll container moves. */
  scrollRootRef?: React.RefObject<HTMLElement | null>;
}

function isEventInsideMenu(
  event: Event,
  buttonEl: HTMLButtonElement | null,
  menuEl: HTMLDivElement | null,
): boolean {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  if (path.length > 0) {
    if (buttonEl && path.includes(buttonEl)) return true;
    if (menuEl && path.includes(menuEl)) return true;
    return false;
  }
  const target = event.target as Node | null;
  return Boolean(target && (buttonEl?.contains(target) || menuEl?.contains(target)));
}

const PortalMenuItem: React.FC<{ label: string; onSelect: () => void; danger?: boolean }> = ({
  label,
  onSelect,
  danger,
}) => (
  <button
    type="button"
    role="menuitem"
    onClick={e => {
      e.stopPropagation();
      onSelect();
    }}
    style={{
      display: 'block',
      width: '100%',
      padding: '9px 14px',
      border: 'none',
      background: 'transparent',
      fontSize: 13,
      color: danger ? '#dc2626' : 'var(--v-text-secondary)',
      cursor: 'pointer',
      textAlign: 'left',
      pointerEvents: 'auto',
    }}
    onMouseEnter={e => {
      (e.currentTarget as HTMLButtonElement).style.background = danger ? '#fef2f2' : 'var(--v-surface-hover)';
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
    }}
  >
    {label}
  </button>
);

export const PortalRowActionsMenu: React.FC<PortalRowActionsMenuProps> = ({
  actions,
  minWidth = 160,
  scrollRootRef,
}) => {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const ignoreOutsideUntilRef = useRef(0);

  const closeMenu = useCallback(() => setOpen(false), []);

  const updateMenuPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, left: rect.right });
  }, []);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    // Ignore the opening click/pointer sequence.
    ignoreOutsideUntilRef.current = Date.now() + 100;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (Date.now() < ignoreOutsideUntilRef.current) return;
      if (isEventInsideMenu(e, buttonRef.current, menuRef.current)) return;
      closeMenu();
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [open, closeMenu]);

  useEffect(() => {
    if (!open) return;
    const scrollEl = scrollRootRef?.current;
    if (!scrollEl) return;
    const onScroll = () => closeMenu();
    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    return () => scrollEl.removeEventListener('scroll', onScroll);
  }, [open, closeMenu, scrollRootRef]);

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(prev => {
      if (!prev) updateMenuPosition();
      return !prev;
    });
  };

  const selectAction = (action: PortalMenuAction) => {
    action.onClick();
    closeMenu();
  };

  const menu = open ? (
    <div
      ref={menuRef}
      role="menu"
      tabIndex={-1}
      aria-label="Row actions menu"
      style={{
        position: 'fixed',
        top: menuPos.top,
        left: menuPos.left,
        transform: 'translateX(-100%)',
        background: 'var(--v-surface)',
        border: '1px solid var(--v-border)',
        borderRadius: 10,
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        zIndex: ACTIONS_MENU_Z_INDEX,
        minWidth,
        overflow: 'hidden',
        pointerEvents: 'auto',
      }}
    >
      {actions.map(action => (
        <React.Fragment key={action.label}>
          {action.dividerBefore && (
            <div style={{ height: 1, background: 'var(--v-border-subtle)', margin: '2px 0' }} />
          )}
          <PortalMenuItem
            label={action.label}
            danger={action.danger}
            onSelect={() => selectAction(action)}
          />
        </React.Fragment>
      ))}
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        ref={buttonRef}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Row actions"
        onClick={toggleMenu}
        onMouseDown={e => e.stopPropagation()}
        style={{
          padding: '4px 8px',
          border: '1px solid var(--v-border)',
          borderRadius: 6,
          background: 'var(--v-surface)',
          cursor: 'pointer',
          color: 'var(--v-text-muted)',
          display: 'flex',
          alignItems: 'center',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--v-surface-hover)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--v-text-faint)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--v-surface)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--v-border)';
        }}
      >
        <DotsIcon />
      </button>
      {menu && ReactDOM.createPortal(menu, document.body)}
    </>
  );
};
