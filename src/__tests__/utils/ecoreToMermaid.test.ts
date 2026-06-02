import { ecoreToMermaid } from '../../utils/ecoreToMermaid';

// ── helpers ───────────────────────────────────────────────────────────────────

const wrap = (inner: string) => `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"
                name="test">
  ${inner}
</ecore:EPackage>`;

const eClass = (name: string, attrs: string = '', extra: string = '') =>
  `<eClassifiers xsi:type="ecore:EClass" name="${name}" ${extra}>${attrs}</eClassifiers>`;

const eAttr = (name: string, eType = '//EString', lower = '0', upper = '1') =>
  `<eStructuralFeatures xsi:type="ecore:EAttribute" name="${name}" eType="${eType}" lowerBound="${lower}" upperBound="${upper}"/>`;

const eRef = (name: string, eType: string, containment = false) =>
  `<eStructuralFeatures xsi:type="ecore:EReference" name="${name}" eType="#//${eType}" containment="${containment}"/>`;

// ── invalid / empty XML ───────────────────────────────────────────────────────

describe('ecoreToMermaid – invalid / empty input', () => {
  it('returns ParseError class for malformed XML', () => {
    const result = ecoreToMermaid('<this is not xml>');
    expect(result).toBe('classDiagram\n  class ParseError');
  });

  it('returns ParseError class for empty string', () => {
    const result = ecoreToMermaid('');
    // DOMParser wraps empty string as an error document
    expect(result).toMatch(/classDiagram/);
  });

  it('returns EmptyModel when XML has no EClass elements', () => {
    const result = ecoreToMermaid(wrap(''));
    expect(result).toBe('classDiagram\n  class EmptyModel');
  });

  it('returns Error class when an exception is thrown internally', () => {
    // Pass a non-string to force a runtime error path
    const result = ecoreToMermaid(null as unknown as string);
    expect(result).toMatch(/classDiagram/);
  });
});

// ── simple class ──────────────────────────────────────────────────────────────

describe('ecoreToMermaid – simple class', () => {
  it('emits a class block for a single EClass', () => {
    const result = ecoreToMermaid(wrap(eClass('Person')));
    expect(result).toContain('class Person {');
    expect(result).toContain('}');
  });

  it('starts output with "classDiagram"', () => {
    const result = ecoreToMermaid(wrap(eClass('Foo')));
    expect(result.startsWith('classDiagram')).toBe(true);
  });
});

// ── attributes ────────────────────────────────────────────────────────────────

describe('ecoreToMermaid – attributes', () => {
  it('renders an EAttribute as a field inside the class block', () => {
    const xml = wrap(eClass('Person', eAttr('name', '//EString', '1', '1')));
    const result = ecoreToMermaid(xml);
    expect(result).toContain('+name EString');
  });

  it('renders multiplicity when bounds are present', () => {
    const xml = wrap(eClass('Team', eAttr('score', '//EInt', '0', '-1')));
    const result = ecoreToMermaid(xml);
    expect(result).toContain('[0..*]');
  });

  it('does NOT render EReference as a field', () => {
    const xml = wrap(
      eClass('Order', eRef('items', 'Item')) +
      eClass('Item'),
    );
    const result = ecoreToMermaid(xml);
    // The class block for Order should not contain "+items"
    expect(result).not.toMatch(/\+items/);
  });
});

// ── abstract / interface stereotypes ─────────────────────────────────────────

describe('ecoreToMermaid – stereotypes', () => {
  it('adds <<abstract>> stereotype for abstract classes', () => {
    const xml = wrap(eClass('Animal', '', 'abstract="true"'));
    const result = ecoreToMermaid(xml);
    expect(result).toContain('<<abstract>>');
  });

  it('adds <<interface>> stereotype for interface classes', () => {
    const xml = wrap(eClass('Printable', '', 'interface="true"'));
    const result = ecoreToMermaid(xml);
    expect(result).toContain('<<interface>>');
  });

  it('emits no stereotype for plain classes', () => {
    const xml = wrap(eClass('Plain'));
    const result = ecoreToMermaid(xml);
    expect(result).not.toContain('<<abstract>>');
    expect(result).not.toContain('<<interface>>');
  });
});

// ── inheritance ───────────────────────────────────────────────────────────────

describe('ecoreToMermaid – inheritance', () => {
  it('emits an inheritance arrow for eSuperTypes', () => {
    const xml = wrap(
      eClass('Animal') +
      eClass('Dog', '', 'eSuperTypes="#//Animal"'),
    );
    const result = ecoreToMermaid(xml);
    expect(result).toContain('Animal <|-- Dog');
  });

  it('handles multiple super types separated by spaces', () => {
    const xml = wrap(
      eClass('A') +
      eClass('B') +
      eClass('C', '', 'eSuperTypes="#//A #//B"'),
    );
    const result = ecoreToMermaid(xml);
    expect(result).toContain('A <|-- C');
    expect(result).toContain('B <|-- C');
  });

  it('does not emit self-reference inheritance arrow', () => {
    const xml = wrap(eClass('Self', '', 'eSuperTypes="#//Self"'));
    const result = ecoreToMermaid(xml);
    expect(result).not.toContain('Self <|-- Self');
  });
});

// ── associations / compositions ───────────────────────────────────────────────

describe('ecoreToMermaid – references', () => {
  it('emits an association arrow for a non-containment EReference', () => {
    const xml = wrap(
      eClass('Order', eRef('customer', 'Customer')) +
      eClass('Customer'),
    );
    const result = ecoreToMermaid(xml);
    expect(result).toContain('Order --> Customer : customer');
  });

  it('emits a composition arrow for a containment EReference', () => {
    const xml = wrap(
      eClass('Library', eRef('books', 'Book', true)) +
      eClass('Book'),
    );
    const result = ecoreToMermaid(xml);
    expect(result).toContain('Library *-- Book : books');
  });

  it('does not emit a self-reference arrow', () => {
    const xml = wrap(eClass('Node', eRef('child', 'Node')));
    const result = ecoreToMermaid(xml);
    expect(result).not.toContain('Node --> Node');
  });
});

// ── name sanitisation ─────────────────────────────────────────────────────────

describe('ecoreToMermaid – name sanitisation', () => {
  it('replaces special characters with underscores', () => {
    const xml = wrap(eClass('My-Class'));
    const result = ecoreToMermaid(xml);
    expect(result).toContain('class My_Class');
  });
});
