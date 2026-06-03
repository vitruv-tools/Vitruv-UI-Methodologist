/**
 * Edge-case tests for ecoreToUml — extends the existing ecoreToUml.test.ts
 * with boundary conditions and less-common XML patterns.
 */
import { ecoreToUml } from '../../utils/ecoreToUml';

// ── helpers ───────────────────────────────────────────────────────────────────

const wrap = (inner: string) => `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"
                name="test">
  ${inner}
</ecore:EPackage>`;

const eClass = (name: string, body = '', extra = '') =>
  `<eClassifiers xsi:type="ecore:EClass" name="${name}" ${extra}>${body}</eClassifiers>`;

const eAttr = (name: string, eType = '//EString', lower?: string, upper?: string) => {
  const bounds = lower !== undefined && upper !== undefined
    ? `lowerBound="${lower}" upperBound="${upper}"`
    : '';
  return `<eStructuralFeatures xsi:type="ecore:EAttribute" name="${name}" eType="${eType}" ${bounds}/>`;
};

const eRef = (name: string, targetName: string, containment = false) =>
  `<eStructuralFeatures xsi:type="ecore:EReference" name="${name}" eType="#//${targetName}" containment="${containment}"/>`;

// ── EClass detection via fallback (no xsi:type, has features) ─────────────────

describe('ecoreToUml – EClass without xsi:type attribute', () => {
  it('detects a class without xsi:type when it has eStructuralFeatures children', () => {
    const xml = wrap(
      `<eClassifiers name="ImplicitClass">
         <eStructuralFeatures xsi:type="ecore:EAttribute" name="val" eType="//EString"/>
       </eClassifiers>`,
    );
    const { classes } = ecoreToUml(xml);
    expect(classes).toHaveLength(1);
    expect(classes[0].name).toBe('ImplicitClass');
  });

  it('ignores classifiers without xsi:type and without features', () => {
    const xml = wrap(`<eClassifiers name="Enum"/>`);
    const { classes } = ecoreToUml(xml);
    expect(classes).toHaveLength(0);
  });
});

// ── attribute multiplicity edge cases ────────────────────────────────────────

describe('ecoreToUml – multiplicity edge cases', () => {
  it('renders [0..1] for lowerBound=0 upperBound=1', () => {
    const xml = wrap(eClass('A', eAttr('x', '//EInt', '0', '1')));
    const { classes } = ecoreToUml(xml);
    expect(classes[0].attributes[0].multiplicity).toBe('[0..1]');
  });

  it('renders [1..1] for lowerBound=1 upperBound=1', () => {
    const xml = wrap(eClass('A', eAttr('x', '//EInt', '1', '1')));
    const { classes } = ecoreToUml(xml);
    expect(classes[0].attributes[0].multiplicity).toBe('[1..1]');
  });

  it('renders [0..*] for upperBound=-1', () => {
    const xml = wrap(eClass('A', eAttr('x', '//EString', '0', '-1')));
    const { classes } = ecoreToUml(xml);
    expect(classes[0].attributes[0].multiplicity).toBe('[0..*]');
  });

  it('leaves multiplicity undefined when only lowerBound is present', () => {
    const xml = wrap(
      `<eClassifiers xsi:type="ecore:EClass" name="A">
         <eStructuralFeatures xsi:type="ecore:EAttribute" name="v" eType="//EString" lowerBound="1"/>
       </eClassifiers>`,
    );
    const { classes } = ecoreToUml(xml);
    expect(classes[0].attributes[0].multiplicity).toBeUndefined();
  });
});

// ── large model – intelligent layout ───────────────────────────────────────────

describe('ecoreToUml – layout with many classes', () => {
  it('separates many isolated classes spatially', () => {
    const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const xml = wrap(names.map(n => eClass(n)).join(''));
    const { classes } = ecoreToUml(xml);

    const xs = new Set(classes.map(c => c.x));
    expect(xs.size).toBeGreaterThan(1);

    const classD = classes.find(c => c.name === 'D')!;
    const classA = classes.find(c => c.name === 'A')!;
    expect(Math.hypot(classD.x - classA.x, classD.y - classA.y)).toBeGreaterThan(50);
  });

  it('connected classes are not placed on top of each other', () => {
    const xml = wrap(eClass('A') + eClass('B'));
    const { classes } = ecoreToUml(xml);
    const a = classes.find(c => c.name === 'A')!;
    const b = classes.find(c => c.name === 'B')!;
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThan(50);
  });
});

// ── relationship id sequence is stable ────────────────────────────────────────

describe('ecoreToUml – relationship id stability', () => {
  it('assigns rel-0, rel-1 to the first two relationships', () => {
    const xml = wrap(
      eClass('A') +
      eClass('B', '', 'eSuperTypes="#//A"') +
      eClass('C', '', 'eSuperTypes="#//A"'),
    );
    const { relationships } = ecoreToUml(xml);
    expect(relationships[0].id).toBe('rel-0');
    expect(relationships[1].id).toBe('rel-1');
  });
});

// ── type name parsing edge cases ──────────────────────────────────────────────

describe('ecoreToUml – type name parsing', () => {
  it('extracts type name from ecore: prefixed eType', () => {
    const xml = wrap(
      `<eClassifiers xsi:type="ecore:EClass" name="A">
         <eStructuralFeatures xsi:type="ecore:EAttribute" name="v"
           eType="ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EString"/>
       </eClassifiers>`,
    );
    const { classes } = ecoreToUml(xml);
    expect(classes[0].attributes[0].type).toBe('EString');
  });

  it('handles deeply nested #// type path', () => {
    const xml = wrap(
      `<eClassifiers xsi:type="ecore:EClass" name="A">
         <eStructuralFeatures xsi:type="ecore:EAttribute" name="v"
           eType="#//sub/NestedType" lowerBound="0" upperBound="1"/>
       </eClassifiers>`,
    );
    const { classes } = ecoreToUml(xml);
    expect(classes[0].attributes[0].type).toBe('NestedType');
  });
});

// ── mixed model ───────────────────────────────────────────────────────────────

describe('ecoreToUml – mixed model', () => {
  it('produces correct classes and relationships for a realistic model', () => {
    const xml = wrap(
      eClass('Vehicle', eAttr('speed', '//EInt', '0', '1'), 'abstract="true"') +
      eClass('Car', eRef('engine', 'Engine', true), 'eSuperTypes="#//Vehicle"') +
      eClass('Engine', eAttr('horsepower', '//EInt', '1', '1')),
    );
    const { classes, relationships } = ecoreToUml(xml);

    expect(classes).toHaveLength(3);
    expect(classes.find(c => c.name === 'Vehicle')?.isAbstract).toBe(true);

    const car = classes.find(c => c.name === 'Car')!;
    expect(car.attributes).toHaveLength(0); // EReference is not an attribute

    // inheritance: Car → Vehicle
    const inheritance = relationships.find(r => r.type === 'inheritance');
    expect(inheritance).toMatchObject({ sourceId: 'Car', targetId: 'Vehicle' });

    // composition: Car → Engine
    const composition = relationships.find(r => r.type === 'composition');
    expect(composition).toMatchObject({ sourceId: 'Car', targetId: 'Engine', label: 'engine' });
  });
});
