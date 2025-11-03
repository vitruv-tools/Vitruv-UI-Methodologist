import { FlowEdge, FlowNode } from '../types/flow';

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

    const rootPackage = xmlDoc.querySelector('ecore\\:EPackage, EPackage');
    const packageName = rootPackage?.getAttribute('name') || 'Package';

    // Collect classes first to reference by name
    const classElems = Array.from(xmlDoc.querySelectorAll('eClassifiers[type="ecore:EClass"], eClassifiers EClass, eClassifiers'))
      .filter((el: Element) => (el.getAttribute('xsi:type') || el.getAttribute('type') || '').includes('EClass') || el.tagName.endsWith('EClass') || el.querySelector('eStructuralFeatures')) as Element[];

    const classNameToNodeId = new Map<string, string>();

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

      const node: FlowNode = {
        id: `uml-class-${nodeId++}`,
        type: 'editable',
        position: { x: 100 + (idx % 4) * 350, y: 100 + Math.floor(idx / 4) * 280 },
        data: {
          label: className,
          toolType: 'element',
          toolName: isInterface ? 'interface' : isAbstract ? 'abstract-class' : 'class',
          diagramType: 'uml',
          className: className,
          attributes,
        },
      } as FlowNode;

      nodes.push(node);
      classNameToNodeId.set(className, node.id);
    });

    // Helper: choose best side handles based on node positions
    const getNodeById = (id: string) => nodes.find(n => n.id === id);
    const chooseHandles = (sourceId: string, targetId: string) => {
      const s = getNodeById(sourceId);
      const t = getNodeById(targetId);
      if (!s || !t) return { sourceHandle: undefined, targetHandle: undefined } as const;
      const dx = (t.position?.x ?? 0) - (s.position?.x ?? 0);
      const dy = (t.position?.y ?? 0) - (s.position?.y ?? 0);
      if (Math.abs(dx) >= Math.abs(dy)) {
        return {
          sourceHandle: dx >= 0 ? 'right-source' : 'left-source',
          targetHandle: dx >= 0 ? 'left-target' : 'right-target',
        } as const;
      } else {
        return {
          sourceHandle: dy >= 0 ? 'bottom-source' : 'top-source',
          targetHandle: dy >= 0 ? 'top-target' : 'bottom-target',
        } as const;
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


