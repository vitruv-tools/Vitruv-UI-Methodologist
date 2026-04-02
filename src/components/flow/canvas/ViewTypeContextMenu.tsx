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

    return ReactDOM.createPortal(
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
                    padding: '12px 16px',
                    minWidth: 240,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>
                    Add View Type
                </div>

                <input
                    autoFocus
                    placeholder="Label (e.g. VT1)"
                    value={label}
                    onChange={e => setLabel(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    style={{
                        border: '1px solid #d1d5db',
                        borderRadius: 6,
                        padding: '6px 10px',
                        fontSize: 13,
                        outline: 'none',
                    }}
                />

                {/* Scope toggle */}
                <div style={{ display: 'flex', gap: 8 }}>
                    {(['single', 'multi'] as ViewTypeScope[]).map(s => (
                        <button
                            key={s}
                            onClick={() => handleScopeChange(s)}
                            style={{
                                flex: 1,
                                padding: '5px 0',
                                borderRadius: 6,
                                border: scope === s ? '2px solid #374151' : '1px solid #d1d5db',
                                background: scope === s
                                    ? (s === 'single' ? '#fef9c3' : '#fee2e2')
                                    : 'white',
                                fontSize: 12,
                                cursor: 'pointer',
                                fontWeight: scope === s ? 600 : 400,
                                color: scope === s
                                    ? (s === 'single' ? '#92400e' : '#991b1b')
                                    : '#374151',
                            }}
                        >
                            {s === 'single' ? '● Single' : '◎ Multi'}
                        </button>
                    ))}
                </div>

                {/* Editable checkbox */}
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
                    Editable
                </label>

                {/* Node selection */}
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: -4 }}>
                    {scope === 'single' ? 'Select metamodel:' : 'Select metamodels:'}
                </div>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    maxHeight: 160,
                    overflowY: 'auto',
                }}>
                    {ecoreNodes.length === 0 && (
                        <div style={{ fontSize: 12, color: '#9ca3af', padding: '4px 0' }}>
                            No metamodel nodes on canvas
                        </div>
                    )}
                    {ecoreNodes.map(node => {
                        const isSelected = selectedNodeIds.includes(node.id);
                        return (
                            <div
                                key={node.id}
                                onClick={() => toggleNode(node.id)}
                                style={{
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
                                }}
                            >
                                <span style={{
                                    width: 8, height: 8, borderRadius: '50%',
                                    background: isSelected ? '#374151' : '#d1d5db',
                                    flexShrink: 0,
                                }} />
                                {node.data?.fileName ?? node.id}
                            </div>
                        );
                    })}
                </div>

                <button
                    onClick={handleAdd}
                    disabled={!label.trim() || selectedNodeIds.length === 0}
                    style={{
                        background: (!label.trim() || selectedNodeIds.length === 0) ? '#d1d5db' : '#374151',
                        color: 'white',
                        border: 'none',
                        borderRadius: 6,
                        padding: '7px 0',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: (!label.trim() || selectedNodeIds.length === 0) ? 'not-allowed' : 'pointer',
                    }}
                >
                    Add
                </button>
            </div>
        </>,
        document.body
    );
};