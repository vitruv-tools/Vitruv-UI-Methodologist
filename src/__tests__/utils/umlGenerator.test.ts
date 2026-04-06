import { generateUMLFromEcore as generateUMLFromEcoreWithName } from '../../utils/umlGenerator';

const generateUMLFromEcore = (ecoreContent: string) =>
  generateUMLFromEcoreWithName('test.ecore', ecoreContent);

const getData = (node: any) => node?.data as any;

describe('generateUMLFromEcore', () => {

  describe('invalid input', () => {
    it('should return empty nodes and edges for invalid XML', () => {
      const result = generateUMLFromEcore('not valid xml <<<');
      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });

    it('should return empty nodes and edges for empty string', () => {
      const result = generateUMLFromEcore('');
      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });
  });

  describe('single class', () => {
    const singleClassEcore = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmi:version="2.0"
    xmlns:xmi="http://www.omg.org/XMI"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"
    name="testpackage">
  <eClassifiers xsi:type="ecore:EClass" name="Person">
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="name" eType="ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EString"/>
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="age" eType="ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EInt"/>
  </eClassifiers>
</ecore:EPackage>`;

    it('should create a node for the class', () => {
      const { nodes } = generateUMLFromEcore(singleClassEcore);
      const classNode = nodes.find(n => getData(n).label === 'Person');
      expect(classNode).toBeDefined();
    });

    it('should create a package node', () => {
      const { nodes } = generateUMLFromEcore(singleClassEcore);
      const pkgNode = nodes.find(n => getData(n).toolName === 'package');
      expect(pkgNode).toBeDefined();
      expect(getData(pkgNode).label).toBe('testpackage');
    });

    it('should parse attributes correctly', () => {
      const { nodes } = generateUMLFromEcore(singleClassEcore);
      const classNode = nodes.find(n => getData(n).label === 'Person');
      expect(getData(classNode).attributes).toContain('+ name: EString');
      expect(getData(classNode).attributes).toContain('+ age: EInt');
    });

    it('should set toolType to element', () => {
      const { nodes } = generateUMLFromEcore(singleClassEcore);
      const classNode = nodes.find(n => getData(n).label === 'Person');
      expect(getData(classNode).toolType).toBe('element');
      expect(getData(classNode).toolName).toBe('class');
    });

    it('should set node type to editable', () => {
      const { nodes } = generateUMLFromEcore(singleClassEcore);
      const classNode = nodes.find(n => getData(n).label === 'Person');
      expect(classNode?.type).toBe('editable');
    });
  });

  describe('abstract class and interface', () => {
    const abstractEcore = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmi:version="2.0"
    xmlns:xmi="http://www.omg.org/XMI"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"
    name="testpackage">
  <eClassifiers xsi:type="ecore:EClass" name="AbstractAnimal" abstract="true"/>
  <eClassifiers xsi:type="ecore:EClass" name="Flyable" interface="true"/>
</ecore:EPackage>`;

    it('should set toolName to abstract-class for abstract classes', () => {
      const { nodes } = generateUMLFromEcore(abstractEcore);
      const abstractNode = nodes.find(n => getData(n).label === 'AbstractAnimal');
      expect(getData(abstractNode).toolName).toBe('abstract-class');
    });

    it('should set toolName to interface for interfaces', () => {
      const { nodes } = generateUMLFromEcore(abstractEcore);
      const interfaceNode = nodes.find(n => getData(n).label === 'Flyable');
      expect(getData(interfaceNode).toolName).toBe('interface');
    });
  });

  describe('inheritance', () => {
    const inheritanceEcore = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmi:version="2.0"
    xmlns:xmi="http://www.omg.org/XMI"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"
    name="testpackage">
  <eClassifiers xsi:type="ecore:EClass" name="Animal"/>
  <eClassifiers xsi:type="ecore:EClass" name="Dog" eSuperTypes="#//Animal"/>
</ecore:EPackage>`;

    it('should create an inheritance edge', () => {
      const { edges } = generateUMLFromEcore(inheritanceEcore);
      const inheritanceEdge = edges.find(e => e.data?.relationshipType === 'inheritance');
      expect(inheritanceEdge).toBeDefined();
    });

    it('should set correct source and target for inheritance', () => {
      const { nodes, edges } = generateUMLFromEcore(inheritanceEcore);
      const dogNode = nodes.find(n => getData(n).label === 'Dog');
      const animalNode = nodes.find(n => getData(n).label === 'Animal');
      const inheritanceEdge = edges.find(e => e.data?.relationshipType === 'inheritance');

      expect(inheritanceEdge?.source).toBe(dogNode?.id);
      expect(inheritanceEdge?.target).toBe(animalNode?.id);
    });

    it('should not create extra nodes for inheritance relationships', () => {
      const { nodes } = generateUMLFromEcore(inheritanceEcore);
      const classNodes = nodes.filter(n => getData(n).toolName !== 'package');
      expect(classNodes).toHaveLength(2);
    });
  });

  describe('associations', () => {
    const associationEcore = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmi:version="2.0"
    xmlns:xmi="http://www.omg.org/XMI"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"
    name="testpackage">
  <eClassifiers xsi:type="ecore:EClass" name="Order">
    <eStructuralFeatures xsi:type="ecore:EReference" name="items" eType="#//Item" lowerBound="0" upperBound="-1"/>
  </eClassifiers>
  <eClassifiers xsi:type="ecore:EClass" name="Item"/>
</ecore:EPackage>`;

    it('should create an association edge for EReference', () => {
      const { edges } = generateUMLFromEcore(associationEcore);
      const assocEdge = edges.find(e => e.data?.relationshipType === 'association');
      expect(assocEdge).toBeDefined();
    });

    it('should set multiplicity correctly for 0..*', () => {
      const { edges } = generateUMLFromEcore(associationEcore);
      const assocEdge = edges.find(e => e.data?.relationshipType === 'association');
      expect(assocEdge?.data?.targetMultiplicity).toBe('0..*');
    });

    it('should not add EReference as attribute', () => {
      const { nodes } = generateUMLFromEcore(associationEcore);
      const orderNode = nodes.find(n => getData(n).label === 'Order');
      const attributes: string[] = getData(orderNode).attributes ?? [];
      const hasReferenceAsAttr = attributes.some(a => a.includes('items'));
      expect(hasReferenceAsAttr).toBe(false);
    });
  });

  describe('composition', () => {
    const compositionEcore = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmi:version="2.0"
    xmlns:xmi="http://www.omg.org/XMI"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"
    name="testpackage">
  <eClassifiers xsi:type="ecore:EClass" name="Library">
    <eStructuralFeatures xsi:type="ecore:EReference" name="books" eType="#//Book" containment="true" upperBound="-1"/>
  </eClassifiers>
  <eClassifiers xsi:type="ecore:EClass" name="Book"/>
</ecore:EPackage>`;

    it('should create a composition edge for containment reference', () => {
      const { edges } = generateUMLFromEcore(compositionEcore);
      const compEdge = edges.find(e => e.data?.relationshipType === 'composition');
      expect(compEdge).toBeDefined();
    });

    it('should set correct source and target for composition', () => {
      const { nodes, edges } = generateUMLFromEcore(compositionEcore);
      const libraryNode = nodes.find(n => getData(n).label === 'Library');
      const bookNode = nodes.find(n => getData(n).label === 'Book');
      const compEdge = edges.find(e => e.data?.relationshipType === 'composition');

      expect(compEdge?.source).toBe(libraryNode?.id);
      expect(compEdge?.target).toBe(bookNode?.id);
    });
  });

  describe('node positions', () => {
    const multiClassEcore = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmi:version="2.0"
    xmlns:xmi="http://www.omg.org/XMI"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"
    name="testpackage">
  <eClassifiers xsi:type="ecore:EClass" name="ClassA"/>
  <eClassifiers xsi:type="ecore:EClass" name="ClassB"/>
  <eClassifiers xsi:type="ecore:EClass" name="ClassC"/>
</ecore:EPackage>`;

    it('should assign positions to all nodes', () => {
      const { nodes } = generateUMLFromEcore(multiClassEcore);
      nodes.forEach(node => {
        expect(node.position).toBeDefined();
        expect(typeof node.position.x).toBe('number');
        expect(typeof node.position.y).toBe('number');
      });
    });

    it('should not place all class nodes at origin', () => {
      const { nodes } = generateUMLFromEcore(multiClassEcore);
      const classNodes = nodes.filter(n => getData(n).toolName !== 'package');
      const allAtOrigin = classNodes.every(n => n.position.x === 0 && n.position.y === 0);
      expect(allAtOrigin).toBe(false);
    });
  });

  describe('edge handles', () => {
    const edgeEcore = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmi:version="2.0"
    xmlns:xmi="http://www.omg.org/XMI"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"
    name="testpackage">
  <eClassifiers xsi:type="ecore:EClass" name="Parent"/>
  <eClassifiers xsi:type="ecore:EClass" name="Child" eSuperTypes="#//Parent"/>
</ecore:EPackage>`;

    it('should assign sourceHandle and targetHandle to edges', () => {
      const { edges } = generateUMLFromEcore(edgeEcore);
      edges.forEach(edge => {
        expect(edge.sourceHandle).toBeDefined();
        expect(edge.targetHandle).toBeDefined();
      });
    });
  });

});