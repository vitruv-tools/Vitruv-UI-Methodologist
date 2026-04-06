import {
  exportFlowData,
  importFlowData,
  validateFlowData,
  generateFlowId,
  listDocuments,
  saveDocumentMeta,
  removeDocumentMeta,
  loadDocumentData,
  saveDocumentData,
  StoredDocumentMeta,
} from '../../utils/flowUtils';
import { Node, Edge } from 'reactflow';
import { FlowData } from '../../types/flow';

jest.mock('../../utils/UMLFromEcoreTS', () => ({
  __esModule: true,
  getNodeNameFromEcoreIdentifier: jest.fn((value: string) => value),
  findClassNameFromEcoreIdentifier: jest.fn((value: string) => value),
  findPackageNameFromEcoreIdentifier: jest.fn((value: string) => value),
  getHandleIdForEcoreElement: jest.fn((_: string, direction: string, type: string) => `${direction}-${type}`),
  buildAttributeSignature: jest.fn(() => '+ attr: EString'),
  buildMethodSignature: jest.fn(() => '+ op(): void'),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: (arr: Uint32Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 0xffffffff);
      }
      return arr;
    },
  },
});

const makeNode = (id: string, label: string): Node => ({
  id,
  type: 'editable',
  position: { x: 0, y: 0 },
  data: { label, onLabelChange: jest.fn() },
});

const makeEdge = (id: string, source: string, target: string): Edge => ({
  id,
  source,
  target,
});

describe('exportFlowData', () => {
  it('should export nodes and edges', () => {
    const nodes = [makeNode('1', 'Node A')];
    const edges = [makeEdge('e1', '1', '1')];
    const result = exportFlowData(nodes, edges);
    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(1);
  });

  it('should strip onLabelChange from node data', () => {
    const nodes = [makeNode('1', 'Node A')];
    const result = exportFlowData(nodes, []);
    expect(result.nodes[0].data.onLabelChange).toBeUndefined();
  });

  it('should preserve label in exported node data', () => {
    const nodes = [makeNode('1', 'My Label')];
    const result = exportFlowData(nodes, []);
    expect(result.nodes[0].data.label).toBe('My Label');
  });

  it('should use empty string for label when missing', () => {
    const node: Node = { id: '1', type: 'editable', position: { x: 0, y: 0 }, data: {} };
    const result = exportFlowData([node], []);
    expect(result.nodes[0].data.label).toBe('');
  });

  it('should preserve all other node properties', () => {
    const nodes = [makeNode('1', 'Node A')];
    const result = exportFlowData(nodes, []);
    expect(result.nodes[0].id).toBe('1');
    expect(result.nodes[0].type).toBe('editable');
    expect(result.nodes[0].position).toEqual({ x: 0, y: 0 });
  });
});

describe('importFlowData', () => {
  it('should import nodes and edges', () => {
    const flowData: FlowData = {
      nodes: [{ id: '1', type: 'editable', position: { x: 0, y: 0 }, data: { label: 'A' } }],
      edges: [makeEdge('e1', '1', '1')],
    };
    const result = importFlowData(flowData);
    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(1);
  });

  it('should set onLabelChange to undefined on import', () => {
    const flowData: FlowData = {
      nodes: [{ id: '1', type: 'editable', position: { x: 0, y: 0 }, data: { label: 'A' } }],
      edges: [],
    };
    const result = importFlowData(flowData);
    expect(result.nodes[0].data.onLabelChange).toBeUndefined();
  });

  describe('validateFlowData', () => {
    it('should return true for valid flow data', () => {
      const flowData: FlowData = {
        nodes: [{ id: '1', type: 'editable', position: { x: 0, y: 0 }, data: { label: 'A' } }],
        edges: [makeEdge('e1', '1', '1')],
      };
      expect(validateFlowData(flowData)).toBe(true);
    });

    it('should return true for empty nodes and edges', () => {
      expect(validateFlowData({ nodes: [], edges: [] })).toBe(true);
    });

    it('should return false when nodes is missing', () => {
      expect(validateFlowData({ edges: [] } as any)).toBe(false);
    });

    it('should return false when edges is missing', () => {
      expect(validateFlowData({ nodes: [] } as any)).toBe(false);
    });

    it('should return false when a node is missing id', () => {
      const flowData = {
        nodes: [{ type: 'editable', position: { x: 0, y: 0 }, data: { label: 'A' } }],
        edges: [],
      };
      expect(validateFlowData(flowData as any)).toBe(false);
    });

    it('should return false when a node is missing label', () => {
      const flowData = {
        nodes: [{ id: '1', type: 'editable', position: { x: 0, y: 0 }, data: {} }],
        edges: [],
      };
      expect(validateFlowData(flowData as any)).toBe(false);
    });

    it('should return false when edge references non-existent source node', () => {
      const flowData: FlowData = {
        nodes: [{ id: '1', type: 'editable', position: { x: 0, y: 0 }, data: { label: 'A' } }],
        edges: [makeEdge('e1', 'nonexistent', '1')],
      };
      expect(validateFlowData(flowData)).toBe(false);
    });

    it('should return false when edge references non-existent target node', () => {
      const flowData: FlowData = {
        nodes: [{ id: '1', type: 'editable', position: { x: 0, y: 0 }, data: { label: 'A' } }],
        edges: [makeEdge('e1', '1', 'nonexistent')],
      };
      expect(validateFlowData(flowData)).toBe(false);
    });
  });

  describe('generateFlowId', () => {
    it('should generate a string starting with flow_', () => {
      const id = generateFlowId();
      expect(id).toMatch(/^flow_/);
    });

    it('should generate unique ids', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateFlowId()));
      expect(ids.size).toBe(100);
    });
  });

  describe('localStorage document functions', () => {
    beforeEach(() => {
      localStorageMock.clear();
    });

    const sampleMeta: StoredDocumentMeta = {
      id: 'doc-1',
      name: 'Test Document',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    describe('listDocuments', () => {
      it('should return empty array when no documents stored', () => {
        expect(listDocuments()).toEqual([]);
      });

      it('should return stored documents', () => {
        saveDocumentMeta(sampleMeta);
        expect(listDocuments()).toHaveLength(1);
      });
    });

    describe('saveDocumentMeta', () => {
      it('should save a new document meta', () => {
        saveDocumentMeta(sampleMeta);
        const docs = listDocuments();
        expect(docs[0].id).toBe('doc-1');
        expect(docs[0].name).toBe('Test Document');
      });

      it('should update existing document meta with same id', () => {
        saveDocumentMeta(sampleMeta);
        saveDocumentMeta({ ...sampleMeta, name: 'Updated Name' });
        const docs = listDocuments();
        expect(docs).toHaveLength(1);
        expect(docs[0].name).toBe('Updated Name');
      });

      it('should prepend new documents to the list', () => {
        saveDocumentMeta(sampleMeta);
        saveDocumentMeta({ ...sampleMeta, id: 'doc-2', name: 'Second Doc' });
        const docs = listDocuments();
        expect(docs[0].id).toBe('doc-2');
      });
    });

    describe('removeDocumentMeta', () => {
      it('should remove document meta by id', () => {
        saveDocumentMeta(sampleMeta);
        removeDocumentMeta('doc-1');
        expect(listDocuments()).toHaveLength(0);
      });

      it('should also remove document data when removing meta', () => {
        saveDocumentMeta(sampleMeta);
        saveDocumentData('doc-1', { nodes: [], edges: [] });
        removeDocumentMeta('doc-1');
        expect(loadDocumentData('doc-1')).toBeNull();
      });
    });

    describe('saveDocumentData / loadDocumentData', () => {
      it('should save and load document data', () => {
        const data: FlowData = {
          nodes: [{ id: '1', type: 'editable', position: { x: 0, y: 0 }, data: { label: 'A' } }],
          edges: [],
        };
        saveDocumentData('doc-1', data);
        const loaded = loadDocumentData('doc-1');
        expect(loaded?.nodes).toHaveLength(1);
        expect(loaded?.nodes[0].data.label).toBe('A');
      });

      it('should return null for non-existent document', () => {
        expect(loadDocumentData('nonexistent')).toBeNull();
      });
    });
  });
});