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

const PRIMARY = '#049484';
const PRIMARY_DARK = '#037368';
const TEXT = '#2c3e50';
const MUTED = '#6b7280';
const FONT = 'Georgia, serif';

const SCOPE_SINGLE = '#E8A838';
const SCOPE_MULTI = '#A81C1C';

const BACKDROP_STYLE: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 999,
    background: 'rgba(0, 0, 0, 0.25)',
    backdropFilter: 'blur(2px)',
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
    borderRadius: 12,
    boxShadow: '0 20px 60px rgba(4, 148, 132, 0.15), 0 10px 30px rgba(0, 0, 0, 0.1)',
    minWidth: 280,
    maxWidth: 320,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    fontFamily: FONT,
};

const HEADER_STYLE: React.CSSProperties = {
    padding: '16px 20px',
    borderBottom: `2px solid ${PRIMARY}`,
    background: 'linear-gradient(135deg, #f8fcff 0%, #e8f4f8 100%)',
    fontWeight: 700,
    fontSize: 16,
    color: TEXT,
    letterSpacing: '0.01em',
};

const BODY_STYLE: React.CSSProperties = {
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
};

const INPUT_STYLE: React.CSSProperties = {
    border: '1px solid #dee2e6',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 14,
    fontFamily: FONT,
    color: TEXT,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
};

const NODE_LIST_STYLE: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    maxHeight: 160,
    overflowY: 'auto',
};

function getScopeButtonStyle(scope: ViewTypeScope, current: ViewTypeScope): React.CSSProperties {
    const isActive = scope === current;
    const accent = scope === 'single' ? SCOPE_SINGLE : SCOPE_MULTI;
    const activeBg = scope === 'single' ? '#fef9c3' : '#fee2e2';
    const activeText = scope === 'single' ? '#92400e' : '#991b1b';

    return {
        flex: 1,
        padding: '8px 0',
        borderRadius: 8,
        border: isActive ? `2px solid ${accent}` : '1px solid #dee2e6',
        background: isActive ? activeBg : '#ffffff',
        fontSize: 13,
        fontFamily: FONT,
        cursor: 'pointer',
        fontWeight: isActive ? 700 : 500,
        color: isActive ? activeText : MUTED,
        transition: 'all 0.2s ease',
    };
}

function getNodeItemStyle(isSelected: boolean): React.CSSProperties {
    return {
        padding: '8px 12px',
        borderRadius: 8,
        border: isSelected ? `2px solid ${PRIMARY}` : '1px solid #e5e7eb',
        background: isSelected ? '#e8f4f8' : '#ffffff',
        cursor: 'pointer',
        fontSize: 13,
        fontFamily: FONT,
        fontWeight: isSelected ? 600 : 400,
        color: isSelected ? PRIMARY_DARK : TEXT,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        textAlign: 'left',
        transition: 'all 0.2s ease',
    };
}

function getAddButtonStyle(disabled: boolean): React.CSSProperties {
    return {
        background: disabled
            ? '#a5d6d3'
            : `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%)`,
        color: '#ffffff',
        border: 'none',
        borderRadius: 8,
        padding: '10px 0',
        fontSize: 14,
        fontFamily: FONT,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: disabled ? 'none' : '0 2px 8px rgba(4, 148, 132, 0.3)',
        transition: 'all 0.2s ease',
    };
}

export const ViewTypeContextMenu: React.FC<ViewTypeContextMenuProps> = ({
    x, y, ecoreNodes, onAdd, onClose,
}) => {
    const [label, setLabel] = useState('');
    const [scope, setScope] = useState<ViewTypeScope>('single');
    const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
    const [editable, setEditable] = useState(false);
    const [inputFocused, setInputFocused] = useState(false);

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

    const clampedX = Math.min(x, window.innerWidth - 300);
    const clampedY = Math.min(y, window.innerHeight - 420);

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
                style={{ ...MENU_STYLE, left: clampedX, top: clampedY }}
            >
                <div style={HEADER_STYLE} role="heading" aria-level={2}>
                    Add View Type
                </div>

                <div style={BODY_STYLE}>
                    <input
                        autoFocus
                        placeholder="Label (e.g. VT1)"
                        value={label}
                        onChange={e => setLabel(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                        onFocus={() => setInputFocused(true)}
                        onBlur={() => setInputFocused(false)}
                        style={{
                            ...INPUT_STYLE,
                            borderColor: inputFocused ? PRIMARY : '#dee2e6',
                            boxShadow: inputFocused ? '0 0 0 3px rgba(4, 148, 132, 0.15)' : 'none',
                        }}
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
                            fontFamily: FONT,
                            color: TEXT,
                            userSelect: 'none',
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={editable}
                            onChange={e => setEditable(e.target.checked)}
                            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: PRIMARY }}
                        />
                        Editable
                    </label>

                    <div style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>
                        {scope === 'single' ? 'Select metamodel:' : 'Select metamodels:'}
                    </div>

                    <div style={NODE_LIST_STYLE}>
                        {ecoreNodes.length === 0 && (
                            <div style={{ fontSize: 13, color: '#9ca3af', padding: '8px 0', fontFamily: FONT }}>
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
                                        background: isSelected ? PRIMARY : '#d1d5db',
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
                </div>
            </dialog>
        </>,
        document.body
    );
};
