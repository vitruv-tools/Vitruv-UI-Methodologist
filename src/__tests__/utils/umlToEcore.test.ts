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

  it('writes built-in types as references into the Ecore package', () => {
    const model = ecoreToUml(SAMPLE);
    model.classes.find(c => c.name === 'Person')!.operations = [
      { id: 'p-op-0', name: 'age', returnType: 'Int', visibility: '+' },
      { id: 'p-op-1', name: 'greet', returnType: 'Void', visibility: '+' },
    ];
    const xml = umlToEcore(model, SAMPLE);

    expect(xml).toContain(
      'eType="ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EString"',
    );
    expect(xml).toContain(
      '<eOperations name="age" eType="ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EInt"',
    );
    expect(xml).toContain('<eOperations name="greet"/>');
    expect(xml).not.toMatch(/eType="\/\/E/);

    const roundTrip = ecoreToUml(xml).classes.find(c => c.name === 'Person')!;
    expect(roundTrip.attributes[0].type).toBe('String');
    expect(roundTrip.operations.map(o => o.returnType)).toEqual(['Int', 'Void']);
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

  describe('association multiplicity round trip', () => {
    function roundTripMultiplicity(
      sourceMultiplicity: string | undefined,
      targetMultiplicity: string | undefined,
    ) {
      const model = ecoreToUml(SAMPLE);
      model.relationships.push({
        id: 'rel-new',
        sourceId: model.classes.find(c => c.name === 'Person')!.id,
        targetId: model.classes.find(c => c.name === 'Employee')!.id,
        type: 'association',
        label: 'manager',
        sourceMultiplicity,
        targetMultiplicity,
      });
      const xml = umlToEcore(model, SAMPLE);
      const saved = ecoreToUml(xml).relationships.find(r => r.label === 'manager')!;
      return { xml, saved, again: ecoreToUml(umlToEcore(ecoreToUml(xml), xml)) };
    }

    it.each([
      ['0..*', '1'],
      ['1', '0..*'],
      ['1..*', '0..1'],
      ['0..1', '1..*'],
      ['*', '*'],
      ['*', '0..*'],
      ['2..5', '3'],
      [undefined, '1'],
      ['0..*', undefined],
      [undefined, undefined],
    ])('keeps source %s and target %s after saving and reloading', (source, target) => {
      const { saved, again } = roundTripMultiplicity(source, target);
      expect(saved.sourceMultiplicity).toBe(source);
      expect(saved.targetMultiplicity).toBe(target);
      const savedAgain = again.relationships.find(r => r.label === 'manager')!;
      expect(savedAgain.sourceMultiplicity).toBe(source);
      expect(savedAgain.targetMultiplicity).toBe(target);
    });

    it('writes a valid upper bound for "*" and omits bounds for a cleared target', () => {
      expect(roundTripMultiplicity('1', '*').xml).toContain('lowerBound="0" upperBound="-1"');
      const referenceTag = /<eStructuralFeatures[^>]*EReference[^>]*>/.exec(
        roundTripMultiplicity('1', undefined).xml,
      )![0];
      expect(referenceTag).not.toContain('lowerBound');
      expect(referenceTag).not.toContain('upperBound');
    });

    it('does not add an annotation when the ends match what Ecore bounds imply', () => {
      expect(roundTripMultiplicity('1', '0..*').xml).not.toContain('uml.multiplicity');
    });

    it('prefers the Ecore bounds over a stale target annotation', () => {
      const ecore = `<ecore:EPackage xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore" name="p">
        <eClassifiers xsi:type="ecore:EClass" name="A">
          <eStructuralFeatures xsi:type="ecore:EReference" name="b" eType="#//B" lowerBound="1" upperBound="1">
            <eAnnotations source="uml.multiplicity"><details key="target" value="*"/></eAnnotations>
          </eStructuralFeatures>
        </eClassifiers>
        <eClassifiers xsi:type="ecore:EClass" name="B"/>
      </ecore:EPackage>`;
      expect(ecoreToUml(ecore).relationships[0].targetMultiplicity).toBe('1');
    });
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

  it('round-trips documentation for classes, attributes, operations, and references', () => {
    const model = ecoreToUml(SAMPLE);
    const person = model.classes.find(c => c.name === 'Person')!;
    const employee = model.classes.find(c => c.name === 'Employee')!;
    person.documentation = 'Represents a person & their profile';
    person.attributes[0].documentation = 'The preferred <display> name';
    person.operations.push({
      id: 'Person-op-0',
      name: 'greet',
      returnType: 'Void',
      visibility: '+',
      documentation: 'Sends a greeting',
    });
    model.relationships.push({
      id: 'rel-docs',
      sourceId: person.id,
      targetId: employee.id,
      type: 'association',
      label: 'manager',
      documentation: 'The employee managed by this person',
    });

    const xml = umlToEcore(model, SAMPLE);
    expect(xml).toContain('key="documentation"');
    expect(xml).toContain('profile');
    expect(xml).toContain('&lt;display&gt;');

    const roundTrip = ecoreToUml(xml);
    const roundTripPerson = roundTrip.classes.find(c => c.name === 'Person')!;
    expect(roundTripPerson.documentation).toBe('Represents a person & their profile');
    expect(roundTripPerson.attributes[0].documentation).toBe('The preferred <display> name');
    expect(roundTripPerson.operations[0].documentation).toBe('Sends a greeting');
    expect(roundTrip.relationships.find(r => r.label === 'manager')!.documentation)
      .toBe('The employee managed by this person');
  });
});
