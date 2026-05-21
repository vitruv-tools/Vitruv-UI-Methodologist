import React from 'react';
import ReactDOM from 'react-dom';

interface ViewTypeDeletionMenuProps {
    x: number;
    y: number;
    label: string;
    onDelete: () => void;
    onClose: () => void;
}

const PRIMARY = '#049484';
const FONT = 'Georgia, serif';

const BACKDROP_STYLE: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 999,
    background: 'rgba(0, 0, 0, 0.2)',
    border: 'none',
    cursor: 'default',
    padding: 0,
};

const MENU_STYLE: React.CSSProperties = {
    position: 'fixed',
    margin: 0,
    zIndex: 1000,
    background: '#ffffff',
    border: '1px solid #e3f2fd',
    borderRadius: 10,
    boxShadow: '0 12px 40px rgba(4, 148, 132, 0.12), 0 6px 16px rgba(0, 0, 0, 0.08)',
    padding: '4px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 180,
    fontFamily: FONT,
    overflow: 'hidden',
};

const LABEL_STYLE: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: PRIMARY,
    padding: '8px 12px',
    borderBottom: '1px solid #e8f4f8',
    background: 'linear-gradient(135deg, #f8fcff 0%, #e8f4f8 100%)',
};

const DELETE_BUTTON_STYLE: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: '#dc2626',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: FONT,
    padding: '8px 12px',
    borderRadius: 6,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.2s ease',
};

export const ViewTypeDeletionMenu: React.FC<ViewTypeDeletionMenuProps> = ({
    x, y, label, onDelete, onClose,
}) => ReactDOM.createPortal(
    <>
        <button
            type="button"
            aria-label="Close menu"
            style={BACKDROP_STYLE}
            onClick={onClose}
        />
        <dialog
            open
            style={{ ...MENU_STYLE, left: x, top: y }}
        >
            <div style={LABEL_STYLE}>
                {label}
            </div>
            <button
                type="button"
                style={DELETE_BUTTON_STYLE}
                onClick={() => { onDelete(); onClose(); }}
                onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
            >
                Delete view type
            </button>
        </dialog>
    </>,
    document.body
);
