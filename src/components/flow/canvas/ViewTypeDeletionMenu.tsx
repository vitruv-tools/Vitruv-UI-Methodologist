import React from 'react';
import ReactDOM from 'react-dom';
import { useAnchoredMenuPosition } from './viewTypeMenuPosition';
import './viewTypeMenu.css';

interface ViewTypeDeletionMenuProps {
    x: number;
    y: number;
    label: string;
    onDelete: () => void;
    onEditQuery?: () => void;
    onClose: () => void;
}

const BACKDROP_STYLE: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 999,
    background: 'transparent',
    border: 'none',
    cursor: 'default',
    padding: 0,
};


export const ViewTypeDeletionMenu: React.FC<ViewTypeDeletionMenuProps> = ({
    x, y, label, onDelete, onEditQuery, onClose,
}) => {
    const { ref: menuRef, style: menuStyle } = useAnchoredMenuPosition<HTMLDialogElement>(x, y);
    return ReactDOM.createPortal(
    <>
        <button
            type="button"
            aria-label="Close menu"
            style={BACKDROP_STYLE}
            onClick={onClose}
        />
        <dialog
            open
            ref={menuRef}
            className="view-type-menu view-type-menu--compact"
            style={menuStyle}
        >
            <div className="view-type-menu__header">
                <div className="view-type-menu__label">
                    {label}
                </div>
                <button
                    type="button"
                    className="view-type-menu__close"
                    aria-label="Close"
                    onClick={onClose}
                >
                    ×
                </button>
            </div>
            {onEditQuery && (
                <button
                    type="button"
                    className="view-type-menu__action"
                    onClick={() => { onEditQuery(); onClose(); }}
                >
                    Edit query
                </button>
            )}
            <button
                type="button"
                className="view-type-menu__action view-type-menu__action--danger"
                onClick={() => { onDelete(); onClose(); }}
            >
                Delete view type
            </button>
        </dialog>
    </>,
    document.body
    );
};