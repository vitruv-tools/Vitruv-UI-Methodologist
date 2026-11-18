import React from 'react';
import ReactDOM from 'react-dom';

interface ViewTypeDeletionMenuProps {
    x: number;
    y: number;
    label: string;
    onDelete: () => void;
    onClose: () => void;
    /** Opens the NeoJoin definition of the view type; the entry is hidden without it. */
    onEdit?: () => void;
    /** Build problems found in the definition of this view type. */
    problemCount?: number;
}

const EDIT_BUTTON_STYLE: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: '#0f172a',
    fontSize: 13,
    fontWeight: 500,
    padding: '6px 8px',
    borderRadius: 6,
    cursor: 'pointer',
    textAlign: 'left',
};

const BACKDROP_STYLE: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 999,
    background: 'transparent',
    border: 'none',
    cursor: 'default',
    padding: 0,
};

const MENU_STYLE: React.CSSProperties = {
    position: 'fixed',
    margin: 0,
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
};

const LABEL_STYLE: React.CSSProperties = {
    fontSize: 12,
    color: '#6b7280',
    padding: '4px 8px',
};

const DELETE_BUTTON_STYLE: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: '#dc2626',
    fontSize: 13,
    fontWeight: 500,
    padding: '6px 8px',
    borderRadius: 6,
    cursor: 'pointer',
    textAlign: 'left',
};

export const ViewTypeDeletionMenu: React.FC<ViewTypeDeletionMenuProps> = ({
    x, y, label, onDelete, onClose, onEdit, problemCount = 0,
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
            {problemCount > 0 && (
                <div style={{ ...LABEL_STYLE, color: '#dc2626' }}>
                    {problemCount === 1 ? '1 build problem' : `${problemCount} build problems`}
                </div>
            )}
            {onEdit && (
                <button
                    type="button"
                    style={EDIT_BUTTON_STYLE}
                    onClick={() => { onEdit(); onClose(); }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                >
                    Edit NeoJoin definition
                </button>
            )}
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