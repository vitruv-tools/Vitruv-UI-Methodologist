import type { Edge, Node } from 'reactflow';
import { layoutExpandedUmlEdges, umlSegmentHitsRect, type UmlEdgeLabel } from '../../utils/expandedUmlLayout';
import { expandMetaModelToNodes } from '../../utils/expandMetaModel';
import { nodeWorldRect, type Rect } from '../../components/flow/flowCanvasAStarRouter';
import { ghostPositionChanges } from '../../utils/FineGranularReactionUtils';
import { applyReactionLayout, captureReactionLayout } from '../../utils/reactionLayoutStorage';
import { enterReactionMode, exitReactionMode } from '../../components/flow/flowCanvasReactionMode';
import { useProjectStore } from '../../store/Project';

/** Mixed class sizes, inheritance, parallel/reciprocal references, and a self reference. */
const reactionsLayoutFixture = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
 xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"
 name="library" nsURI="http://example.org/library" nsPrefix="library">
${[
  ['Item', 0, '<eStructuralFeatures xsi:type="ecore:EReference" name="books" eType="#//Book" upperBound="-1"/><eStructuralFeatures xsi:type="ecore:EReference" name="archivedBooks" eType="#//Book" upperBound="-1"/><eStructuralFeatures xsi:type="ecore:EReference" name="writers" eType="#//Writer" upperBound="-1"/>'],
  ['Writer', 3, '<eStructuralFeatures xsi:type="ecore:EReference" name="books" eType="#//Book" upperBound="-1"/>'],
  ['Book', 1, '<eStructuralFeatures xsi:type="ecore:EReference" name="writers" eType="#//Writer" upperBound="-1"/>'],
  ['Employee', 8, '<eStructuralFeatures xsi:type="ecore:EReference" name="manager" eType="#//Employee"/><eStructuralFeatures xsi:type="ecore:EReference" name="loans" eType="#//Loan" upperBound="-1"/>'],
  ['Member', 1, '<eStructuralFeatures xsi:type="ecore:EReference" name="loans" eType="#//Loan" upperBound="-1"/>'],
  ['Loan', 0, '<eStructuralFeatures xsi:type="ecore:EReference" name="item" eType="#//Item"/>'],
  ['VideoCassette', 1, ''],
  ['AbstractResource', 0, ''],
  ['Library', 2, '<eStructuralFeatures xsi:type="ecore:EReference" name="items" eType="#//Item" upperBound="-1" containment="true"/>'],
  ['Catalog', 0, '<eStructuralFeatures xsi:type="ecore:EReference" name="resources" eType="#//AbstractResource" upperBound="-1"/>'],
  ['AddressWithAnUnusuallyLongClassName', 7, ''],
  ['Audit', 1, ''],
].map(([name, count, refs]) => `<eClassifiers xsi:type="ecore:EClass" name="${name}"${name === 'VideoCassette' ? ' eSuperTypes="#//Item"' : ''}${name === 'AbstractResource' ? ' abstract="true"' : ''}>
${Array.from({ length: Number(count) }, (_, index) => `<eStructuralFeatures xsi:type="ecore:EAttribute" name="${index === 0 ? 'descriptiveAttributeName' : `field${index}`}" eType="ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EString"/>`).join('\n')}
${refs}
</eClassifiers>`).join('\n')}
</ecore:EPackage>`;

const bounds = (label: UmlEdgeLabel): Rect => ({ x: label.x - label.width / 2,
  y: label.y - label.height / 2, width: label.width, height: label.height });
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.width && a.x + a.width > b.x
  && a.y < b.y + b.height && a.y + a.height > b.y;
const classNode = (id: string, x: number, y: number): Node => ({ id, type: 'eobject',
  position: { x, y }, data: { attributes: [] } });
const edge = (id: string, source: string, target: string): Edge => ({ id, source, target, type: 'uml',
  data: { expandedIntraModel: true, label: id, relationshipType: 'association', sourceMultiplicity: '1', targetMultiplicity: '0..*' } });

describe('expanded Reactions layout', () => {
  beforeEach(() => localStorage.clear());
  it('keeps differently sized classes and long names separate and inside their model box', () => {
    const result = expandMetaModelToNodes(reactionsLayoutFixture, 'library.ecore', { x: 100, y: 200 })!;
    const boxes = result.eObjectNodes.map(node => nodeWorldRect(node)!);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) expect(overlaps(boxes[i], boxes[j])).toBe(false);
      expect(boxes[i].x + boxes[i].width).toBeLessThanOrEqual(100 + result.boundingBox.data.width!);
      expect(boxes[i].y + boxes[i].height).toBeLessThanOrEqual(200 + result.boundingBox.data.height!);
    }
    expect(result.eObjectNodes.find(node => node.data.className.startsWith('Address'))!.style!.width).toBeGreaterThan(200);
  });

  it('routes around intervening classes and places all labels clear of classes and each other', () => {
    const result = expandMetaModelToNodes(reactionsLayoutFixture, 'library.ecore', { x: 0, y: 0 })!;
    const layouts = layoutExpandedUmlEdges(result.eObjectNodes, result.umlEdges);
    expect(layouts.size).toBe(result.umlEdges.length);
    const boxes = result.eObjectNodes.map(node => nodeWorldRect(node)!);
    const labels: Rect[] = [];
    for (const layout of layouts.values()) {
      for (let i = 1; i < layout.points.length; i++) {
        for (const box of boxes) expect(umlSegmentHitsRect(layout.points[i - 1], layout.points[i], box)).toBe(false);
      }
      for (const label of [layout.name, layout.sourceMultiplicity, layout.targetMultiplicity]) {
        if (!label) continue;
        const rect = bounds(label);
        for (const box of [...boxes, ...labels]) expect(overlaps(rect, box)).toBe(false);
        labels.push(rect);
      }
    }
    expect(labels.length).toBeGreaterThan(20);
  });

  it('gives parallel and reciprocal references distinct routes and connection points', () => {
    const nodes = [classNode('a', 0, 0), classNode('b', 600, 0)];
    const edges = [edge('one', 'a', 'b'), edge('two', 'a', 'b'), edge('back', 'b', 'a')];
    const layouts = [...layoutExpandedUmlEdges(nodes, edges).values()];
    expect(new Set(layouts.map(layout => JSON.stringify(layout.points))).size).toBe(3);
    expect(new Set(layouts.map(layout => JSON.stringify(layout.midpoint))).size).toBe(3);
  });

  it('recomputes deterministically after moving a class into an association', () => {
    const nodes = [classNode('a', 0, 0), classNode('b', 600, 0), classNode('c', 300, 200)];
    const edges = [edge('link', 'a', 'b')];
    const before = layoutExpandedUmlEdges(nodes, edges).get('link')!;
    const moved = nodes.map(node => node.id === 'c' ? { ...node, position: { x: 300, y: 0 } } : node);
    const after = layoutExpandedUmlEdges(moved, edges).get('link')!;
    expect(after.points).not.toEqual(before.points);
    expect(layoutExpandedUmlEdges(moved, edges).get('link')).toEqual(after);
    for (let i = 1; i < after.points.length; i++) {
      expect(umlSegmentHitsRect(after.points[i - 1], after.points[i], nodeWorldRect(moved[2])!)).toBe(false);
    }
  });

  it('detects small obstacles on long segments without sampling gaps', () => {
    expect(umlSegmentHitsRect({ x: 0, y: 0 }, { x: 1000, y: 1000 }, { x: 101, y: 101, width: 4, height: 4 })).toBe(true);
  });

  it('routes a self reference outside its class and keeps its labels readable', () => {
    const nodes = [classNode('a', 0, 100)];
    const layout = layoutExpandedUmlEdges(nodes, [edge('self', 'a', 'a')]).get('self')!;
    const box = nodeWorldRect(nodes[0])!;
    for (let i = 1; i < layout.points.length; i++) {
      expect(umlSegmentHitsRect(layout.points[i - 1], layout.points[i], box)).toBe(false);
    }
    const labels = [layout.name!, layout.sourceMultiplicity!, layout.targetMultiplicity!].map(bounds);
    for (let i = 0; i < labels.length; i++) {
      expect(overlaps(labels[i], box)).toBe(false);
      for (let j = i + 1; j < labels.length; j++) expect(overlaps(labels[i], labels[j])).toBe(false);
    }
  });

  it('keeps routes and labels readable for a larger, densely connected model', () => {
    const nodes = Array.from({ length: 36 }, (_, i) => ({ ...classNode(`c${i}`, i % 6 * 320, Math.floor(i / 6) * 300),
      data: { attributes: Array.from({ length: i % 6 }, () => ({ name: 'field' })) } }));
    const edges = nodes.map((node, i) => edge(`reference${i}`, node.id, `c${(i * 5 + 7) % nodes.length}`));
    const boxes = nodes.map(node => nodeWorldRect(node)!);
    const labels: Rect[] = [];
    for (const layout of layoutExpandedUmlEdges(nodes, edges).values()) {
      for (let i = 1; i < layout.points.length; i++) {
        for (const box of boxes) expect(umlSegmentHitsRect(layout.points[i - 1], layout.points[i], box)).toBe(false);
      }
      for (const label of [layout.name, layout.sourceMultiplicity, layout.targetMultiplicity]) {
        if (!label) continue;
        const rect = bounds(label);
        for (const obstacle of [...boxes, ...labels]) expect(overlaps(rect, obstacle)).toBe(false);
        labels.push(rect);
      }
    }
    expect(labels).toHaveLength(108);
  });

  it('keeps the initial expansion of a large Ecore model readable', () => {
    const names = Array.from({ length: 36 }, (_, i) => i % 7 === 0
      ? `ResourceWithAnUnusuallyLongClassName${i}` : `Resource${i}`);
    const content = `<ecore:EPackage xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore" name="large" nsURI="urn:large" nsPrefix="large">
      ${names.map((name, i) => `<eClassifiers xsi:type="ecore:EClass" name="${name}">
        ${Array.from({ length: i % 9 }, (_, field) => `<eStructuralFeatures xsi:type="ecore:EAttribute"
          name="descriptiveAttribute${field}" eType="ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EString"/>`).join('')}
        <eStructuralFeatures xsi:type="ecore:EReference" name="relatedResources"
          eType="#//${names[(i + 7) % names.length]}" upperBound="-1"/>
        <eStructuralFeatures xsi:type="ecore:EReference" name="archivedResources"
          eType="#//${names[(i + 13) % names.length]}" upperBound="-1"/>
      </eClassifiers>`).join('')}
    </ecore:EPackage>`;
    const result = expandMetaModelToNodes(content, 'large.ecore', { x: 0, y: 0 })!;
    expect(result.eObjectNodes).toHaveLength(36);
    expect(result.umlEdges).toHaveLength(72);
    const boxes = result.eObjectNodes.map(node => nodeWorldRect(node)!);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) expect(overlaps(boxes[i], boxes[j])).toBe(false);
    }
    const layouts = layoutExpandedUmlEdges(result.eObjectNodes, result.umlEdges);
    expect(layouts.size).toBe(72);
    const labels: Rect[] = [];
    for (const [id, layout] of layouts) {
      for (let i = 1; i < layout.points.length; i++) {
        const segment = layout.points.slice(i - 1, i + 1);
        const hits = boxes.flatMap((box, index) => umlSegmentHitsRect(segment[0], segment[1], box)
          ? [{ className: result.eObjectNodes[index].data.className, box }] : []);
        expect({ edge: id, segment, hits }).toEqual({ edge: id, segment, hits: [] });
      }
      for (const label of [layout.name, layout.sourceMultiplicity, layout.targetMultiplicity]) {
        expect(label).toBeDefined();
        const rect = bounds(label!);
        const obstructed = [...boxes, ...labels].some(obstacle => overlaps(rect, obstacle));
        expect({ edge: id, label: rect, obstructed }).toEqual({ edge: id, label: rect, obstructed: false });
        labels.push(rect);
      }
    }
    expect(labels).toHaveLength(216);
  });

  it('restores a manually arranged layout and keeps instance-scoped ghosts on their routed associations', () => {
    const first = expandMetaModelToNodes(reactionsLayoutFixture, 'library.ecore', { x: 0, y: 0 }, undefined, undefined, 'instance-1')!;
    first.eObjectNodes[0].position = { x: -500, y: -100 };
    const saved = captureReactionLayout([first.boundingBox, ...first.eObjectNodes, ...first.ghostNodes]);
    const second = expandMetaModelToNodes(reactionsLayoutFixture, 'library.ecore', { x: 0, y: 0 }, undefined, undefined, 'instance-1')!;
    expect(applyReactionLayout(second, saved[second.boundingBox.id])).toBe(true);
    expect(second.eObjectNodes.map(node => node.position)).toEqual(first.eObjectNodes.map(node => node.position));
    const layouts = layoutExpandedUmlEdges(second.eObjectNodes, second.umlEdges);
    for (const link of second.umlEdges) {
      const ref = link.data?.ecore?.eReferenceId;
      if (!ref) continue;
      const ghost = second.ghostNodes.find(node => node.data.ecore.eObjectId === ref)!;
      const mid = layouts.get(link.id)!.midpoint;
      expect(ghost.position).toEqual({ x: mid.x - 6, y: mid.y - 6 });
    }
    second.eObjectNodes[0].position = { x: -600, y: -200 };
    expect(ghostPositionChanges([...second.eObjectNodes, ...second.ghostNodes], second.umlEdges).length).toBeGreaterThan(0);
  });

  it('repairs overlapping saved positions and expands the model box to contain the repaired classes', () => {
    const result = expandMetaModelToNodes(reactionsLayoutFixture, 'library.ecore', { x: 0, y: 0 })!;
    const saved = captureReactionLayout([result.boundingBox, ...result.eObjectNodes])[result.boundingBox.id];
    Object.values(saved.classes).forEach(position => { position.x = 50; position.y = 70; });
    applyReactionLayout(result, saved);
    const boxes = result.eObjectNodes.map(node => nodeWorldRect(node)!);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) expect(overlaps(boxes[i], boxes[j])).toBe(false);
      expect(boxes[i].y + boxes[i].height).toBeLessThanOrEqual(result.boundingBox.position.y + result.boundingBox.data.height!);
    }
  });

  it('preserves class positions through the actual Modeling/Reactions toggle workflow', () => {
    useProjectStore.getState().setActiveId(617);
    let nodes: Node[] = [{ id: 'library-instance', type: 'ecoreFile', position: { x: 30, y: 50 },
      data: { fileName: 'library.ecore', fileContent: reactionsLayoutFixture, nsUri: 'http://example.org/library' } }];
    let edges: Edge[] = [];
    const vsumPositions = new Map();
    const reactionOffsets = new Map();
    const context = () => ({ nodes, setNodes: (update: (current: Node[]) => Node[]) => { nodes = update(nodes); },
      setEdges: (update: (current: Edge[]) => Edge[]) => { edges = update(edges); }, vsumPositions, reactionOffsets });
    enterReactionMode(context());
    expect(nodes.filter(node => node.type === 'eobject')).toHaveLength(12);
    const firstClass = nodes.find(node => node.type === 'eobject')!;
    firstClass.position = { x: -500, y: -100 };
    const arrangement = nodes.filter(node => node.type === 'eobject').map(node => ({ ...node.position }));
    exitReactionMode(context());
    expect(nodes).toHaveLength(1);
    expect(nodes[0].hidden).toBe(false);
    enterReactionMode(context());
    expect(nodes.filter(node => node.type === 'eobject').map(node => node.position)).toEqual(arrangement);
    expect(nodes.find(node => node.type === 'ecoreFile')!.hidden).toBe(true);
    expect(edges.filter(link => link.type === 'uml').length).toBeGreaterThan(0);
    exitReactionMode(context());
    useProjectStore.getState().setActiveId(null);
  });
});
