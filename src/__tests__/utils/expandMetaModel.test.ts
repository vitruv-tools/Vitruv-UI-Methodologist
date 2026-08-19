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
    expect(result!.eObjectNodes[0].data.color).toBe(expected);
  });

  it('falls back to the file name when no domain or explicit color is given', () => {
    const expected = metaModelDisplayColor(undefined, 'pcm.ecore');
    const result = expandMetaModelToNodes(ecore, 'pcm.ecore', { x: 0, y: 0 });

    expect(result!.boundingBox.data.color).toBe(expected);
    expect(result!.eObjectNodes[0].data.color).toBe(expected);
  });
});
