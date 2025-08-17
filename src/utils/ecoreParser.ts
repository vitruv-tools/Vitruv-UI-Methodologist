import { EcoreFileContent, EcorePackage, EcoreElementData, FlowNode, FlowEdge } from '../types/flow';

/**
 * Parse .ecore file content and convert it to diagram data
 * @param ecoreContent - The content of the .ecore file
 * @returns Object containing nodes and edges for the diagram
 */
export const parseEcoreFile = (ecoreContent: string): { nodes: FlowNode[]; edges: FlowEdge[] } => {
  try {
    // Parse XML content
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(ecoreContent, 'text/xml');
    
    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
      throw new Error('Invalid XML content');
    }

    const nodes: FlowNode[] = [];
    const edges: FlowEdge[] = [];
    let nodeId = 1;

    // Extract root package information
    const rootPackage = xmlDoc.querySelector('ecore:EPackage');
    if (!rootPackage) {
      throw new Error('No EPackage found in .ecore file');
    }

    const packageName = rootPackage.getAttribute('name') || 'RootPackage';
    const nsURI = rootPackage.getAttribute('nsURI') || '';
    const nsPrefix = rootPackage.getAttribute('nsPrefix') || '';

    // Parse packages and classes
    const packages = rootPackage.querySelectorAll('eClassifiers');
    packages.forEach((pkg, index) => {
      const pkgName = pkg.getAttribute('name') || `Package${index}`;
      
      // Create package node
      const packageNode: FlowNode = {
        id: `package-${nodeId++}`,
        type: 'default',
        position: { x: 100 + (index * 300), y: 100 },
        data: {
          label: pkgName,
          ecoreData: {
            name: pkgName,
            type: 'EPackage',
            package: packageName
          }
        }
      };
      nodes.push(packageNode);

      // Parse classes in this package
      const classes = pkg.querySelectorAll('eStructuralFeatures');
      classes.forEach((cls, classIndex) => {
        const className = cls.getAttribute('name') || `Class${classIndex}`;
        const isAbstract = cls.getAttribute('abstract') === 'true';
        const isInterface = cls.getAttribute('interface') === 'true';
        
        // Create class node
        const classNode: FlowNode = {
          id: `class-${nodeId++}`,
          type: 'default',
          position: { 
            x: 150 + (index * 300), 
            y: 200 + (classIndex * 150) 
          },
          data: {
            label: className,
            ecoreData: {
              name: className,
              type: 'EClass',
              package: pkgName,
              isAbstract,
              isInterface
            }
          }
        };
        nodes.push(classNode);

        // Create edge from package to class
        edges.push({
          id: `edge-${nodeId++}`,
          source: packageNode.id,
          target: classNode.id,
          type: 'default',
          label: 'contains'
        });

        // Parse attributes
        const attributes = cls.querySelectorAll('eAttributes');
        attributes.forEach((attr, attrIndex) => {
          const attrName = attr.getAttribute('name') || `attr${attrIndex}`;
          const attrType = attr.getAttribute('eType') || 'EString';
          
          const attrNode: FlowNode = {
            id: `attr-${nodeId++}`,
            type: 'default',
            position: { 
              x: 200 + (index * 300), 
              y: 350 + (classIndex * 150) + (attrIndex * 50) 
            },
            data: {
              label: `${attrName}: ${attrType}`,
              ecoreData: {
                name: attrName,
                type: 'EAttribute',
                package: pkgName
              }
            }
          };
          nodes.push(attrNode);

          // Create edge from class to attribute
          edges.push({
            id: `edge-${nodeId++}`,
            source: classNode.id,
            target: attrNode.id,
            type: 'default',
            label: 'has'
          });
        });

        // Parse references
        const references = cls.querySelectorAll('eReferences');
        references.forEach((ref, refIndex) => {
          const refName = ref.getAttribute('name') || `ref${refIndex}`;
          const refType = ref.getAttribute('eType') || 'EClass';
          
          const refNode: FlowNode = {
            id: `ref-${nodeId++}`,
            type: 'default',
            position: { 
              x: 250 + (index * 300), 
              y: 350 + (classIndex * 150) + (refIndex * 50) 
            },
            data: {
              label: `${refName}: ${refType}`,
              ecoreData: {
                name: refName,
                type: 'EReference',
                package: pkgName
              }
            }
          };
          nodes.push(refNode);

          // Create edge from class to reference
          edges.push({
            id: `edge-${nodeId++}`,
            source: classNode.id,
            target: refNode.id,
            type: 'default',
            label: 'references'
          });
        });
      });
    });

    return { nodes, edges };
  } catch (error) {
    console.error('Error parsing .ecore file:', error);
    // Return a simple error node
    return {
      nodes: [{
        id: 'error-1',
        type: 'default',
        position: { x: 100, y: 100 },
        data: {
          label: 'Error parsing .ecore file',
          ecoreData: {
            name: 'Error',
            type: 'EClass',
            package: 'Error'
          }
        }
      }],
      edges: []
    };
  }
};

/**
 * Create a simple diagram representation from .ecore content
 * This is a fallback method if XML parsing fails
 */
export const createSimpleEcoreDiagram = (ecoreContent: string): { nodes: FlowNode[]; edges: FlowEdge[] } => {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  let nodeId = 1;

  // Create a root node
  const rootNode: FlowNode = {
    id: `root-${nodeId++}`,
    type: 'default',
    position: { x: 200, y: 100 },
    data: {
      label: 'Ecore Model',
      ecoreData: {
        name: 'EcoreModel',
        type: 'EPackage'
      }
    }
  };
  nodes.push(rootNode);

  // Try to extract class names from the content
  const classMatches = ecoreContent.match(/name="([^"]+)"/g);
  if (classMatches) {
    classMatches.forEach((match, index) => {
      const className = match.replace('name="', '').replace('"', '');
      if (className && !className.includes('xmlns') && !className.includes('ecore')) {
        const classNode: FlowNode = {
          id: `class-${nodeId++}`,
          type: 'default',
          position: { x: 100 + (index * 200), y: 250 },
          data: {
            label: className,
            ecoreData: {
              name: className,
              type: 'EClass',
              package: 'EcoreModel'
            }
          }
        };
        nodes.push(classNode);

        // Create edge from root to class
        edges.push({
          id: `edge-${nodeId++}`,
          source: rootNode.id,
          target: classNode.id,
          type: 'default',
          label: 'contains'
        });
      }
    });
  }

  return { nodes, edges };
};
