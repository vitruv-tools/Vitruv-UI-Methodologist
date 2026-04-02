// src/components/flow/canvas/ViewTypeDeletionMenu.tsx
import React from 'react';
import ReactDOM from 'react-dom';

interface ViewTypeDeletionMenuProps {
    x: number;
    y: number;
    label: string;
    onDelete: () => void;
    onClose: () => void;
}

export const ViewTypeDeletionMenu: React.FC<ViewTypeDeletionMenuProps> = ({
    x, y, label, onDelete, onClose,
}) => ReactDOM.createPortal(
    <>
        <div
            style={{ position: 'fixed', inset: 0, zIndex: 999 }}
            onClick={onClose}
        />
        <div
            style={{
                position: 'fixed',
                left: x,
                top: y,
                zIndex: 1000,
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                minWidth: 140,
            }}
            onClick={e => e.stopPropagation()}
        >
            <div style={{ fontSize: 12, color: '#6b7280', padding: '4px 8px' }}>
                {label}
            </div>
            <button
                onClick={() => { onDelete(); onClose(); }}
                style={{
                    background: 'none',
                    border: 'none',
                    color: '#dc2626',
                    fontSize: 13,
                    fontWeight: 500,
                    padding: '6px 8px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    textAlign: 'left',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
                Delete view type
            </button>
        </div>
    </>,
    document.body
);