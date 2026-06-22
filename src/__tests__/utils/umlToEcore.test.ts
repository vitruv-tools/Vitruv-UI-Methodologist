import { ecoreToUml } from '../../utils/ecoreToUml';
import { umlToEcore, umlSemanticSnapshot } from '../../utils/umlToEcore';

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"
                name="testpkg" nsURI="http://example.com/test" nsPrefix="test">
  <eClassifiers xsi:type="ecore:EClass" name="Person">
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="name" eType="//EString" lowerBound="1" upperBound="1"/>
  </eClassifiers>
  <eClassifiers xsi:type="ecore:EClass" name="Employee" eSuperTypes="#//Person"/>
</ecore:EPackage>`;

describe('umlToEcore', () => {
  it('round-trips class names and inheritance', () => {
    const model = ecoreToUml(SAMPLE);
    const xml = umlToEcore(model, SAMPLE);
    const roundTrip = ecoreToUml(xml);
    expect(roundTrip.classes.map(c => c.name).sort()).toEqual(['Employee', 'Person']);
    expect(roundTrip.relationships.some(r => r.type === 'inheritance')).toBe(true);
  });

  it('preserves package metadata from original ecore', () => {
    const model = ecoreToUml(SAMPLE);
    const xml = umlToEcore(model, SAMPLE);
    expect(xml).toContain('name="testpkg"');
    expect(xml).toContain('nsURI="http://example.com/test"');
    expect(xml).toContain('nsPrefix="test"');
  });

  it('serializes a newly added class', () => {
    const model = ecoreToUml(SAMPLE);
    model.classes.push({
      id: 'new-1',
      name: 'Department',
      isAbstract: false,
      isInterface: false,
      attributes: [],
      operations: [],
      x: 0,
      y: 0,
    });
    const xml = umlToEcore(model, SAMPLE);
    expect(xml).toContain('name="Department"');
  });

  it('serializes association with label and multiplicity', () => {
    const model = ecoreToUml(SAMPLE);
    model.relationships.push({
      id: 'rel-new',
      sourceId: model.classes.find(c => c.name === 'Person')!.id,
      targetId: model.classes.find(c => c.name === 'Employee')!.id,
      type: 'association',
      label: 'manager',
      targetMultiplicity: '0..*',
    });
    const xml = umlToEcore(model, SAMPLE);
    expect(xml).toContain('name="manager"');
    expect(xml).toContain('lowerBound="0"');
    expect(xml).toContain('upperBound="-1"');
  });

  it('umlSemanticSnapshot ignores layout coordinates', () => {
    const model = ecoreToUml(SAMPLE);
    const a = umlSemanticSnapshot(model);
    model.classes[0].x = 999;
    const b = umlSemanticSnapshot(model);
    expect(a).toBe(b);
  });

  it('serializes non-public attribute visibility as eAnnotations', () => {
    const model = ecoreToUml(SAMPLE);
    model.classes[0].attributes[0].visibility = '#';
    const xml = umlToEcore(model, SAMPLE);
    expect(xml).toContain('source="uml.visibility"');
    expect(xml).toContain('value="#"');
    const roundTrip = ecoreToUml(xml);
    expect(roundTrip.classes.find(c => c.name === 'Person')!.attributes[0].visibility).toBe('#');
  });
});
