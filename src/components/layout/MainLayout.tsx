import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Header } from './Header';
import { FlowCanvas } from '../flow/FlowCanvas';
import { ToolsPanel } from '../ui/ToolsPanel';
import { parseEcoreFile, createSimpleEcoreDiagram } from '../../utils/ecoreParser';
import {
    exportFlowData,
    generateFlowId,
    saveDocumentMeta,
    saveDocumentData,
    StoredDocumentMeta,
} from '../../utils/flowUtils';
import { Node, Edge } from 'reactflow';
import { User } from '../../services/auth';

const ENABLE_RESIZE = false;   // <- keep false to prevent any user resizing
const HEADER_HEIGHT = 48;

interface MainLayoutProps {
    onDeploy?: (nodes: any[], edges: any[]) => void;
    onSave?: () => void;
    onLoad?: () => void;
    onNew?: () => void;
    user?: User | null;
    onLogout?: () => void;
    leftSidebar?: React.ReactNode;
    leftSidebarWidth?: number;
    rightSidebar?: React.ReactNode;
    rightSidebarWidth?: number;
    topRightSlot?: React.ReactNode;
    showWorkspaceInfo?: boolean;
    workspaceTopRightSlot?: React.ReactNode;
    workspaceOverlay?: React.ReactNode;
}

interface EcoreFileBox {
    id: string;
    fileName: string;
    fileContent: string;
    position: { x: number; y: number };
    description?: string;
    keywords?: string;
    domain?: string;
    createdAt?: string;
}

export function MainLayout({
                               onDeploy,
                               onSave,
                               onLoad,
                               onNew,
                               user,
                               onLogout,
                               leftSidebar,
                               leftSidebarWidth = 350,
                               rightSidebar,
                               rightSidebarWidth = 0,
                               topRightSlot,
                               showWorkspaceInfo = true,
                               workspaceTopRightSlot,
                               workspaceOverlay,
                           }: MainLayoutProps) {
    const location = useLocation();
    const isMMLRoute = location.pathname.startsWith('/mml');

    const [selectedDiagramType, setSelectedDiagramType] = useState<string | undefined>();
    const flowCanvasRef = useRef<any>(null);
    const leftAsideRef = useRef<HTMLDivElement | null>(null);
    const rightAsideRef = useRef<HTMLDivElement | null>(null);
    const isResizingLeft = useRef(false);
    const isResizingRight = useRef(false);

    // Active document state
    const [documents, setDocuments] = useState<StoredDocumentMeta[]>([]);
    const [activeDocId, setActiveDocId] = useState<string | undefined>(undefined);
    const [, setActiveFileName] = useState<string | undefined>(undefined);
    const [, setIsDirty] = useState(false);

    // ECORE file boxes in workspace
    const [ecoreFileBoxes, setEcoreFileBoxes] = useState<EcoreFileBox[]>([]);
    const [selectedFileBoxId, setSelectedFileBoxId] = useState<string | null>(null);

    // Start with an empty workspace
    useEffect(() => {
        if (flowCanvasRef.current?.loadDiagramData) {
            flowCanvasRef.current.loadDiagramData([], []);
        }
        try {
            localStorage.removeItem('vitruv.documents');
            const keys = Object.keys(localStorage);
            keys.forEach((key) => {
                if (key.startsWith('vitruv.document.data.')) localStorage.removeItem(key);
            });
        } catch {}
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // (Disabled when ENABLE_RESIZE === false)
    useEffect(() => {
        if (!ENABLE_RESIZE) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (isResizingLeft.current && leftAsideRef.current) {
                const min = 240;
                const max = 700;
                const next = Math.min(Math.max(e.clientX, min), max);
                leftAsideRef.current.style.width = `${next}px`;
            }
            if (isResizingRight.current && rightAsideRef.current) {
                const min = 260;
                const max = 700;
                const viewport = window.innerWidth;
                const next = Math.min(Math.max(viewport - e.clientX, min), max);
                rightAsideRef.current.style.width = `${next}px`;
            }
        };
        const handleMouseUp = () => {
            isResizingLeft.current = false;
            isResizingRight.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    // ---- helpers for ECORE boxes positioning ----
    const wouldOverlap = (
        existing: EcoreFileBox[],
        position: { x: number; y: number },
        boxWidth: number,
        boxHeight: number,
        spacing: number
    ) =>
        existing.some(
            (b) =>
                Math.abs(b.position.x - position.x) < boxWidth + spacing &&
                Math.abs(b.position.y - position.y) < boxHeight + spacing
        );

    const findFirstEmptyGridPosition = (
        existing: EcoreFileBox[],
        boxWidth: number,
        boxHeight: number,
        spacing: number
    ) => {
        const gridSize = boxWidth + spacing;
        let gridX = 100;
        let gridY = 100;

        while (gridY < 800) {
            while (gridX < 1200) {
                const pos = { x: gridX, y: gridY };
                if (!wouldOverlap(existing, pos, boxWidth, boxHeight, spacing)) return pos;
                gridX += gridSize;
            }
            gridX = 100;
            gridY += gridSize;
        }
        return { x: 100, y: 100 };
    };

    const calculateEmptyPosition = (existingBoxes: EcoreFileBox[]) => {
        if (existingBoxes.length === 0) return { x: 100, y: 100 };
        const boxWidth = 280;
        const boxHeight = 180;
        const spacing = 40;

        const rightmost = existingBoxes.reduce((r, b) => (b.position.x > r.position.x ? b : r));
        let newX = rightmost.position.x + boxWidth + spacing;
        let newY = rightmost.position.y;
        if (!wouldOverlap(existingBoxes, { x: newX, y: newY }, boxWidth, boxHeight, spacing)) {
            return { x: newX, y: newY };
        }
        newX = rightmost.position.x;
        newY = rightmost.position.y + boxHeight + spacing;
        if (!wouldOverlap(existingBoxes, { x: newX, y: newY }, boxWidth, boxHeight, spacing)) {
            return { x: newX, y: newY };
        }
        return findFirstEmptyGridPosition(existingBoxes, boxWidth, boxHeight, spacing);
    };

    // ---- ECORE file actions ----
    const handleEcoreFileUpload = (
        fileContent: string,
        meta?: { fileName?: string; description?: string; keywords?: string; domain?: string; createdAt?: string }
    ) => {
        const existing = ecoreFileBoxes.find((f) => f.fileName === meta?.fileName);
        if (existing) {
            setSelectedFileBoxId(existing.id);
            return;
        }

        if (flowCanvasRef.current?.loadDiagramData) flowCanvasRef.current.loadDiagramData([], []);
        if (flowCanvasRef.current?.resetExpandedFile) flowCanvasRef.current.resetExpandedFile();

        const pos = calculateEmptyPosition(ecoreFileBoxes);
        const newBox: EcoreFileBox = {
            id: `ecore-box-${Date.now()}`,
            fileName: meta?.fileName || 'untitled.ecore',
            fileContent,
            position: pos,
            description: meta?.description,
            keywords: meta?.keywords,
            domain: meta?.domain,
            createdAt: meta?.createdAt || new Date().toISOString(),
        };

        setEcoreFileBoxes((prev) => [...prev, newBox]);
        setSelectedFileBoxId(newBox.id);
    };

    const handleEcoreFileSelect = (fileName: string) => {
        const box = ecoreFileBoxes.find((f) => f.fileName === fileName);
        if (box) setSelectedFileBoxId(box.id);
    };

    const handleEcoreFileExpand = (fileName: string, fileContent: string) => {
        if (flowCanvasRef.current?.loadDiagramData) flowCanvasRef.current.loadDiagramData([], []);
        if (flowCanvasRef.current?.resetExpandedFile) flowCanvasRef.current.resetExpandedFile();

        let diagramData = parseEcoreFile(fileContent);
        if (diagramData.nodes.length === 1 && diagramData.nodes[0].data.label === 'Error parsing .ecore file') {
            diagramData = createSimpleEcoreDiagram(fileContent);
        }

        const newId = generateFlowId();
        const now = new Date().toISOString();
        const meta: StoredDocumentMeta = {
            id: newId,
            name: fileName,
            createdAt: now,
            updatedAt: now,
            sourceFileName: fileName,
        };
        saveDocumentMeta(meta);
        setDocuments((prev) => [meta, ...prev]);
        setActiveDocId(newId);
        setActiveFileName(fileName);

        flowCanvasRef.current?.loadDiagramData?.(diagramData.nodes, diagramData.edges);
        saveDocumentData(newId, { nodes: diagramData.nodes as any, edges: diagramData.edges as any });
        setIsDirty(false);
        setSelectedDiagramType('ecore');
    };

    const handleEcoreFilePositionChange = (id: string, pos: { x: number; y: number }) => {
        setEcoreFileBoxes((prev) => prev.map((b) => (b.id === id ? { ...b, position: pos } : b)));
    };

    const handleEcoreFileDelete = (id: string) => {
        setEcoreFileBoxes((prev) => prev.filter((b) => b.id !== id));
        if (selectedFileBoxId === id) setSelectedFileBoxId(null);
    };

    const handleEcoreFileDeleteFromPanel = (fileName: string) => {
        setEcoreFileBoxes((prev) => prev.filter((b) => b.fileName !== fileName));
        if (selectedFileBoxId) {
            const sel = ecoreFileBoxes.find((b) => b.id === selectedFileBoxId);
            if (sel && sel.fileName === fileName) setSelectedFileBoxId(null);
        }
    };

    const handleEcoreFileRename = (id: string, newName: string) => {
        setEcoreFileBoxes((prev) => prev.map((b) => (b.id === id ? { ...b, fileName: newName } : b)));
    };

    // ---- diagram save ----
    const handleDiagramChange = (_nodes: Node[], _edges: Edge[]) => {
        setIsDirty(true);
    };

    return (
        <div
            style={{
                width: '100vw',
                height: '100vh',
                display: 'flex',
                overflow: 'hidden',
            }}
        > 
            {/* Left sidebar (fixed width; no handle) */}
            <aside
                ref={leftAsideRef}
                style={{
                    width: leftSidebar ? leftSidebarWidth : 350,
                    flex: '0 0 auto',
                    background: '#ffffff',
                    borderRight: '1px solid #e0e0e0',
                    overflowY: 'auto',
                    position: 'relative',
                }}
            >
                {leftSidebar ?? (
                    <ToolsPanel onEcoreFileUpload={handleEcoreFileUpload} onEcoreFileDelete={handleEcoreFileDeleteFromPanel} />
                )}
                {/* Resize handle removed when ENABLE_RESIZE === false */}
                {ENABLE_RESIZE && (
                    <div
                        onMouseDown={(e) => {
                            isResizingLeft.current = true;
                            document.body.style.cursor = 'col-resize';
                            document.body.style.userSelect = 'none';
                            e.preventDefault();
                        }}
                        style={{ position: 'absolute', right: 0, top: 0, width: 8, height: '100%', cursor: 'col-resize' }}
                    />
                )}
            </aside>

            {/* Main column */}
            <div
                style={{
                    flexGrow: 1,
                    position: 'relative',
                    display: 'block',         // not flex; prevents flex jitter
                    minWidth: 0,
                    overflow: 'hidden',       // glue
                }}
            >
                <Header user={user} onLogout={onLogout} />

                {/* The canvas & overlays container (fills under header) */}
                <div
                    style={{
                        position: 'absolute',
                        top: HEADER_HEIGHT,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        overflow: 'hidden',
                    }}
                >
                    {/* Overlay bar like VsumTabs */}
                    {workspaceOverlay && (
                        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, zIndex: 20, pointerEvents: 'none' }}>
                            <div style={{ pointerEvents: 'auto' }}>{workspaceOverlay}</div>
                        </div>
                    )}

                    {/* Top-right slot above canvas */}
                    {topRightSlot && (
                        <div style={{ position: 'absolute', right: 16 + (rightSidebarWidth || 0), top: 8, zIndex: 24 }}>{topRightSlot}</div>
                    )}

                    {/* Workspace info */}
                    {showWorkspaceInfo && !isMMLRoute && (
                        <div style={{ position: 'absolute', left: 16, top: 8, zIndex: 25 }}>
                            <div
                                style={{
                                    background: '#ffffff',
                                    color: '#2c3e50',
                                    padding: '8px 12px',
                                    borderRadius: 10,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                                    border: '1px solid #e5e5e5',
                                    fontSize: '12px',
                                }}
                            >
                                <span style={{ color: '#34495e' }}>📁 Workspace</span>
                                <span style={{ color: '#7f8c8d' }}>•</span>
                                <span style={{ color: '#34495e' }}>{ecoreFileBoxes.length} ECORE files</span>
                                {ecoreFileBoxes.length > 0 && (
                                    <>
                                        <span style={{ color: '#7f8c8d' }}>•</span>
                                        <span style={{ color: '#34495e' }}>
                      {documents.filter((d) => d.sourceFileName).length} diagrams
                    </span>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Status indicator */}
                    {selectedDiagramType && (
                        <div
                            style={{
                                position: 'absolute',
                                left: 0,
                                right: 0,
                                top: 0,
                                transform: 'translateY(44px)',
                                background: '#e3f2fd',
                                borderBottom: '1px solid #2196f3',
                                padding: '8px 20px',
                                fontSize: '14px',
                                color: '#1976d2',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                zIndex: 10,
                            }}
                        >
              <span>
                🎯 Active:{' '}
                  {selectedDiagramType === 'class'
                      ? 'UML Class Diagram'
                      : selectedDiagramType === 'ecore'
                          ? 'Ecore Model'
                          : selectedDiagramType}{' '}
                  Tools
              </span>
                        </div>
                    )}

                    {/* FlowCanvas or Welcome */}
                    <div style={{ position: 'absolute', inset: 0 }}>
                        {isMMLRoute ? (
                            <div
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    background: '#ffffff',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '40px',
                                }}
                            >
                                <div style={{ textAlign: 'center', fontFamily: 'Georgia, serif', color: '#2c3e50', maxWidth: 600 }}>
                                    <div
                                        style={{
                                            width: 200,
                                            height: 200,
                                            margin: '0 auto 30px',
                                            overflow: 'hidden',
                                            borderRadius: 8,
                                            position: 'relative',
                                        }}
                                    >
                                        <img
                                            src="/assets/22098030.png"
                                            alt="Vitruvius"
                                            draggable={false}
                                            onDragStart={(e) => e.preventDefault()}
                                            style={{
                                                display: 'block',
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'contain',
                                                pointerEvents: 'none',
                                                userSelect: 'none',
                                            }}
                                        />
                                    </div>
                                    <p style={{ margin: '0 0 20px 0', fontSize: 16, color: '#6b7280', lineHeight: 1.6 }}>
                                        Methodological Dashboard
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <FlowCanvas
                                onDeploy={onDeploy}
                                onDiagramChange={handleDiagramChange}
                                ref={flowCanvasRef}
                                ecoreFiles={ecoreFileBoxes}
                                onEcoreFileSelect={handleEcoreFileSelect}
                                onEcoreFileExpand={handleEcoreFileExpand}
                                onEcoreFilePositionChange={handleEcoreFilePositionChange}
                                onEcoreFileDelete={handleEcoreFileDelete}
                                onEcoreFileRename={handleEcoreFileRename}
                            />
                        )}

                        {/* Workspace Top-Right slot (e.g., + ADD META MODELS) */}
                        {workspaceTopRightSlot && !isMMLRoute && (
                            <div style={{ position: 'absolute', right: 16, top: 12, zIndex: 30 }}>{workspaceTopRightSlot}</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Right sidebar (fixed width; handle hidden when disabled) */}
            {rightSidebar && (
                <aside
                    ref={rightAsideRef}
                    style={{
                        width: rightSidebarWidth,
                        flex: '0 0 auto',
                        borderLeft: '1px solid #e0e0e0',
                        background: '#ffffff',
                        overflowY: 'auto',
                        position: 'relative',
                    }}
                >
                    {ENABLE_RESIZE && (
                        <div
                            onMouseDown={(e) => {
                                isResizingRight.current = true;
                                document.body.style.cursor = 'col-resize';
                                document.body.style.userSelect = 'none';
                                e.preventDefault();
                            }}
                            style={{ position: 'absolute', left: 0, top: 0, width: 8, height: '100%', cursor: 'col-resize' }}
                        />
                    )}
                    <div style={{ height: '100%' }}>{rightSidebar}</div>
                </aside>
            )}
        </div>
    );
}