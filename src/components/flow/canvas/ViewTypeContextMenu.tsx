import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { ViewTypeScope } from '../../../hooks/useViewTypes';
import { Node } from 'reactflow';
import { useAnchoredMenuPosition } from './viewTypeMenuPosition';
import './viewTypeMenu.css';

interface ViewTypeContextMenuProps {
    x: number;
    y: number;
    ecoreNodes: Node[];
    onAdd: (label: string, scope: ViewTypeScope, linkedNodeIds: string[], editable: boolean) => void;
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

export const ViewTypeContextMenu: React.FC<ViewTypeContextMenuProps> = ({
    x, y, ecoreNodes, onAdd, onClose,
}) => {
    const [label, setLabel] = useState('');
    const labelInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        labelInputRef.current?.focus();
    }, []);
    const [scope, setScope] = useState<ViewTypeScope>('single');
    const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
    const [editable, setEditable] = useState(false);
    const { ref: menuRef, style: menuStyle } = useAnchoredMenuPosition<HTMLDialogElement>(x, y, ecoreNodes.length);

    const toggleNode = (nodeId: string) => {
        if (scope === 'single') {
            setSelectedNodeIds([nodeId]);
        } else {
            setSelectedNodeIds(prev =>
                prev.includes(nodeId) ? prev.filter(id => id !== nodeId) : [...prev, nodeId]
            );
        }
    };

    const handleScopeChange = (s: ViewTypeScope) => {
        setScope(s);
        setSelectedNodeIds([]);
    };

    const handleAdd = () => {
        if (!label.trim() || selectedNodeIds.length === 0) return;
        onAdd(label.trim(), scope, selectedNodeIds, editable);
        onClose();
    };

    const isDisabled = !label.trim() || selectedNodeIds.length === 0;

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
                className="view-type-menu"
                style={menuStyle}
            >
                <div className="view-type-menu__header">
                    <div className="view-type-menu__title">
                        Add View Type
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

                <input
                    ref={labelInputRef}
                    className="view-type-menu__input"
                    placeholder="Label (e.g. VT1)"
                    value={label}
                    onChange={e => setLabel(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                />

                <div className="view-type-menu__scopes">
                    {(['single', 'multi'] as ViewTypeScope[]).map(s => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => handleScopeChange(s)}
                            className={[
                                'view-type-menu__scope',
                                `view-type-menu__scope--${s}`,
                                scope === s ? 'view-type-menu__scope--active' : '',
                            ].filter(Boolean).join(' ')}
                        >
                            {s === 'single' ? '● Single' : '◎ Multi'}
                        </button>
                    ))}
                </div>

                <label className="view-type-menu__check">
                    <input
                        type="checkbox"
                        checked={editable}
                        onChange={e => setEditable(e.target.checked)}
                    />
                    {' '}Editable
                </label>

                <div className="view-type-menu__hint">
                    {scope === 'single' ? 'Select metamodel:' : 'Select metamodels:'}
                </div>

                <div className="view-type-menu__nodes">
                    {ecoreNodes.length === 0 && (
                        <div className="view-type-menu__empty">
                            No metamodel nodes on canvas
                        </div>
                    )}
                    {ecoreNodes.map(node => {
                        const isSelected = selectedNodeIds.includes(node.id);
                        return (
                            <button
                                key={node.id}
                                type="button"
                                onClick={() => toggleNode(node.id)}
                                className={isSelected
                                    ? 'view-type-menu__node view-type-menu__node--selected'
                                    : 'view-type-menu__node'}
                            >
                                <span className="view-type-menu__dot" />
                                {node.data?.displayName ?? node.data?.fileName ?? node.id}
                                {typeof node.data?.version === 'string' && node.data.version.trim()
                                  ? ` (${node.data.version.trim()})`
                                  : ''}
                            </button>
                        );
                    })}
                </div>

                <button
                    type="button"
                    onClick={handleAdd}
                    disabled={isDisabled}
                    className="view-type-menu__add"
                >
                    Add
                </button>
            </dialog>
        </>,
        document.body
    );
};