import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Header } from './Header';
import { FlowCanvas } from '../flow/FlowCanvas';
import { ToolsPanel } from '../ui/ToolsPanel';
import { parseEcoreFile, createSimpleEcoreDiagram } from '../../utils/ecoreParser';
import {
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
    showWelcomeScreen?: boolean;
    welcomeTitle?: string;
    welcomeSubtitle?: string;
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
    showWelcomeScreen = false,
    welcomeTitle,
    welcomeSubtitle,
}: MainLayoutProps) {
    const location = useLocation();
    const isMMLRoute = location.pathname.startsWith('/mml');

    const flowCanvasRef = useRef<any>(null);
    const leftAsideRef = useRef<HTMLDivElement | null>(null);
    const rightAsideRef = useRef<HTMLDivElement | null>(null);
    const isResizingLeft = useRef(false);
    const isResizingRight = useRef(false);

    // Active document state
    const [documents, setDocuments] = useState<StoredDocumentMeta[]>([]);
    const [, setActiveDocId] = useState<string | undefined>(undefined);
    const [, setActiveFileName] = useState<string | undefined>(undefined);
    const [, setIsDirty] = useState(false);

    // ECORE file boxes in workspace
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
        } catch { }
        // run once on mount
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

    // calculateEmptyPosition als useCallback (stabil)
    const calculateEmptyPosition = useCallback(() => {
        const ecoreNodes = flowCanvasRef.current?.getNodes?.()?.filter(
            (n: any) => n.type === 'ecoreFile'
        ) || [];

        if (ecoreNodes.length === 0) return { x: 100, y: 100 };

        const boxWidth = 280;
        const boxHeight = 180;
        const spacing = 40;

        // find rightmost node; if reduce on empty array would throw but we already guarded length
        const rightmost = ecoreNodes.reduce((r: any, b: any) =>
            (b.position.x > r.position.x ? b : r)
        );

        // try to place to the right
        let newX = rightmost.position.x + boxWidth + spacing;
        let newY = rightmost.position.y;

        const wouldOverlap = ecoreNodes.some((node: any) =>
            Math.abs(node.position.x - newX) < boxWidth + spacing &&
            Math.abs(node.position.y - newY) < boxHeight + spacing
        );

        if (!wouldOverlap) {
            return { x: newX, y: newY };
        }

        // otherwise below
        newX = rightmost.position.x;
        newY = rightmost.position.y + boxHeight + spacing;

        return { x: newX, y: newY };
    }, []); // Ref is stable, no other deps

    // handleEcoreFileUpload als useCallback (stabil)
    const handleEcoreFileUpload = useCallback((
        fileContent: string,
        meta?: { fileName?: string; description?: string; keywords?: string; domain?: string; createdAt?: string }
    ) => {
        // Prüfe ob File bereits existiert
        const existingNodes = flowCanvasRef.current?.getNodes?.() || [];
        const existing = existingNodes.find(
            (n: any) => n.type === 'ecoreFile' && n.data.fileName === meta?.fileName
        );

        if (existing) {
            setSelectedFileBoxId(existing.id);
            return;
        }

        // Clear canvas für neues File
        if (flowCanvasRef.current?.loadDiagramData) {
            flowCanvasRef.current.loadDiagramData([], []);
        }
        if (flowCanvasRef.current?.resetExpandedFile) {
            flowCanvasRef.current.resetExpandedFile();
        }

        // Berechne Position für neue Box
        const position = calculateEmptyPosition();

        // Erstelle das File über FlowCanvas's addEcoreFile
        if (flowCanvasRef.current?.addEcoreFile) {
            flowCanvasRef.current.addEcoreFile(
                meta?.fileName || 'untitled.ecore',
                fileContent,
                {
                    ...meta,
                    position,
                }
            );
        }
    }, [calculateEmptyPosition]);

    // Listen for add file to workspace events
    useEffect(() => {
        const handleAddFileToWorkspace = (e: Event) => {
            const customEvent = e as CustomEvent<{
                fileContent: string;
                fileName: string;
                description?: string;
                keywords?: string;
                domain?: string;
                createdAt?: string;
            }>;
            const detail = customEvent.detail;
            if (detail) {
                handleEcoreFileUpload(detail.fileContent, {
                    fileName: detail.fileName,
                    description: detail.description,
                    keywords: detail.keywords,
                    domain: detail.domain,
                    createdAt: detail.createdAt,
                });
            }
        };

        window.addEventListener('vitruv.addFileToWorkspace', handleAddFileToWorkspace as EventListener);
        return () => window.removeEventListener('vitruv.addFileToWorkspace', handleAddFileToWorkspace as EventListener);
    }, [handleEcoreFileUpload]); // handleEcoreFileUpload ist stabil (useCallback)

    const handleEcoreFileSelect = useCallback((fileName: string) => {
        const nodes = flowCanvasRef.current?.getNodes?.() || [];
        const ecoreNode = nodes.find(
            (n: any) => n.type === 'ecoreFile' && n.data.fileName === fileName
        );
        if (ecoreNode) {
            setSelectedFileBoxId(ecoreNode.id);
        }
    }, []);

    const handleEcoreFileExpand = useCallback((fileName: string, fileContent: string) => {
        // Clear current diagram
        if (flowCanvasRef.current?.loadDiagramData) {
            flowCanvasRef.current.loadDiagramData([], []);
        }
        if (flowCanvasRef.current?.resetExpandedFile) {
            flowCanvasRef.current.resetExpandedFile();
        }

        // Parse Ecore file
        let diagramData = parseEcoreFile(fileContent);
        if (diagramData.nodes.length === 1 && diagramData.nodes[0].data.label === 'Error parsing .ecore file') {
            diagramData = createSimpleEcoreDiagram(fileContent);
        }

        // Save as document
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

        // Load parsed diagram
        flowCanvasRef.current?.loadDiagramData?.(diagramData.nodes, diagramData.edges);
        saveDocumentData(newId, { nodes: diagramData.nodes as any, edges: diagramData.edges as any });
        setIsDirty(false);

        // Update selected file
        const nodes = flowCanvasRef.current?.getNodes?.() || [];
        const ecoreNode = nodes.find(
            (n: any) => n.type === 'ecoreFile' && n.data.fileName === fileName
        );
        if (ecoreNode) {
            setSelectedFileBoxId(ecoreNode.id);
        }
    }, [setDocuments]);

    const handleEcoreFileDelete = useCallback((id: string) => {
        // Remove Node from FlowCanvas
        const currentNodes = flowCanvasRef.current?.getNodes?.() || [];
        const updatedNodes = currentNodes.filter((n: any) => n.id !== id);

        if (flowCanvasRef.current?.loadDiagramData) {
            const edges = flowCanvasRef.current?.getEdges?.() || [];
            flowCanvasRef.current.loadDiagramData(updatedNodes, edges);
        }

        // Clear selection if deleted
        if (selectedFileBoxId === id) {
            setSelectedFileBoxId(null);
        }
    }, [selectedFileBoxId]);

    const handleEcoreFileDeleteFromPanel = useCallback((fileName: string) => {
        const currentNodes = flowCanvasRef.current?.getNodes?.() || [];
        const nodeToDelete = currentNodes.find(
            (n: any) => n.type === 'ecoreFile' && n.data.fileName === fileName
        );

        if (nodeToDelete) {
            handleEcoreFileDelete(nodeToDelete.id);
        }
    }, [handleEcoreFileDelete]);

    const handleEcoreFileRename = useCallback((id: string, newName: string) => {
        const currentNodes = flowCanvasRef.current?.getNodes?.() || [];
        const updatedNodes = currentNodes.map((n: any) =>
            n.id === id && n.type === 'ecoreFile'
                ? { ...n, data: { ...n.data, fileName: newName } }
                : n
        );

        if (flowCanvasRef.current?.loadDiagramData) {
            const edges = flowCanvasRef.current?.getEdges?.() || [];
            flowCanvasRef.current.loadDiagramData(updatedNodes, edges);
        }
    }, []);

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
                                <span style={{ color: '#34495e' }}>
                                    {flowCanvasRef.current?.getNodes?.()?.filter((n: any) => n.type === 'ecoreFile').length || 0} ECORE files
                                </span>
                                {(flowCanvasRef.current?.getNodes?.()?.filter((n: any) => n.type === 'ecoreFile').length || 0) > 0 && (
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

                    {/* FlowCanvas or Welcome */}
                    <div style={{ position: 'absolute', inset: 0 }}>
                        {isMMLRoute || showWelcomeScreen ? (
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
                                        {welcomeTitle || 'Methodological Dashboard'}
                                    </p>
                                    {welcomeSubtitle && (
                                        <p style={{ margin: '0', fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>
                                            {welcomeSubtitle}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <FlowCanvas
                                onDeploy={onDeploy}
                                onDiagramChange={handleDiagramChange}
                                ref={flowCanvasRef}
                                // ecoreFiles prop entfernt - Nodes sind jetzt Teil von FlowCanvas State
                                onEcoreFileSelect={handleEcoreFileSelect}
                                onEcoreFileExpand={handleEcoreFileExpand}
                                // onEcoreFilePositionChange removed - ReactFlow handles position
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
