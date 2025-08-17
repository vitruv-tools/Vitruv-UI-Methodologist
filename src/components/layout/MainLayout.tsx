import React, { useEffect, useState, useRef } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { FlowCanvas } from '../flow/FlowCanvas';
import { ToolsPanel } from '../ui/ToolsPanel';
import { parseEcoreFile, createSimpleEcoreDiagram } from '../../utils/ecoreParser';
import { exportFlowData, importFlowData, generateFlowId, listDocuments, saveDocumentMeta, loadDocumentData, saveDocumentData, StoredDocumentMeta } from '../../utils/flowUtils';
import { Node, Edge } from 'reactflow';

interface MainLayoutProps {
  onDeploy?: (nodes: any[], edges: any[]) => void;
  onSave?: () => void;
  onLoad?: () => void;
  onNew?: () => void;
  user?: {
    name: string;
    email?: string;
  };
  onLogout?: () => void;
}

export function MainLayout({ onDeploy, onSave, onLoad, onNew, user, onLogout }: MainLayoutProps) {
  const [selectedDiagramType, setSelectedDiagramType] = useState<string | undefined>();
  const [showToolsPanel, setShowToolsPanel] = useState(false);
  const flowCanvasRef = useRef<any>(null);

  // Active document state (single open doc in workspace)
  const [documents, setDocuments] = useState<StoredDocumentMeta[]>(() => listDocuments());
  const [activeDocId, setActiveDocId] = useState<string | undefined>(documents[0]?.id);
  const [activeFileName, setActiveFileName] = useState<string | undefined>(documents[0]?.name);
  const [isDirty, setIsDirty] = useState(false);

  // Load initial document if present
  useEffect(() => {
    if (activeDocId) {
      const data = loadDocumentData(activeDocId);
      if (data && flowCanvasRef.current?.loadDiagramData) {
        const restored = importFlowData(data);
        flowCanvasRef.current.loadDiagramData(restored.nodes as any, restored.edges as any);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDiagramSelection = (diagramType: string) => {
    console.log('Diagram selected:', diagramType);
    setSelectedDiagramType(diagramType);
    setShowToolsPanel(true);
  };

  const handleCloseToolsPanel = () => {
    console.log('Closing tools panel');
    setShowToolsPanel(false);
    setSelectedDiagramType(undefined);
  };

  const handleToolClick = (toolType: string, toolName: string, diagramType?: string) => {
    console.log('Tool clicked:', { toolType, toolName, diagramType });
    // Call the FlowCanvas tool click handler
    if (flowCanvasRef.current && flowCanvasRef.current.handleToolClick) {
      flowCanvasRef.current.handleToolClick(toolType, toolName, diagramType);
    }
  };

  const handleEcoreFileUpload = (fileContent: string, meta?: { fileName?: string }) => {
    console.log('Processing .ecore file upload');
    
    try {
      // Try to parse the .ecore file
      let diagramData = parseEcoreFile(fileContent);
      
      // If parsing fails, create a simple diagram
      if (diagramData.nodes.length === 1 && diagramData.nodes[0].data.label === 'Error parsing .ecore file') {
        console.log('XML parsing failed, creating simple diagram');
        diagramData = createSimpleEcoreDiagram(fileContent);
      }
      
      // Create or switch active document for this upload
      const newId = generateFlowId();
      const name = meta?.fileName || 'untitled.ecore';
      const now = new Date().toISOString();
      const newMeta: StoredDocumentMeta = { id: newId, name, createdAt: now, updatedAt: now, sourceFileName: meta?.fileName };
      saveDocumentMeta(newMeta);
      setDocuments(prev => [newMeta, ...prev]);
      setActiveDocId(newId);
      setActiveFileName(name);

      // Load into canvas
      if (flowCanvasRef.current && flowCanvasRef.current.loadDiagramData) {
        flowCanvasRef.current.loadDiagramData(diagramData.nodes, diagramData.edges);
      }
      // Persist diagram data immediately
      saveDocumentData(newId, { nodes: diagramData.nodes as any, edges: diagramData.edges as any });
      setIsDirty(false);
      
      // Set diagram type to 'ecore' and show tools panel
      setSelectedDiagramType('ecore');
      setShowToolsPanel(true);
      
      console.log('Ecore diagram loaded successfully:', diagramData);
    } catch (error) {
      console.error('Error processing .ecore file:', error);
      alert('Error processing the .ecore file. Please try again.');
    }
  };

  // Handle diagram changes from canvas
  const handleDiagramChange = (nodes: Node[], edges: Edge[]) => {
    setIsDirty(true);
  };

  // Save current document
  const handleSaveClick = () => {
    if (!activeDocId || !flowCanvasRef.current) return;
    const nodes: Node[] = flowCanvasRef.current ? flowCanvasRef.current?.getNodes?.() || [] : [];
    const edges: Edge[] = flowCanvasRef.current ? flowCanvasRef.current?.getEdges?.() || [] : [];
    const data = exportFlowData(nodes, edges);
    saveDocumentData(activeDocId, data);
    const meta = documents.find(d => d.id === activeDocId);
    if (meta) {
      const updated = { ...meta, updatedAt: new Date().toISOString() };
      saveDocumentMeta(updated);
      setDocuments(prev => prev.map(m => m.id === updated.id ? updated : m));
      setActiveFileName(updated.name);
    }
    setIsDirty(false);
  };

  // Save As -> create new document id, keep current canvas content
  const handleSaveAsClick = () => {
    if (!flowCanvasRef.current) return;
    const nodes: Node[] = flowCanvasRef.current ? flowCanvasRef.current?.getNodes?.() || [] : [];
    const edges: Edge[] = flowCanvasRef.current ? flowCanvasRef.current?.getEdges?.() || [] : [];
    const data = exportFlowData(nodes, edges);
    const newId = generateFlowId();
    const now = new Date().toISOString();
    const defaultName = 'untitled.ecore';
    const newMeta: StoredDocumentMeta = { id: newId, name: defaultName, createdAt: now, updatedAt: now };
    saveDocumentMeta(newMeta);
    saveDocumentData(newId, data);
    setDocuments(prev => [newMeta, ...prev]);
    setActiveDocId(newId);
    setActiveFileName(defaultName);
    setIsDirty(false);
  };

  // Switch active tab
  const openDocument = (id: string) => {
    const data = loadDocumentData(id);
    if (data && flowCanvasRef.current?.loadDiagramData) {
      const restored = importFlowData(data);
      flowCanvasRef.current.loadDiagramData(restored.nodes as any, restored.edges as any);
      setActiveDocId(id);
      const meta = documents.find(d => d.id === id);
      setActiveFileName(meta?.name);
      setIsDirty(false);
    }
  };

  // New blank document
  const handleNewClick = () => {
    const newId = generateFlowId();
    const now = new Date().toISOString();
    const newMeta: StoredDocumentMeta = { id: newId, name: 'untitled.ecore', createdAt: now, updatedAt: now };
    saveDocumentMeta(newMeta);
    setDocuments(prev => [newMeta, ...prev]);
    setActiveDocId(newId);
    setActiveFileName('untitled.ecore');
    if (flowCanvasRef.current?.loadDiagramData) {
      flowCanvasRef.current.loadDiagramData([], []);
    }
    saveDocumentData(newId, { nodes: [], edges: [] } as any);
    setIsDirty(false);
    setSelectedDiagramType('ecore');
    setShowToolsPanel(true);
  };

  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      display: 'flex',
      overflow: 'hidden'
    }}>
      <Sidebar onDiagramSelect={handleDiagramSelection} />
      <div style={{ 
        flexGrow: 1, 
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0, // Prevents flex item from overflowing
        marginLeft: 0 // Ensure no gap
      }}>
        <Header 
          user={user}
          onLogout={onLogout}
        />
        
        {/* Status indicator */}
        {showToolsPanel && (
          <div style={{
            background: '#e3f2fd',
            borderBottom: '1px solid #2196f3',
            padding: '8px 20px',
            fontSize: '14px',
            color: '#1976d2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span>
              🎯 Active: {selectedDiagramType === 'class' ? 'UML Class Diagram' : selectedDiagramType === 'ecore' ? 'Ecore Model' : selectedDiagramType} Tools
            </span>
            <button
              onClick={handleCloseToolsPanel}
              style={{
                background: 'none',
                border: '1px solid #2196f3',
                borderRadius: '4px',
                padding: '4px 8px',
                color: '#2196f3',
                cursor: 'pointer',
                fontSize: '12px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#2196f3';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.color = '#2196f3';
              }}
            >
              Close Tools
            </button>
          </div>
        )}
        
        {/* Top-right workspace document panel (separate from ToolsPanel) */}
        {(activeDocId || isDirty) && (
          <div style={{ position: 'absolute', right: showToolsPanel ? 256 : 16, top: 56, zIndex: 25 }}>
            <div style={{
              background: '#ffffff',
              color: '#2c3e50',
              padding: '8px 10px',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
              border: '1px solid #e5e5e5'
            }}>
              {activeFileName && <span style={{ fontSize: 12, color: '#34495e' }}>{activeFileName}</span>}
              {isDirty && <span style={{ color: '#b07300', fontSize: 12 }}>● Unsaved</span>}
              <button
                onClick={handleSaveClick}
                style={{
                  background: '#f7f9fb',
                  color: '#1f2d3d',
                  border: '1px solid #d5dde5',
                  padding: '6px 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#eaf2fb';
                  e.currentTarget.style.borderColor = '#c7d6e8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f7f9fb';
                  e.currentTarget.style.borderColor = '#d5dde5';
                }}
              >
                Save
              </button>
              <button
                onClick={handleSaveAsClick}
                style={{
                  background: '#f7f9fb',
                  color: '#1f2d3d',
                  border: '1px solid #d5dde5',
                  padding: '6px 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#eaf2fb';
                  e.currentTarget.style.borderColor = '#c7d6e8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f7f9fb';
                  e.currentTarget.style.borderColor = '#d5dde5';
                }}
              >
                Save As
              </button>
            </div>
          </div>
        )}

        <div style={{ flexGrow: 1, position: 'relative', display: 'flex' }}>
          <FlowCanvas onDeploy={onDeploy} onDiagramChange={handleDiagramChange} ref={flowCanvasRef} />
          <ToolsPanel 
            isVisible={showToolsPanel} 
            onClose={handleCloseToolsPanel}
            onEcoreFileUpload={handleEcoreFileUpload}
          />
        </div>
      </div>
    </div>
  );
} 