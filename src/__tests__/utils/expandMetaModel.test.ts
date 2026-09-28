import { expandMetaModelToNodes } from '../../utils/expandMetaModel';
import { metaModelDisplayColor } from '../../utils/metaModelColors';

const ecore = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"
                name="pcm" nsURI="http://pcm" nsPrefix="pcm">
  <eClassifiers xsi:type="ecore:EClass" name="Component">
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="name" eType="//EString"/>
  </eClassifiers>
</ecore:EPackage>`;

describe('expandMetaModelToNodes colors', () => {
  it('uses the VSUM display color for the bounding box and EObject nodes', () => {
    const expected = metaModelDisplayColor('pcm', 'pcm.ecore');
    const result = expandMetaModelToNodes(ecore, 'pcm.ecore', { x: 10, y: 20 }, 'pcm', expected);

    expect(result).not.toBeNull();
    expect(result!.boundingBox.data.color).toBe(expected);
    expect(result!.boundingBox.data.domain).toBe('pcm');
    expect(result!.boundingBox.style?.zIndex).toBe(0);
    expect(result!.eObjectNodes[0].data.color).toBe(expected);
  });

  it('falls back to the file name when no domain or explicit color is given', () => {
    const expected = metaModelDisplayColor(undefined, 'pcm.ecore');
    const result = expandMetaModelToNodes(ecore, 'pcm.ecore', { x: 0, y: 0 });

    expect(result!.boundingBox.data.color).toBe(expected);
    expect(result!.eObjectNodes[0].data.color).toBe(expected);
  });
});

const linkedEcore = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"
                name="families" nsURI="http://families" nsPrefix="families">
  <eClassifiers xsi:type="ecore:EClass" name="Family">
    <eStructuralFeatures xsi:type="ecore:EReference" name="members"
                         eType="#//Member" containment="true"/>
  </eClassifiers>
  <eClassifiers xsi:type="ecore:EClass" name="Member">
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="name" eType="//EString"/>
  </eClassifiers>
</ecore:EPackage>`;

describe('expandMetaModelToNodes intra-model associations', () => {
  it('creates a UML edge and a midpoint ghost for each EReference', () => {
    const result = expandMetaModelToNodes(linkedEcore, 'families.ecore', { x: 0, y: 0 });
    expect(result).not.toBeNull();
    expect(result!.umlEdges).toHaveLength(1);
    expect(result!.umlEdges[0].type).toBe('uml');
    expect(result!.umlEdges[0].data?.expandedIntraModel).toBe(true);
    expect(result!.umlEdges[0].data?.ecore?.eReferenceId).toBe('http://families#Family.members');
    expect(result!.ghostNodes).toHaveLength(1);
    expect(result!.ghostNodes[0].type).toBe('ghost');
    expect(result!.ghostNodes[0].data?.ecore?.eObjectId).toBe('http://families#Family.members');
    expect(result!.eObjectNodes.find(n => n.data.className === 'Family')?.data.ecore.eReferenceIds)
      .toEqual(['http://families#Family.members']);
  });

  it('does not put a ghost on inheritance edges', () => {
    const withSuper = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"
                name="m" nsURI="http://m" nsPrefix="m">
  <eClassifiers xsi:type="ecore:EClass" name="Base"/>
  <eClassifiers xsi:type="ecore:EClass" name="Child" eSuperTypes="#//Base"/>
</ecore:EPackage>`;
    const result = expandMetaModelToNodes(withSuper, 'm.ecore', { x: 0, y: 0 });
    expect(result!.umlEdges.some(e => e.data?.relationshipType === 'inheritance')).toBe(true);
    expect(result!.ghostNodes).toHaveLength(0);
  });
});
