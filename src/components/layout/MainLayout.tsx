import React, { useEffect, useRef, useState } from 'react';
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
        } catch { }
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
    console.log('🎯 calculateEmptyPosition called');
    console.log('📦 Existing boxes:', existingBoxes.length);
    console.log('📦 Existing boxes array:', existingBoxes);
    
    if (existingBoxes.length === 0) {
        console.log('✨ First box - returning (100, 100)');
        return { x: 100, y: 100 };
    }
    
    const boxWidth = 280;
    const boxHeight = 180;
    const spacing = 40;

    // Nimm die letzte Box (nicht die rechteste!)
    const lastBox = existingBoxes[existingBoxes.length - 1];
    console.log('📍 Last box position:', lastBox.position);
    
    // Berechne neue Position rechts daneben
    let newX = lastBox.position.x + boxWidth + spacing;
    let newY = lastBox.position.y;
    console.log('🔢 Calculated newX:', newX, 'newY:', newY);
    
    // Prüfe ob zu weit rechts (Fensterbreite check)
    const maxX = window.innerWidth - 400;
    console.log('📏 Window width:', window.innerWidth, 'maxX:', maxX);
    
    if (newX > maxX) {
        // Neue Zeile: Ganz links, eine Zeile tiefer
        newX = 100;
        newY = lastBox.position.y + boxHeight + spacing;
        console.log('🔄 Wrapping to new row:', newX, newY);
    }
    
    // Optional: Collision-Check mit allen existierenden Boxen
    const wouldOverlap = existingBoxes.some(box => 
        Math.abs(box.position.x - newX) < boxWidth + spacing &&
        Math.abs(box.position.y - newY) < boxHeight + spacing
    );
    
    console.log('💥 Would overlap?', wouldOverlap);
    
    if (wouldOverlap) {
        // Fallback: Nutze Grid-Search
        console.log('⚠️ Using fallback grid search');
        return findFirstEmptyGridPosition(existingBoxes, boxWidth, boxHeight, spacing);
    }
    
    console.log('✅ Final position:', { x: newX, y: newY });
    return { x: newX, y: newY };
};

    // ---- ECORE file actions ----
    const handleEcoreFileUpload = (
    fileContent: string,
    meta?: { fileName?: string; description?: string; keywords?: string; domain?: string; createdAt?: string }
) => {
    console.log('📤 handleEcoreFileUpload called');
    console.log('📄 File name:', meta?.fileName);
    
    // ✅ WICHTIG: Nutze functional update, um auf den aktuellen State zuzugreifen
    setEcoreFileBoxes((prevBoxes) => {
        console.log('📦 Current boxes before adding:', prevBoxes.length);
        
        const existing = prevBoxes.find((f) => f.fileName === meta?.fileName);
        if (existing) {
            setSelectedFileBoxId(existing.id);
            console.log('⚠️ File already exists:', meta?.fileName);
            return prevBoxes; // Keine Änderung
        }

        if (flowCanvasRef.current?.loadDiagramData) flowCanvasRef.current.loadDiagramData([], []);
        if (flowCanvasRef.current?.resetExpandedFile) flowCanvasRef.current.resetExpandedFile();

        // ✅ Berechne Position basierend auf dem AKTUELLEN State (prevBoxes)
        const pos = calculateEmptyPosition(prevBoxes);
        console.log('🎯 New box will be placed at:', pos);
        
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

        console.log('📦 New box created:', newBox);
        setSelectedFileBoxId(newBox.id);
        
        // ✅ Return das neue Array mit der neuen Box
        return [...prevBoxes, newBox];
    });
};
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
                                ecoreFiles={ecoreFileBoxes}
                                onEcoreFileSelect={handleEcoreFileSelect}
                                onEcoreFileExpand={handleEcoreFileExpand}
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