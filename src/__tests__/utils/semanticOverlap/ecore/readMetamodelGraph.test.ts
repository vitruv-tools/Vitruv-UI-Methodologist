import { EcoreReadError, MAX_CLASSES, readMetamodelGraph } from '../../../../utils/semanticOverlap/ecore/readMetamodelGraph';
import { ecoreExcerpt, refFor, umlExcerpt } from '../fixtures';

const wrap = (body: string, name = 'root') => `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmi:version="2.0" xmlns:xmi="http://www.omg.org/XMI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore" name="${name}" nsURI="http://example.org/${name}">${body}</ecore:EPackage>`;

describe('readMetamodelGraph', () => {
  it('reads classes, features and types of the Fig. 1 Ecore excerpt', () => {
    const graph = ecoreExcerpt();
    expect(graph.rootPackage).toBe('ecore');
    expect(graph.nsUri).toBe('http://example.org/ecore-excerpt');
    expect(graph.classes.map(c => c.qualifiedName)).toEqual(['ecore.EClass', 'ecore.EReference', 'ecore.EAttribute']);
    const eClass = graph.classes[0];
    expect(eClass.attributes.map(a => a.name)).toEqual(['abstract']);
    expect(eClass.references.map(r => [r.name, r.typeName, r.upper, r.containment])).toEqual([
      ['eAttributes', 'EAttribute', -1, true],
      ['eReferences', 'EReference', -1, true],
    ]);
    expect(eClass.attributes[0]).toMatchObject({ typeName: 'EBoolean', typeCategory: 'primitive', lower: 0, upper: 1 });
  });

  it('detects enum-typed attributes and enum literals', () => {
    const graph = umlExcerpt();
    const property = graph.classes.find(c => c.name === 'Property')!;
    expect(property.attributes[0]).toMatchObject({ name: 'aggregation', typeCategory: 'enum', typeName: 'AggregationKind' });
    expect(graph.enums).toEqual([{ name: 'AggregationKind', qualifiedName: 'uml.AggregationKind', literals: ['none', 'shared', 'composite'] }]);
    const association = graph.classes.find(c => c.name === 'Association')!;
    expect(association.references[0]).toMatchObject({ lower: 2, upper: -1, typeCategory: 'class' });
  });

  it('reads subpackages, supertypes, operations and opposites', () => {
    const graph = readMetamodelGraph(wrap(`
      <eClassifiers xsi:type="ecore:EClass" name="Base" abstract="true">
        <eOperations name="validate"><eParameters name="context"/></eOperations>
      </eClassifiers>
      <eSubpackages name="sub" nsURI="http://example.org/sub">
        <eClassifiers xsi:type="ecore:EClass" name="Child" eSuperTypes="#//Base other.ecore#//Foreign">
          <eStructuralFeatures xsi:type="ecore:EReference" name="peer" eType="#//sub/Child" eOpposite="#//sub/Child/peer"/>
        </eClassifiers>
      </eSubpackages>`), refFor('Inline'));
    expect(graph.classes.map(c => c.qualifiedName)).toEqual(['root.Base', 'root.sub.Child']);
    expect(graph.classes[0]).toMatchObject({ isAbstract: true, operations: [{ name: 'validate', parameterNames: ['context'] }] });
    expect(graph.classes[1].superTypes).toEqual(['root.Base']);
    expect(graph.classes[1].references[0]).toMatchObject({ typeName: 'Child', opposite: 'root.sub.Child.peer' });
    expect(graph.unresolvedSupertypes).toEqual(['other.ecore#//Foreign']);
  });

  it('allows metamodels without classes', () => {
    const graph = readMetamodelGraph(wrap('<eClassifiers xsi:type="ecore:EDataType" name="Text"/>'), refFor('Empty'));
    expect(graph.classes).toEqual([]);
  });

  it.each([
    ['invalid XML', '<ecore:EPackage', 'not valid XML'],
    ['a missing root package', '<?xml version="1.0"?><root/>', 'no root EPackage'],
    ['a file larger than 5 MB', ' '.repeat(5 * 1024 * 1024 + 1), 'larger than 5 MB'],
    ['too many classes', wrap('<eClassifiers xsi:type="ecore:EClass" name="C"/>'.repeat(MAX_CLASSES + 1)), `more than ${MAX_CLASSES} classes`],
  ])('rejects %s and names the metamodel', (_label, text, reason) => {
    expect(() => readMetamodelGraph(text, refFor('Broken'))).toThrow(EcoreReadError);
    expect(() => readMetamodelGraph(text, refFor('Broken'))).toThrow(new RegExp(`Broken: .*${reason}`));
  });
});
