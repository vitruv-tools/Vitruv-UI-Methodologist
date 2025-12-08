import { FlowEdge, FlowNode } from '../types/flow';

// Layout constants
const NODE_WIDTH = 280;
const NODE_HEIGHT = 220;
const HORIZONTAL_SPACING = 30;  // Very tight - boxes almost touching on X
const VERTICAL_SPACING = 280;   // Large vertical spacing for big Y differences
const START_X = 150;
const START_Y = 150;

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

// Layout a single tree node and its children recursively
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
  const verticalJitter = (Math.random() - 0.5) * 160; // ±80px variation
  const yPos = startY + level * (NODE_HEIGHT + VERTICAL_SPACING) + verticalJitter;
  node.position = { x: centerX, y: yPos };

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
    const verticalJitter = (Math.random() - 0.5) * 180;
    node.position = { x: startX, y: startY + verticalJitter };
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

// Force-directed layout for non-hierarchical components
const layoutForceDirected = (
  componentNodes: string[],
  startX: number,
  startY: number,
  nodes: FlowNode[],
  adjacencyMap: Map<string, Set<string>>
): void => {
  const positions = new Map<string, { x: number; y: number }>();
  
  const gridSize = Math.min(Math.max(1, Math.ceil(componentNodes.length / 4)), 2);
  componentNodes.forEach((nodeId, idx) => {
    const row = Math.floor(idx / gridSize);
    const col = idx % gridSize;
    const verticalJitter = (Math.random() - 0.5) * 200;
    positions.set(nodeId, {
      x: startX + col * (NODE_WIDTH + HORIZONTAL_SPACING),
      y: startY + row * (NODE_HEIGHT + VERTICAL_SPACING) + verticalJitter
    });
  });

  const ITERATIONS = 150;
  const IDEAL_DISTANCE = NODE_WIDTH + HORIZONTAL_SPACING * 0.4;
  const REPULSION = 28000;
  const ATTRACTION = 0.65;
  const DAMPING = 0.85;
  const VERTICAL_BIAS = 2;

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const forces = new Map<string, { x: number; y: number }>();
    componentNodes.forEach(id => forces.set(id, { x: 0, y: 0 }));

    applyRepulsionForces(componentNodes, positions, forces, REPULSION, VERTICAL_BIAS);
    applyAttractionForces(componentNodes, positions, forces, adjacencyMap, ATTRACTION, IDEAL_DISTANCE);

    const coolingFactor = 1 - (iter / ITERATIONS) * 0.3;
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

// Normalize positions and apply to nodes
const normalizeAndApplyPositions = (
  componentNodes: string[],
  positions: Map<string, { x: number; y: number }>,
  startX: number,
  startY: number,
  nodes: FlowNode[]
): void => {
  let minX = Infinity, minY = Infinity;
  positions.forEach(pos => {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
  });

  componentNodes.forEach(nodeId => {
    const node = findNodeById(nodes, nodeId);
    const pos = positions.get(nodeId);
    if (!node || !pos) return;
    node.position = {
      x: pos.x - minX + startX,
      y: pos.y - minY + startY
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
    
    // Add moderate vertical spacing between components like the picture
    currentY = maxY + NODE_HEIGHT + VERTICAL_SPACING * 1.5;
  });

  // Layout isolated nodes in very narrow columns (1-2 columns) with large Y variation
  if (isolatedNodes.length > 0) {
    const itemsPerRow = Math.min(Math.max(1, Math.ceil(isolatedNodes.length / 3)), 2); // 1-2 columns only
    isolatedNodes.forEach((nodeId, idx) => {
      const node = findNodeById(nodes, nodeId);
      if (!node) return;
      const row = Math.floor(idx / itemsPerRow);
      const col = idx % itemsPerRow;
      // Add large random Y offset for big vertical differences
      const verticalJitter = (Math.random() - 0.5) * 180; // ±90px variation
      node.position = {
        x: START_X + col * (NODE_WIDTH + HORIZONTAL_SPACING), // Same X for column
        y: currentY + row * (NODE_HEIGHT + VERTICAL_SPACING) + verticalJitter // Large Y variation
      };
    });
  }

  // Post-process: Remove overlaps - keep columns, large Y separation
  const MIN_DISTANCE = Math.min(HORIZONTAL_SPACING, VERTICAL_SPACING) * 0.4;
  const VERTICAL_PUSH_BIAS = 2.2; // Strong vertical bias for large Y differences
  let hasOverlap = true;
  let iterations = 0;
  const MAX_OVERLAP_ITERATIONS = 25; // Fewer iterations to preserve structure

  while (hasOverlap && iterations < MAX_OVERLAP_ITERATIONS) {
    hasOverlap = false;
    iterations++;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const nodeA = nodes[i];
        const nodeB = nodes[j];

        const dx = nodeB.position.x - nodeA.position.x;
        const dy = nodeB.position.y - nodeA.position.y;
        const distance = Math.hypot(dx, dy);

        if (distance < MIN_DISTANCE) {
          hasOverlap = true;
          // Push nodes apart - keep same X column, large Y separation
          const pushDistance = (MIN_DISTANCE - distance) / 2 + 5;
          const angle = Math.atan2(dy, dx);
          
          const pushX = Math.cos(angle) * pushDistance * 0.2; // Very weak horizontal - stay in column
          const pushY = Math.sin(angle) * pushDistance * VERTICAL_PUSH_BIAS; // Strong vertical - large Y diff
          
          nodeA.position.x -= pushX;
          nodeA.position.y -= pushY;
          nodeB.position.x += pushX;
          nodeB.position.y += pushY;
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


