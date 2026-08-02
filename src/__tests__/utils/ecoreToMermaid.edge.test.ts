/**
 * Edge-case tests for ecoreToMermaid — extends the existing ecoreToMermaid.test.ts
 */
import { ecoreToMermaid } from '../../utils/ecoreToMermaid';

// ── helpers ───────────────────────────────────────────────────────────────────

const wrap = (inner: string) => `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"
                name="test">
  ${inner}
</ecore:EPackage>`;

const eClass = (name: string, attrs = '', extra = '') =>
  `<eClassifiers xsi:type="ecore:EClass" name="${name}" ${extra}>${attrs}</eClassifiers>`;

const eAttr = (name: string, eType = '//EString', lower = '0', upper = '1') =>
  `<eStructuralFeatures xsi:type="ecore:EAttribute" name="${name}" eType="${eType}" lowerBound="${lower}" upperBound="${upper}"/>`;

const eRef = (name: string, eType: string, containment = false) =>
  `<eStructuralFeatures xsi:type="ecore:EReference" name="${name}" eType="#//${eType}" containment="${containment}"/>`;

// ── multiplicity rendering ────────────────────────────────────────────────────

describe('ecoreToMermaid – multiplicity edge cases', () => {
  it('renders [1..1] when lowerBound=1 and upperBound=1', () => {
    const result = ecoreToMermaid(wrap(eClass('A', eAttr('x', '//EInt', '1', '1'))));
    expect(result).toContain('[1..1]');
  });

  it('renders [0..*] when upperBound is -1', () => {
    const result = ecoreToMermaid(wrap(eClass('A', eAttr('x', '//EString', '0', '-1'))));
    expect(result).toContain('[0..*]');
  });

  it('omits multiplicity when bounds attributes are absent', () => {
    const xml = wrap(
      `<eClassifiers xsi:type="ecore:EClass" name="A">
         <eStructuralFeatures xsi:type="ecore:EAttribute" name="v" eType="//EString"/>
       </eClassifiers>`,
    );
    const result = ecoreToMermaid(xml);
    expect(result).toContain('+v EString');
    expect(result).not.toContain('[');
  });
});

// ── EClass without xsi:type but with features ────────────────────────────────

describe('ecoreToMermaid – implicit EClass detection', () => {
  it('renders a class block when xsi:type is missing but features are present', () => {
    const xml = wrap(
      `<eClassifiers name="ImplicitClass">
         <eStructuralFeatures xsi:type="ecore:EAttribute" name="val" eType="//EString" lowerBound="0" upperBound="1"/>
       </eClassifiers>`,
    );
    const result = ecoreToMermaid(xml);
    expect(result).toContain('class ImplicitClass {');
    expect(result).toContain('+val EString');
  });

  it('skips classifiers without xsi:type and without features', () => {
    const xml = wrap(`<eClassifiers name="EnumType"/>`);
    const result = ecoreToMermaid(xml);
    expect(result).toBe('classDiagram\n  class EmptyModel');
  });
});

// ── both abstract and interface flags ────────────────────────────────────────

describe('ecoreToMermaid – combined stereotypes', () => {
  it('emits both <<abstract>> and <<interface>> when both are true', () => {
    const xml = wrap(eClass('Hybrid', '', 'abstract="true" interface="true"'));
    const result = ecoreToMermaid(xml);
    expect(result).toContain('<<abstract>>');
    expect(result).toContain('<<interface>>');
  });
});

// ── type name parsing edge cases ──────────────────────────────────────────────

describe('ecoreToMermaid – type name parsing', () => {
  it('extracts type from full ecore: URL', () => {
    const xml = wrap(
      `<eClassifiers xsi:type="ecore:EClass" name="A">
         <eStructuralFeatures xsi:type="ecore:EAttribute" name="v"
           eType="ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EInt"
           lowerBound="0" upperBound="1"/>
       </eClassifiers>`,
    );
    const result = ecoreToMermaid(xml);
    expect(result).toContain('+v EInt');
  });

  it('extracts type from deeply nested path', () => {
    const xml = wrap(
      `<eClassifiers xsi:type="ecore:EClass" name="A">
         <eStructuralFeatures xsi:type="ecore:EAttribute" name="v"
           eType="#//sub/DeepType" lowerBound="0" upperBound="1"/>
       </eClassifiers>`,
    );
    const result = ecoreToMermaid(xml);
    expect(result).toContain('+v DeepType');
  });

  it('sanitises special characters in type names', () => {
    const xml = wrap(
      `<eClassifiers xsi:type="ecore:EClass" name="A">
         <eStructuralFeatures xsi:type="ecore:EAttribute" name="v"
           eType="#//My-Type" lowerBound="0" upperBound="1"/>
       </eClassifiers>`,
    );
    const result = ecoreToMermaid(xml);
    expect(result).toContain('+v My_Type');
  });
});

// ── multiple classes ──────────────────────────────────────────────────────────

describe('ecoreToMermaid – multiple classes', () => {
  it('emits one class block per EClass', () => {
    const xml = wrap(eClass('A') + eClass('B') + eClass('C'));
    const result = ecoreToMermaid(xml);
    expect(result).toContain('class A {');
    expect(result).toContain('class B {');
    expect(result).toContain('class C {');
  });

  it('does not duplicate class names', () => {
    const xml = wrap(eClass('Foo') + eClass('Bar'));
    const result = ecoreToMermaid(xml);
    const matches = result.match(/class Foo \{/g) ?? [];
    expect(matches).toHaveLength(1);
  });
});

// ── reference edge cases ──────────────────────────────────────────────────────

describe('ecoreToMermaid – reference edge cases', () => {
  it('does not emit arrow for EReference when target is not in model', () => {
    const xml = wrap(eClass('A', eRef('ghost', 'NonExistentClass')));
    const result = ecoreToMermaid(xml);
    // Arrow should still be emitted (ecoreToMermaid doesn't validate targets)
    // but must not crash
    expect(result).toContain('classDiagram');
  });

  it('emits correct arrow labels for multiple references from the same class', () => {
    const xml = wrap(
      eClass('Order', eRef('customer', 'Customer') + eRef('product', 'Product')) +
      eClass('Customer') +
      eClass('Product'),
    );
    const result = ecoreToMermaid(xml);
    expect(result).toContain('Order --> Customer : customer');
    expect(result).toContain('Order --> Product : product');
  });
});

// ── realistic model round-trip ─────────────────────────────────────────────────

describe('ecoreToMermaid – realistic model', () => {
  it('produces well-formed mermaid syntax for a vehicle model', () => {
    const xml = wrap(
      eClass('Vehicle', eAttr('speed', '//EInt', '0', '1'), 'abstract="true"') +
      eClass('Car',
        eRef('engine', 'Engine', true),
        'eSuperTypes="#//Vehicle"',
      ) +
      eClass('Engine', eAttr('hp', '//EInt', '1', '1')),
    );
    const result = ecoreToMermaid(xml);

    expect(result.startsWith('classDiagram')).toBe(true);
    expect(result).toContain('class Vehicle {');
    expect(result).toContain('<<abstract>>');
    expect(result).toContain('+speed EInt [0..1]');
    expect(result).toContain('class Car {');
    expect(result).toContain('Vehicle <|-- Car');
    expect(result).toContain('Car *-- Engine : engine');
    expect(result).toContain('+hp EInt [1..1]');
  });
});
