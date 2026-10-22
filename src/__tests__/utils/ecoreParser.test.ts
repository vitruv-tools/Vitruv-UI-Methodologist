import { parseEcoreFile, extractNsUriFromEcore, createSimpleEcoreDiagram } from '../../utils/ecoreParser';

const getData = (node: any) => node?.data as any;

const simpleEcore = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<ecore:EPackage xmi:version="2.0"',
  '    xmlns:xmi="http://www.omg.org/XMI"',
  '    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
  '    xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"',
  '    name="testpackage"',
  '    nsURI="http://example.com/testpackage"',
  '    nsPrefix="testpackage">',
  '  <eClassifiers xsi:type="ecore:EClass" name="Person">',
  '    <eStructuralFeatures xsi:type="ecore:EAttribute" name="name"/>',
  '  </eClassifiers>',
  '</ecore:EPackage>'
].join('\n');

const ecoreWithClass = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<ecore:EPackage xmi:version="2.0"',
  '    xmlns:xmi="http://www.omg.org/XMI"',
  '    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
  '    xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"',
  '    name="testpackage">',
  '  <eClassifiers xsi:type="ecore:EClass" name="Person">',
  '    <eStructuralFeatures xsi:type="ecore:EAttribute" name="age"/>',
  '    <eStructuralFeatures xsi:type="ecore:EAttribute" name="name"/>',
  '  </eClassifiers>',
  '</ecore:EPackage>'
].join('\n');

describe('parseEcoreFile', () => {

  describe('invalid input', () => {
    it('should return error node for invalid XML', () => {
      const { nodes, edges } = parseEcoreFile('not valid xml <<<');
      expect(nodes).toHaveLength(1);
      expect(nodes[0].id).toBe('error-1');
      expect(edges).toHaveLength(0);
    });

    it('should return error node when no EPackage is found', () => {
      const { nodes } = parseEcoreFile('<root><child/></root>');
      expect(nodes[0].id).toBe('error-1');
    });

    it('should return error node for empty string', () => {
      const { nodes } = parseEcoreFile('');
      expect(nodes[0].id).toBe('error-1');
    });
  });

  describe('package parsing', () => {
    it('should create nodes from eClassifiers', () => {
      const { nodes } = parseEcoreFile(simpleEcore);
      expect(nodes.length).toBeGreaterThan(0);
    });
  });

  describe('class parsing', () => {
    it('should assign positions to all nodes', () => {
      const { nodes } = parseEcoreFile(ecoreWithClass);
      nodes.forEach(node => {
        expect(typeof node.position.x).toBe('number');
        expect(typeof node.position.y).toBe('number');
      });
    });

    it('should always return at least one node', () => {
      const { nodes } = parseEcoreFile(ecoreWithClass);
      expect(nodes.length).toBeGreaterThan(0);
    });
  });

  describe('node structure', () => {
    it('should assign unique ids to all nodes', () => {
      const { nodes } = parseEcoreFile(simpleEcore);
      const ids = nodes.map(n => n.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should assign unique ids to all edges', () => {
      const { edges } = parseEcoreFile(simpleEcore);
      const ids = edges.map(e => e.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should set node type to default', () => {
      const { nodes } = parseEcoreFile(simpleEcore);
      nodes.forEach(node => {
        expect(node.type).toBe('default');
      });
    });
  });
});

describe('extractNsUriFromEcore', () => {
  it('should extract nsURI from valid ecore content', () => {
    const result = extractNsUriFromEcore(simpleEcore);
    expect(result).toBe('http://example.com/testpackage');
  });

  it('should return null when nsURI is not present', () => {
    const content = '<ecore:EPackage name="test"/>';
    expect(extractNsUriFromEcore(content)).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(extractNsUriFromEcore('')).toBeNull();
  });

  it('should handle nsURI with special characters', () => {
    const content = '<ecore:EPackage nsURI="http://example.com/my-package/v1.0"/>';
    expect(extractNsUriFromEcore(content)).toBe('http://example.com/my-package/v1.0');
  });
});

describe('createSimpleEcoreDiagram', () => {
  it('should always create a root Ecore Model node', () => {
    const { nodes } = createSimpleEcoreDiagram(simpleEcore);
    const rootNode = nodes.find(n => getData(n).label === 'Ecore Model');
    expect(rootNode).toBeDefined();
  });

  it('should create class nodes for each name attribute found', () => {
    const { nodes } = createSimpleEcoreDiagram(simpleEcore);
    expect(nodes.length).toBeGreaterThan(1);
  });

  it('should create edges from root to each class node', () => {
    const { edges } = createSimpleEcoreDiagram(simpleEcore);
    const containsEdges = edges.filter(e => e.label === 'contains');
    expect(containsEdges.length).toBeGreaterThan(0);
  });

  it('should set source of all edges to root node', () => {
    const { nodes, edges } = createSimpleEcoreDiagram(simpleEcore);
    const rootNode = nodes.find(n => getData(n).label === 'Ecore Model');
    edges.forEach(edge => {
      expect(edge.source).toBe(rootNode?.id);
    });
  });

  it('should return only root node for content with no name attributes', () => {
    const { nodes, edges } = createSimpleEcoreDiagram('<root/>');
    expect(nodes).toHaveLength(1);
    expect(edges).toHaveLength(0);
  });

  it('should assign positions to all nodes', () => {
    const { nodes } = createSimpleEcoreDiagram(simpleEcore);
    nodes.forEach(node => {
      expect(typeof node.position.x).toBe('number');
      expect(typeof node.position.y).toBe('number');
    });
  });

  it('should set ecoreData type to EPackage for root node', () => {
    const { nodes } = createSimpleEcoreDiagram(simpleEcore);
    const rootNode = nodes.find(n => getData(n).label === 'Ecore Model');
    expect(getData(rootNode).ecoreData?.type).toBe('EPackage');
  });

  it('should assign unique ids to all nodes', () => {
    const { nodes } = createSimpleEcoreDiagram(simpleEcore);
    const ids = nodes.map(n => n.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});