import {
  UML_PACKAGE_LAYOUT_KEY,
  applyLayoutToFlowNodes,
  applyLayoutToUmlClasses,
  flowNodeLayoutKey,
  hasSavedUmlLayout,
  loadUmlLayout,
  loadUmlViewport,
  positionsFromFlowNodes,
  positionsFromUmlClasses,
  saveUmlLayout,
  umlClassNodeId,
  umlLayoutStorageKey,
} from '../../utils/umlLayoutStorage';

describe('umlLayoutStorage', () => {
  const scopeId = 'test-scope';
  const fileName = 'Model.ecore';

  beforeEach(() => {
    localStorage.clear();
  });

  it('uses stable class-based keys for flow nodes', () => {
    const nodes = [
      {
        id: umlClassNodeId('Order'),
        type: 'editable',
        position: { x: 100, y: 200 },
        data: { className: 'Order', label: 'Order', toolName: 'class' },
      },
    ] as any[];

    expect(flowNodeLayoutKey(nodes[0])).toBe('Order');
    saveUmlLayout(scopeId, fileName, positionsFromFlowNodes(nodes));

    const stored = loadUmlLayout(scopeId, fileName);
    expect(stored?.Order).toEqual({ x: 100, y: 200 });
    expect(hasSavedUmlLayout(scopeId, fileName)).toBe(true);
  });

  it('restores layout for regenerated nodes with new ids but same class names', () => {
    saveUmlLayout(scopeId, fileName, { Person: { x: 50, y: 75 } });

    const nodes = applyLayoutToFlowNodes(scopeId, fileName, [
      {
        id: umlClassNodeId('Person'),
        type: 'editable',
        position: { x: 0, y: 0 },
        data: { className: 'Person', label: 'Person', toolName: 'class' },
      },
    ] as any[]);

    expect(nodes[0].position).toEqual({ x: 50, y: 75 });
  });

  it('restores layout for UMLDiagram class boxes', () => {
    saveUmlLayout(scopeId, fileName, { Employee: { x: 300, y: 400 } });

    const classes = applyLayoutToUmlClasses(scopeId, fileName, [
      { id: 'Employee', name: 'Employee', x: 0, y: 0 },
    ] as any);

    expect(classes[0].x).toBe(300);
    expect(classes[0].y).toBe(400);
  });

  it('builds namespaced storage keys', () => {
    expect(umlLayoutStorageKey(scopeId, fileName)).toContain(scopeId);
    expect(umlLayoutStorageKey(scopeId, fileName)).toContain(fileName);
  });

  it('stores package node position under package layout key', () => {
    const nodes = [
      {
        id: 'uml-pkg-testpackage',
        type: 'editable',
        position: { x: 10, y: 20 },
        data: { className: 'testpackage', label: 'testpackage', toolName: 'package' },
      },
    ] as any[];

    saveUmlLayout(scopeId, fileName, positionsFromFlowNodes(nodes));
    const stored = loadUmlLayout(scopeId, fileName);
    expect(stored?.[UML_PACKAGE_LAYOUT_KEY]).toEqual({ x: 10, y: 20 });
  });

  it('does not write when position map is empty', () => {
    saveUmlLayout(scopeId, fileName, {});
    expect(hasSavedUmlLayout(scopeId, fileName)).toBe(false);
  });

  it('falls back to legacy node id when class key is missing', () => {
    saveUmlLayout(scopeId, fileName, { legacy_node_id: { x: 5, y: 6 } });
    const nodes = applyLayoutToFlowNodes(scopeId, fileName, [
      {
        id: 'legacy_node_id',
        type: 'editable',
        position: { x: 0, y: 0 },
        data: {},
      },
    ] as any[]);
    expect(nodes[0].position).toEqual({ x: 5, y: 6 });
  });

  it('round-trips viewport pan/zoom with class positions', () => {
    const classes = [{ id: 'A', x: 100, y: 200 }];
    saveUmlLayout(scopeId, fileName, {
      ...positionsFromUmlClasses(classes),
      __viewport__: { x: -40, y: 60, scale: 1.25 },
    });
    expect(loadUmlViewport(scopeId, fileName)).toEqual({ x: -40, y: 60, scale: 1.25 });
  });

  it('round-trips UMLDiagram class positions', () => {
    const classes = [
      { id: 'A', x: 100, y: 200 },
      { id: 'B', x: 300, y: 400 },
    ];
    saveUmlLayout(scopeId, fileName, positionsFromUmlClasses(classes));
    const restored = applyLayoutToUmlClasses(scopeId, fileName, [
      { id: 'A', x: 0, y: 0 },
      { id: 'B', x: 0, y: 0 },
    ] as any);
    expect(restored[0]).toMatchObject({ x: 100, y: 200 });
    expect(restored[1]).toMatchObject({ x: 300, y: 400 });
  });
});
