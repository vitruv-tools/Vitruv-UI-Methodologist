import React, { useEffect, useState, useRef } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { FlowCanvas } from '../flow/FlowCanvas';
import { parseEcoreFile, createSimpleEcoreDiagram } from '../../utils/ecoreParser';
import { exportFlowData, importFlowData, generateFlowId, listDocuments, saveDocumentMeta, loadDocumentData, saveDocumentData, StoredDocumentMeta } from '../../utils/flowUtils';
import { Node, Edge } from 'reactflow';
import { User } from '../../services/auth';

interface MainLayoutProps {
  onDeploy?: (nodes: any[], edges: any[]) => void;
  onSave?: () => void;
  onLoad?: () => void;
  onNew?: () => void;
  user?: User | null;
  onLogout?: () => void;
}

interface EcoreFileBox {
  id: string;
  fileName: string;
  fileContent: string;
  position: { x: number; y: number };
}

export function MainLayout({ onDeploy, onSave, onLoad, onNew, user, onLogout }: MainLayoutProps) {
  const [selectedDiagramType, setSelectedDiagramType] = useState<string | undefined>();
  const flowCanvasRef = useRef<any>(null);

  // Active document state (single open doc in workspace)
  const [documents, setDocuments] = useState<StoredDocumentMeta[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | undefined>(undefined);
  const [activeFileName, setActiveFileName] = useState<string | undefined>(undefined);
  const [isDirty, setIsDirty] = useState(false);

  // ECORE file boxes in workspace
  const [ecoreFileBoxes, setEcoreFileBoxes] = useState<EcoreFileBox[]>([]);
  const [selectedFileBoxId, setSelectedFileBoxId] = useState<string | null>(null);

  // Don't load any initial document - start with empty workspace
  useEffect(() => {
    // Clear any existing data to ensure empty workspace
    if (flowCanvasRef.current?.loadDiagramData) {
      flowCanvasRef.current.loadDiagramData([], []);
    }
    
    // Clear any existing documents from localStorage to ensure fresh start
    try {
      localStorage.removeItem('vitruv.documents');
      // Clear any document data keys
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('vitruv.document.data.')) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.log('Could not clear localStorage:', error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDiagramSelection = (diagramType: string) => {
    console.log('Diagram selected:', diagramType);
    setSelectedDiagramType(diagramType);
  };

  // Calculate empty position for new box next to existing boxes
  const calculateEmptyPosition = (existingBoxes: EcoreFileBox[]) => {
    if (existingBoxes.length === 0) {
      // First box - place in center
      return { x: 100, y: 100 };
    }
    
    // Box dimensions (approximate)
    const boxWidth = 280; // Based on minWidth + padding
    const boxHeight = 200; // Based on content height
    const spacing = 40; // Space between boxes
    
    // Try to place new box in a logical grid pattern
    // First, try to the right of the rightmost box
    const rightmostBox = existingBoxes.reduce((rightmost, box) => 
      box.position.x > rightmost.position.x ? box : rightmost
    );
    
    let newX = rightmostBox.position.x + boxWidth + spacing;
    let newY = rightmostBox.position.y;
    
    // Check if right position is available
    if (!wouldOverlap(existingBoxes, { x: newX, y: newY }, boxWidth, boxHeight, spacing)) {
      return { x: newX, y: newY };
    }
    
    // If right is occupied, try below the rightmost box
    newX = rightmostBox.position.x;
    newY = rightmostBox.position.y + boxHeight + spacing;
    
    if (!wouldOverlap(existingBoxes, { x: newX, y: newY }, boxWidth, boxHeight, spacing)) {
      return { x: newX, y: newY };
    }
    
    // If both positions are occupied, find the first available position in a grid
    return findFirstEmptyGridPosition(existingBoxes, boxWidth, boxHeight, spacing);
  };
  
  // Helper function to check if a position would overlap with existing boxes
  const wouldOverlap = (existingBoxes: EcoreFileBox[], position: { x: number; y: number }, boxWidth: number, boxHeight: number, spacing: number) => {
    return existingBoxes.some(box => 
      Math.abs(box.position.x - position.x) < boxWidth + spacing &&
      Math.abs(box.position.y - position.y) < boxHeight + spacing
    );
  };
  
  // Helper function to find first empty grid position
  const findFirstEmptyGridPosition = (existingBoxes: EcoreFileBox[], boxWidth: number, boxHeight: number, spacing: number) => {
    const gridSize = boxWidth + spacing;
    let gridX = 100;
    let gridY = 100;
    
    // Search in a grid pattern
    while (gridY < 800) { // Limit vertical search
      while (gridX < 1200) { // Limit horizontal search
        const testPosition = { x: gridX, y: gridY };
        
        if (!wouldOverlap(existingBoxes, testPosition, boxWidth, boxHeight, spacing)) {
          return testPosition;
        }
        
        gridX += gridSize;
      }
      gridX = 100;
      gridY += gridSize;
    }
    
    // Fallback: place at a random position that doesn't overlap
    return { x: 100, y: 100 };
  };

  const handleEcoreFileUpload = (fileContent: string, meta?: { fileName?: string }) => {
    console.log('Processing .ecore file upload');
    
    try {
      // Check if we already have this file
      const existingFile = ecoreFileBoxes.find(f => f.fileName === meta?.fileName);
      if (existingFile) {
        console.log('File already exists in workspace:', meta?.fileName);
        // Just select the existing file
        setSelectedFileBoxId(existingFile.id);
        return;
      }
      
      // Clear any existing diagram data when uploading new file
      if (flowCanvasRef.current?.loadDiagramData) {
        flowCanvasRef.current.loadDiagramData([], []);
      }
      
      // Reset any previously expanded file state to show all boxes
      if (flowCanvasRef.current?.resetExpandedFile) {
        flowCanvasRef.current.resetExpandedFile();
      }
      
      // Calculate position for new box in empty space
      const newPosition = calculateEmptyPosition(ecoreFileBoxes);
      
      // Add ECORE file box to workspace ONLY - no content loading
      const newFileBox: EcoreFileBox = {
        id: `ecore-box-${Date.now()}`,
        fileName: meta?.fileName || 'untitled.ecore',
        fileContent,
        position: newPosition,
      };
      
      setEcoreFileBoxes(prev => [...prev, newFileBox]);
      setSelectedFileBoxId(newFileBox.id);
      
      console.log('ECORE file box added to workspace:', meta?.fileName);
    } catch (error) {
      console.error('Error processing .ecore file:', error);
      alert('Error processing the .ecore file. Please try again.');
    }
  };

  // Handle ECORE file box selection
  const handleEcoreFileSelect = (fileName: string) => {
    const fileBox = ecoreFileBoxes.find(f => f.fileName === fileName);
    if (fileBox) {
      setSelectedFileBoxId(fileBox.id);
      console.log('Selected ECORE file box:', fileName);
    }
  };

  // Handle ECORE file box expansion (double-click)
  const handleEcoreFileExpand = (fileName: string, fileContent: string) => {
    console.log('Expanding ECORE file:', fileName);
    
    try {
      // Clear any existing diagram data first
      if (flowCanvasRef.current?.loadDiagramData) {
        flowCanvasRef.current.loadDiagramData([], []);
      }
      
      // Reset any previously expanded file state to hide all boxes
      if (flowCanvasRef.current?.resetExpandedFile) {
        flowCanvasRef.current.resetExpandedFile();
      }
      
      // Try to parse the .ecore file
      let diagramData = parseEcoreFile(fileContent);
      
      // If parsing fails, create a simple diagram
      if (diagramData.nodes.length === 1 && diagramData.nodes[0].data.label === 'Error parsing .ecore file') {
        console.log('XML parsing failed, creating simple diagram');
        diagramData = createSimpleEcoreDiagram(fileContent);
      }
      
      // Create or switch active document for this expansion
      const newId = generateFlowId();
      const name = fileName;
      const now = new Date().toISOString();
      const newMeta: StoredDocumentMeta = { id: newId, name, createdAt: now, updatedAt: now, sourceFileName: fileName };
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
      
      console.log('Ecore diagram expanded successfully:', diagramData);
    } catch (error) {
      console.error('Error expanding .ecore file:', error);
      alert('Error expanding the .ecore file. Please try again.');
    }
  };

  // Handle closing the current document
  const handleCloseDocument = () => {
    if (activeDocId) {
      setActiveDocId(undefined);
      setActiveFileName(undefined);
      setIsDirty(false);
      
      // Clear the canvas
      if (flowCanvasRef.current?.loadDiagramData) {
        flowCanvasRef.current.loadDiagramData([], []);
      }
      
      // Reset expanded file state to show ECORE file boxes again
      if (flowCanvasRef.current?.resetExpandedFile) {
        flowCanvasRef.current.resetExpandedFile();
      }
    }
  };

  // Handle ECORE file box position change
  const handleEcoreFilePositionChange = (id: string, newPosition: { x: number; y: number }) => {
    setEcoreFileBoxes(prev => 
      prev.map(box => 
        box.id === id 
          ? { ...box, position: newPosition }
          : box
      )
    );
  };

  // Handle ECORE file box deletion
  const handleEcoreFileDelete = (id: string) => {
    setEcoreFileBoxes(prev => prev.filter(box => box.id !== id));
    if (selectedFileBoxId === id) {
      setSelectedFileBoxId(null);
    }
  };

  // Handle ECORE file box rename
  const handleEcoreFileRename = (id: string, newFileName: string) => {
    setEcoreFileBoxes(prev => 
      prev.map(box => 
        box.id === id 
          ? { ...box, fileName: newFileName }
          : box
      )
    );
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
    
  };

  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      display: 'flex',
      overflow: 'hidden'
    }}>
      <Sidebar 
        onDiagramSelect={handleDiagramSelection} 
        onEcoreFileUpload={handleEcoreFileUpload}
      />
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
        {selectedDiagramType && (
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
          </div>
        )}
        
        {/* Top-right workspace document panel (separate from ToolsPanel) */}
        {activeDocId && (
          <div style={{ position: 'absolute', right: 16, top: 56, zIndex: 25 }}>
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
              <button
                onClick={handleCloseDocument}
                style={{
                  background: '#fef2f2',
                  color: '#dc2626',
                  border: '1px solid #fecaca',
                  padding: '6px 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#fee2e2';
                  e.currentTarget.style.borderColor = '#fca5a5';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#fef2f2';
                  e.currentTarget.style.borderColor = '#fecaca';
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Workspace info panel */}
        <div style={{ position: 'absolute', left: 16, top: 56, zIndex: 25 }}>
          <div style={{
            background: '#ffffff',
            color: '#2c3e50',
            padding: '8px 12px',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
            border: '1px solid #e5e5e5',
            fontSize: '12px'
          }}>
            <span style={{ color: '#34495e' }}>📁 Workspace</span>
            <span style={{ color: '#7f8c8d' }}>•</span>
            <span style={{ color: '#34495e' }}>{ecoreFileBoxes.length} ECORE files</span>
            {ecoreFileBoxes.length > 0 && (
              <>
                <span style={{ color: '#7f8c8d' }}>•</span>
                <span style={{ color: '#34495e' }}>
                  {documents.filter(doc => doc.sourceFileName).length} diagrams
                </span>
              </>
            )}
          </div>
        </div>

        <div style={{ flexGrow: 1, position: 'relative', display: 'flex' }}>
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
        </div>
      </div>
    </div>
  );
} 