import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { ViewTypeScope } from '../../../hooks/useViewTypes';
import { Node } from 'reactflow';

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

const MENU_STYLE: React.CSSProperties = {
    position: 'fixed',
    margin: 0,
    zIndex: 1000,
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
    padding: '12px 16px',
    minWidth: 240,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
};

const INPUT_STYLE: React.CSSProperties = {
    border: '1px solid #d1d5db',
    borderRadius: 6,
    padding: '6px 10px',
    fontSize: 13,
    outline: 'none',
};

const NODE_LIST_STYLE: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    maxHeight: 160,
    overflowY: 'auto',
};

function getScopeButtonStyle(scope: ViewTypeScope, current: ViewTypeScope): React.CSSProperties {
    const isActive = scope === current;
    let background = 'white';
    let color = '#374151';
    if (isActive) {
        background = scope === 'single' ? '#fef9c3' : '#fee2e2';
        color = scope === 'single' ? '#92400e' : '#991b1b';
    }
    return {
        flex: 1,
        padding: '5px 0',
        borderRadius: 6,
        border: isActive ? '2px solid #374151' : '1px solid #d1d5db',
        background,
        fontSize: 12,
        cursor: 'pointer',
        fontWeight: isActive ? 600 : 400,
        color,
    };
}

function getNodeItemStyle(isSelected: boolean): React.CSSProperties {
    return {
        padding: '6px 10px',
        borderRadius: 6,
        border: isSelected ? '2px solid #374151' : '1px solid #e5e7eb',
        background: isSelected ? '#f3f4f6' : 'white',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: isSelected ? 600 : 400,
        color: '#374151',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        textAlign: 'left',
    };
}

function getAddButtonStyle(disabled: boolean): React.CSSProperties {
    return {
        background: disabled ? '#d1d5db' : '#374151',
        color: 'white',
        border: 'none',
        borderRadius: 6,
        padding: '7px 0',
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
    };
}

export const ViewTypeContextMenu: React.FC<ViewTypeContextMenuProps> = ({
    x, y, ecoreNodes, onAdd, onClose,
}) => {
    const [label, setLabel] = useState('');
    const [scope, setScope] = useState<ViewTypeScope>('single');
    const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
    const [editable, setEditable] = useState(false);

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
                style={{ ...MENU_STYLE, left: x, top: y }}
            >
                <div style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>
                    Add View Type
                </div>

                <input
                    autoFocus
                    placeholder="Label (e.g. VT1)"
                    value={label}
                    onChange={e => setLabel(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                    style={INPUT_STYLE}
                />

                <div style={{ display: 'flex', gap: 8 }}>
                    {(['single', 'multi'] as ViewTypeScope[]).map(s => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => handleScopeChange(s)}
                            style={getScopeButtonStyle(s, scope)}
                        >
                            {s === 'single' ? '● Single' : '◎ Multi'}
                        </button>
                    ))}
                </div>

                <label
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        cursor: 'pointer',
                        fontSize: 13,
                        color: '#374151',
                        userSelect: 'none',
                    }}
                >
                    <input
                        type="checkbox"
                        checked={editable}
                        onChange={e => setEditable(e.target.checked)}
                        style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#374151' }}
                    />
                    {' '}Editable
                </label>

                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: -4 }}>
                    {scope === 'single' ? 'Select metamodel:' : 'Select metamodels:'}
                </div>

                <div style={NODE_LIST_STYLE}>
                    {ecoreNodes.length === 0 && (
                        <div style={{ fontSize: 12, color: '#9ca3af', padding: '4px 0' }}>
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
                                style={getNodeItemStyle(isSelected)}
                            >
                                <span style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    background: isSelected ? '#374151' : '#d1d5db',
                                    flexShrink: 0,
                                }} />
                                {node.data?.fileName ?? node.id}
                            </button>
                        );
                    })}
                </div>

                <button
                    type="button"
                    onClick={handleAdd}
                    disabled={isDisabled}
                    style={getAddButtonStyle(isDisabled)}
                >
                    Add
                </button>
            </dialog>
        </>,
        document.body
    );
};