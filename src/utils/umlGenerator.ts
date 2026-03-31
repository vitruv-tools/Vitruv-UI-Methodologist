import { FlowEdge, FlowNode } from '../types/flow';

// Layout constants — calibrated to actual rendered node sizes.
// NODE_WIDTH matches the CSS minWidth (240 px).  NODE_HEIGHT is the base
// height; attribute-heavy nodes can be 120–180 px tall, so VERTICAL_SPACING
// is generous to prevent overlaps.
const NODE_WIDTH = 380;
const NODE_HEIGHT = 85;
const HORIZONTAL_SPACING = 80;
const VERTICAL_SPACING = 130;
const START_X = 80;
const START_Y = 60;

// Helper function to find a node by ID
const findNodeById = (nodes: FlowNode[], nodeId: string): FlowNode | undefined => {
  return nodes.find(n => n.id === nodeId);
};

// Calculate tree width for hierarchical layout
const getTreeWidth = (
  nodeId: string,
  parentToChildren: Map<string, string[]>
): number => {
  const children = parentToChildren.get(nodeId) || [];
  if (children.length === 0) return 1;
  return children.reduce((sum, childId) => sum + getTreeWidth(childId, parentToChildren), 0);
};

// Context for tree layout operations
interface TreeLayoutContext {
  nodes: FlowNode[];
  parentToChildren: Map<string, string[]>;
}

// Layout a single tree node and its children recursively.
// Deterministic: no random jitter. Strict level-based Y so all nodes at the
// same inheritance depth share the same horizontal band (jjodel style).
const layoutTreeNode = (
  nodeId: string,
  level: number,
  leftBound: number,
  rightBound: number,
  rootTreeWidth: number,
  startY: number,
  ctx: TreeLayoutContext
): void => {
  const node = findNodeById(ctx.nodes, nodeId);
  if (!node) return;

  const centerX = (leftBound + rightBound) / 2;
  const yPos = startY + level * (NODE_HEIGHT + VERTICAL_SPACING);
  // Offset so the node box is centered in its allocated band
  node.position = { x: centerX - NODE_WIDTH / 2, y: yPos };

  const children = ctx.parentToChildren.get(nodeId) || [];
  if (children.length === 0) return;

  let childX = leftBound;
  children.forEach(childId => {
    const childWidth = getTreeWidth(childId, ctx.parentToChildren);
    const childSpace = (rightBound - leftBound) * (childWidth / Math.max(rootTreeWidth, 1));
    layoutTreeNode(childId, level + 1, childX, childX + childSpace, rootTreeWidth, startY, ctx);
    childX += childSpace;
  });
};

// Layout a connected component of nodes
const layoutComponent = (
  componentNodes: string[],
  startX: number,
  startY: number,
  nodes: FlowNode[],
  edges: FlowEdge[],
  adjacencyMap: Map<string, Set<string>>
): void => {
  if (componentNodes.length === 1) {
    const node = findNodeById(nodes, componentNodes[0]);
    if (!node) return;
    node.position = { x: startX, y: startY };
    return;
  }

  const inheritanceEdges = edges.filter(e => 
    componentNodes.includes(e.source) && 
    componentNodes.includes(e.target) && 
    e.data?.relationshipType === 'inheritance'
  );

  if (inheritanceEdges.length > 0) {
    const childToParent = new Map<string, string>();
    const parentToChildren = new Map<string, string[]>();

    inheritanceEdges.forEach(edge => {
      childToParent.set(edge.source, edge.target);
      const children = parentToChildren.get(edge.target) || [];
      children.push(edge.source);
      parentToChildren.set(edge.target, children);
    });

    const roots = componentNodes.filter(id => !childToParent.has(id));
    let currentX = startX;

    const ctx: TreeLayoutContext = { nodes, parentToChildren };
    roots.forEach(rootId => {
      const treeWidth = getTreeWidth(rootId, parentToChildren);
      const treeSpace = treeWidth * (NODE_WIDTH + HORIZONTAL_SPACING);
      layoutTreeNode(rootId, 0, currentX, currentX + treeSpace, treeWidth, startY, ctx);
      currentX += treeSpace + HORIZONTAL_SPACING * 2;
    });
  } else {
    layoutForceDirected(componentNodes, startX, startY, nodes, adjacencyMap);
  }
};

// Force-directed layout for non-hierarchical (association-only) components.
// Uses circular initial placement so connected nodes naturally converge near
// each other, and equal X/Y repulsion to avoid the previous tall-column look.
const layoutForceDirected = (
  componentNodes: string[],
  startX: number,
  startY: number,
  nodes: FlowNode[],
  adjacencyMap: Map<string, Set<string>>
): void => {
  const positions = new Map<string, { x: number; y: number }>();
  const n = componentNodes.length;

  // Place the highest-degree node at the center of the ring so hub-and-spoke
  // topologies (e.g. many classes pointing to one "System" node) converge with
  // that hub in the middle rather than far to one side.
  const sortedByDegree = [...componentNodes].sort(
    (a, b) => (adjacencyMap.get(b)?.size ?? 0) - (adjacencyMap.get(a)?.size ?? 0)
  );
  const hubNode = sortedByDegree[0];
  const otherNodes = sortedByDegree.slice(1);

  // Tighter initial ring — use a smaller slot so nodes start closer together
  const SLOT = NODE_WIDTH + HORIZONTAL_SPACING / 2;
  const radius = n <= 2 ? SLOT * 0.8 : (SLOT * n) / (2.8 * Math.PI);
  const cx = startX + radius;
  const cy = startY + radius;

  // Hub at center, others evenly on a ring
  positions.set(hubNode, { x: cx, y: cy });
  otherNodes.forEach((nodeId, idx) => {
    const angle = (2 * Math.PI * idx) / Math.max(otherNodes.length, 1) - Math.PI / 2;
    positions.set(nodeId, {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  });

  const ITERATIONS = 200;
  const IDEAL_DISTANCE = NODE_WIDTH + HORIZONTAL_SPACING * 0.6;
  const REPULSION = 9000;
  const ATTRACTION = 0.5;
  const DAMPING = 0.75;

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const forces = new Map<string, { x: number; y: number }>();
    componentNodes.forEach(id => forces.set(id, { x: 0, y: 0 }));

    // Equal vertical/horizontal repulsion (VERTICAL_BIAS = 1)
    applyRepulsionForces(componentNodes, positions, forces, REPULSION, 1.0);
    applyAttractionForces(componentNodes, positions, forces, adjacencyMap, ATTRACTION, IDEAL_DISTANCE);

    const coolingFactor = 1 - (iter / ITERATIONS) * 0.6;
    componentNodes.forEach(nodeId => {
      const pos = positions.get(nodeId)!;
      const force = forces.get(nodeId)!;
      pos.x += force.x * DAMPING * coolingFactor;
      pos.y += force.y * DAMPING * coolingFactor;
    });
  }

  normalizeAndApplyPositions(componentNodes, positions, startX, startY, nodes);
};

// Apply repulsion forces between all node pairs
const applyRepulsionForces = (
  componentNodes: string[],
  positions: Map<string, { x: number; y: number }>,
  forces: Map<string, { x: number; y: number }>,
  repulsion: number,
  verticalBias: number
): void => {
  for (let i = 0; i < componentNodes.length; i++) {
    for (let j = i + 1; j < componentNodes.length; j++) {
      const nodeA = componentNodes[i];
      const nodeB = componentNodes[j];
      const posA = positions.get(nodeA)!;
      const posB = positions.get(nodeB)!;

      const dx = posB.x - posA.x;
      const dy = posB.y - posA.y;
      const dist = Math.max(Math.hypot(dx, dy), 1);

      const force = repulsion / (dist * dist);
      const fx = (dx / dist) * force * 0.15;
      const fy = (dy / dist) * force * verticalBias;

      forces.get(nodeA)!.x -= fx;
      forces.get(nodeA)!.y -= fy;
      forces.get(nodeB)!.x += fx;
      forces.get(nodeB)!.y += fy;
    }
  }
};

// Apply attraction forces for connected nodes
const applyAttractionForces = (
  componentNodes: string[],
  positions: Map<string, { x: number; y: number }>,
  forces: Map<string, { x: number; y: number }>,
  adjacencyMap: Map<string, Set<string>>,
  attraction: number,
  idealDistance: number
): void => {
  componentNodes.forEach(nodeId => {
    const neighbors = adjacencyMap.get(nodeId) || new Set();
    neighbors.forEach(neighborId => {
      if (!componentNodes.includes(neighborId)) return;

      const posA = positions.get(nodeId)!;
      const posB = positions.get(neighborId)!;

      const dx = posB.x - posA.x;
      const dy = posB.y - posA.y;
      const dist = Math.max(Math.hypot(dx, dy), 1);

      const force = attraction * (dist - idealDistance);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      forces.get(nodeId)!.x += fx;
      forces.get(nodeId)!.y += fy;
    });
  });
};

// Normalize positions, compress if too spread out, then apply to nodes.
// MAX_SPAN limits how wide/tall a single component's bounding box can be so
// that fitView doesn't need to zoom out too far.
const MAX_SPAN = 1100;

const normalizeAndApplyPositions = (
  componentNodes: string[],
  positions: Map<string, { x: number; y: number }>,
  startX: number,
  startY: number,
  nodes: FlowNode[]
): void => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  positions.forEach(pos => {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + NODE_WIDTH);
    maxY = Math.max(maxY, pos.y + NODE_HEIGHT);
  });

  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const scale = Math.min(1, MAX_SPAN / Math.max(spanX, spanY, 1));

  componentNodes.forEach(nodeId => {
    const node = findNodeById(nodes, nodeId);
    const pos = positions.get(nodeId);
    if (!node || !pos) return;
    node.position = {
      x: (pos.x - minX) * scale + startX,
      y: (pos.y - minY) * scale + startY,
    };
  });
};

// Intelligent layout algorithm for UML diagrams
function applyIntelligentLayout(nodes: FlowNode[], edges: FlowEdge[]): void {
  if (nodes.length === 0) return;

  // Build adjacency map
  const adjacencyMap = new Map<string, Set<string>>();
  nodes.forEach(node => adjacencyMap.set(node.id, new Set()));

  edges.forEach(edge => {
    adjacencyMap.get(edge.source)?.add(edge.target);
    adjacencyMap.get(edge.target)?.add(edge.source);
  });

  // Find connected components
  const visited = new Set<string>();
  const components: string[][] = [];
  const isolatedNodes: string[] = [];

  nodes.forEach(node => {
    const connections = adjacencyMap.get(node.id)?.size || 0;
    if (connections === 0) {
      isolatedNodes.push(node.id);
      visited.add(node.id);
    }
  });

  // BFS for components
  nodes.forEach(startNode => {
    if (visited.has(startNode.id)) return;

    const component: string[] = [];
    const queue = [startNode.id];
    visited.add(startNode.id);

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      component.push(nodeId);

      adjacencyMap.get(nodeId)?.forEach(neighborId => {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push(neighborId);
        }
      });
    }

    if (component.length > 0) {
      components.push(component);
    }
  });

  // Sort components by size (largest first for better layout)
  components.sort((a, b) => b.length - a.length);

  // Layout each component with proper spacing
  let currentY = START_Y;
  components.forEach((component) => {
    layoutComponent(component, START_X, currentY, nodes, edges, adjacencyMap);
    
    // Find bounds of this component
    let maxX = 0, maxY = 0;
    component.forEach(nodeId => {
      const node = findNodeById(nodes, nodeId);
      if (!node) return;
      maxX = Math.max(maxX, node.position.x);
      maxY = Math.max(maxY, node.position.y);
    });
    
    // Leave a clear gap between disconnected components
    currentY = maxY + NODE_HEIGHT + VERTICAL_SPACING * 2;
  });

  // Layout isolated nodes in a clean grid — no jitter
  if (isolatedNodes.length > 0) {
    const cols = Math.ceil(Math.sqrt(isolatedNodes.length));
    isolatedNodes.forEach((nodeId, idx) => {
      const node = findNodeById(nodes, nodeId);
      if (!node) return;
      const row = Math.floor(idx / cols);
      const col = idx % cols;
      node.position = {
        x: START_X + col * (NODE_WIDTH + HORIZONTAL_SPACING),
        y: currentY + row * (NODE_HEIGHT + VERTICAL_SPACING),
      };
    });
  }

  // Post-process: resolve any remaining box overlaps with equal X/Y push.
  // Use a generous radius so even tall attribute-heavy boxes don't overlap.
  const MIN_BOX_DIST = NODE_WIDTH * 0.75;
  let hasOverlap = true;
  let overlapIter = 0;
  const MAX_OVERLAP_ITERATIONS = 30;

  while (hasOverlap && overlapIter < MAX_OVERLAP_ITERATIONS) {
    hasOverlap = false;
    overlapIter++;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const nodeA = nodes[i];
        const nodeB = nodes[j];

        const dx = nodeB.position.x - nodeA.position.x;
        const dy = nodeB.position.y - nodeA.position.y;
        const distance = Math.hypot(dx, dy);

        if (distance < MIN_BOX_DIST && distance > 0.001) {
          hasOverlap = true;
          const push = (MIN_BOX_DIST - distance) / 2 + 4;
          const nx = dx / distance;
          const ny = dy / distance;
          nodeA.position.x -= nx * push;
          nodeA.position.y -= ny * push;
          nodeB.position.x += nx * push;
          nodeB.position.y += ny * push;
        }
      }
    }
  }
}

export const generateUMLFromEcore = (ecoreContent: string): { nodes: FlowNode[]; edges: FlowEdge[] } => {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(ecoreContent, 'text/xml');

    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
      throw new Error('Invalid XML content');
    }

    const nodes: FlowNode[] = [];
    const edges: FlowEdge[] = [];
    let nodeId = 1;

    const rootPackage = xmlDoc.querySelector(String.raw`ecore\:EPackage, EPackage`);
    const packageName = rootPackage?.getAttribute('name') || 'Package';

    // Collect classes first to reference by name
    const classElems = Array.from(xmlDoc.querySelectorAll('eClassifiers[type="ecore:EClass"], eClassifiers EClass, eClassifiers'))
      .filter((el: Element) => (el.getAttribute('xsi:type') || el.getAttribute('type') || '').includes('EClass') || el.tagName.endsWith('EClass') || el.querySelector('eStructuralFeatures'));

    const classNameToNodeId = new Map<string, string>();

    // First pass: Create nodes with temporary positions
    classElems.forEach((cls, idx) => {
      const className = cls.getAttribute('name') || `Class${idx + 1}`;
      const isAbstract = (cls.getAttribute('abstract') || 'false') === 'true';
      const isInterface = (cls.getAttribute('interface') || 'false') === 'true';

      const attributes: string[] = [];
      // Parse EAttributes (not EReferences) from eStructuralFeatures
      const allFeatures = cls.querySelectorAll('eStructuralFeatures');
      allFeatures.forEach((attr, aIdx) => {
        // Check if this is an EAttribute (not an EReference)
        const featureType = attr.getAttribute('xsi:type') || attr.getAttribute('type') || '';
        const isAttribute = featureType.includes('EAttribute') || 
                           (!featureType.includes('EReference') && 
                            attr.hasAttribute('eType') && 
                            !attr.hasAttribute('eReferenceType'));
        
        if (!isAttribute) return; // Skip if it's an EReference
        
        const attrName = attr.getAttribute('name') || `attr${aIdx + 1}`;
        const eType = attr.getAttribute('eType') || attr.getAttribute('type') || 'EString';
        
        // Parse type reference - remove the # prefix if present
        let typeName = eType.split('#').pop() || eType;
        // Remove any // prefix that might exist
        typeName = typeName.replace(/^\/\//, '');
        
        const lower = attr.getAttribute('lowerBound');
        const upper = attr.getAttribute('upperBound');
        
        // Format multiplicity - if we have bounds, use them
        let mult = '';
        if (lower !== null && upper !== null) {
          mult = ` [${lower}..${upper}]`;
        } else if (lower !== null || upper !== null) {
          mult = ` [${lower || '1'}..${upper || '*'}]`;
        }
        
        attributes.push(`+ ${attrName}: ${typeName}${mult}`);
      });

      // Determine tool name based on class type
      let toolName = 'class';
      if (isInterface) {
        toolName = 'interface';
      } else if (isAbstract) {
        toolName = 'abstract-class';
      }

      const node: FlowNode = {
        id: `uml-class-${nodeId++}`,
        type: 'editable',
        position: { x: 0, y: 0 }, // Will be calculated later
        data: {
          label: className,
          toolType: 'element',
          toolName,
          diagramType: 'uml',
          className: className,
          attributes,
        },
      } as FlowNode;

      nodes.push(node);
      classNameToNodeId.set(className, node.id);
    });

    // Helper: choose best side handles based on node positions (will be called after layout)
    const chooseHandles = (sourceId: string, targetId: string) => {
      const s = nodes.find(n => n.id === sourceId);
      const t = nodes.find(n => n.id === targetId);
      if (!s || !t) return { sourceHandle: undefined, targetHandle: undefined } as const;
      const dx = (t.position?.x ?? 0) - (s.position?.x ?? 0);
      const dy = (t.position?.y ?? 0) - (s.position?.y ?? 0);
      
      // Use angle for more precise handle selection
      const angle = Math.atan2(dy, dx);
      const angleDeg = (angle * 180 / Math.PI + 360) % 360;
      
      if (angleDeg >= 315 || angleDeg < 45) {
        return { sourceHandle: 'right-source', targetHandle: 'left-target' } as const;
      } else if (angleDeg >= 45 && angleDeg < 135) {
        return { sourceHandle: 'bottom-source', targetHandle: 'top-target' } as const;
      } else if (angleDeg >= 135 && angleDeg < 225) {
        return { sourceHandle: 'left-source', targetHandle: 'right-target' } as const;
      } else {
        return { sourceHandle: 'top-source', targetHandle: 'bottom-target' } as const;
      }
    };

    // Associations via EReferences
    classElems.forEach((cls) => {
      const sourceName = cls.getAttribute('name') || '';
      const sourceId = classNameToNodeId.get(sourceName);
      if (!sourceId) return;
      
      // Find all eStructuralFeatures that are EReferences
      const allFeatures = cls.querySelectorAll('eStructuralFeatures');
      allFeatures.forEach((ref) => {
        // Check if this is an EReference
        const featureType = ref.getAttribute('xsi:type') || ref.getAttribute('type') || '';
        const isReference = featureType.includes('EReference');
        
        if (!isReference) return; // Skip if it's not an EReference
        
        const eType = ref.getAttribute('eType') || '';
        // Parse type reference - remove the # prefix if present
        let targetType = eType.split('#').pop() || eType;
        // Remove any // prefix that might exist
        targetType = targetType.replace(/^\/\//, '');
        
        const targetId = classNameToNodeId.get(targetType || '');
        if (!targetId) return;
        
        const lower = ref.getAttribute('lowerBound');
        const upper = ref.getAttribute('upperBound');
        const containment = (ref.getAttribute('containment') || 'false') === 'true';
        
        // Determine relationship type
        let relationshipType = 'association';
        if (containment) {
          relationshipType = 'composition';
        }

        // Normalize multiplicity per UML (place at target end only)
        const normalizeUpper = (u: string | null) => {
          if (u === null) return undefined;
          if (u === '*' || u === '-1') return '*';
          return u;
        };
        const normLower = lower ?? undefined;
        const normUpper = normalizeUpper(upper);
        let multiplicity: string | undefined = undefined;
        if (normLower !== undefined || normUpper !== undefined) {
          const lo = normLower ?? '1';
          const hi = normUpper ?? '1';
          multiplicity = lo === hi ? lo : `${lo}..${hi}`;
        }

        const handles = chooseHandles(sourceId, targetId);
        edges.push({
          id: `uml-edge-${nodeId++}`,
          source: sourceId,
          target: targetId,
          type: 'uml',
          data: {
            relationshipType: relationshipType,
            targetMultiplicity: multiplicity,
          },
          sourceHandle: handles.sourceHandle,
          targetHandle: handles.targetHandle,
        } as any);
      });
    });

    // Generalizations via eSuperTypes
    classElems.forEach((cls) => {
      const subName = cls.getAttribute('name') || '';
      const subId = classNameToNodeId.get(subName);
      if (!subId) return;
      const superTypes = (cls.getAttribute('eSuperTypes') || '').split(' ').filter(Boolean);
      superTypes.forEach((sup) => {
        // Parse super type reference - remove # or // prefix
        let supType = sup.split('#').pop() || sup;
        supType = supType.replace(/^\/\//, '');
        const supId = classNameToNodeId.get(supType);
        if (!supId) return;
        const handles = chooseHandles(subId, supId);
        edges.push({
          id: `uml-gen-${nodeId++}`,
          source: subId,
          target: supId,
          type: 'uml',
          data: { relationshipType: 'inheritance' },
          sourceHandle: handles.sourceHandle,
          targetHandle: handles.targetHandle,
        } as any);
      });
    });

    // Collect EEnum names defined in this model — these are valid attribute
    // types alongside ECore primitives, but class names are NOT (those are
    // expressed as EReferences / edges, not attribute types).
    const enumElems = Array.from(xmlDoc.querySelectorAll('eClassifiers')).filter((el: Element) => {
      const t = el.getAttribute('xsi:type') || el.getAttribute('type') || '';
      return t.includes('EEnum') || el.tagName.toLowerCase().includes('eenum');
    });
    const modelEnumNames = enumElems
      .map(e => e.getAttribute('name'))
      .filter((n): n is string => Boolean(n));

    nodes.forEach(n => { (n.data as any).availableEnumTypes = modelEnumNames; });

    // Apply intelligent layout algorithm
    applyIntelligentLayout(nodes, edges);

    // Recalculate edge handles based on final positions
    edges.forEach(edge => {
      const handles = chooseHandles(edge.source, edge.target);
      edge.sourceHandle = handles.sourceHandle;
      edge.targetHandle = handles.targetHandle;
    });

    // Optional package node
    if (nodes.length > 0) {
      const pkgNode: FlowNode = {
        id: `uml-pkg-${nodeId++}`,
        type: 'editable',
        position: { x: 80, y: 40 },
        data: {
          label: packageName,
          toolType: 'element',
          toolName: 'package',
          packageName,
          diagramType: 'uml',
        },
      } as FlowNode;
      nodes.unshift(pkgNode);
    }

    return { nodes, edges };
  } catch (error) {
    console.error('Error generating UML from Ecore:', error);
    return { nodes: [], edges: [] };
  }
};


