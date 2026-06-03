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
}

const PortalMenuItem: React.FC<{ label: string; onClick: () => void; danger?: boolean }> = ({
  label,
  onClick,
  danger,
}) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: 'block',
      width: '100%',
      padding: '9px 14px',
      border: 'none',
      background: 'transparent',
      fontSize: 13,
      color: danger ? '#dc2626' : '#374151',
      cursor: 'pointer',
      textAlign: 'left',
    }}
    onMouseEnter={e => {
      (e.currentTarget as HTMLButtonElement).style.background = danger ? '#fef2f2' : '#f9fafb';
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
}) => {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateMenuPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, left: rect.right });
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutside);
    return () => document.removeEventListener('mousedown', closeOnOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnScroll = () => setOpen(false);
    window.addEventListener('scroll', closeOnScroll, true);
    window.addEventListener('resize', closeOnScroll);
    return () => {
      window.removeEventListener('scroll', closeOnScroll, true);
      window.removeEventListener('resize', closeOnScroll);
    };
  }, [open]);

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(prev => {
      if (!prev) updateMenuPosition();
      return !prev;
    });
  };

  const menu = open ? (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: menuPos.top,
        left: menuPos.left,
        transform: 'translateX(-100%)',
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        zIndex: ACTIONS_MENU_Z_INDEX,
        minWidth,
        overflow: 'hidden',
      }}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      {actions.map(action => (
        <React.Fragment key={action.label}>
          {action.dividerBefore && (
            <div style={{ height: 1, background: '#f3f4f6', margin: '2px 0' }} />
          )}
          <PortalMenuItem
            label={action.label}
            danger={action.danger}
            onClick={() => {
              action.onClick();
              setOpen(false);
            }}
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
        onClick={toggleMenu}
        style={{
          padding: '4px 8px',
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          background: '#fff',
          cursor: 'pointer',
          color: '#6b7280',
          display: 'flex',
          alignItems: 'center',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.background = '#f9fafb';
          (e.currentTarget as HTMLButtonElement).style.borderColor = '#d1d5db';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = '#fff';
          (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb';
        }}
      >
        <DotsIcon />
      </button>
      {menu && ReactDOM.createPortal(menu, document.body)}
    </>
  );
};
