import { ecoreToUml, nextUniqueAttributeName } from '../../utils/ecoreToUml';

// ── helpers ───────────────────────────────────────────────────────────────────

const wrap = (inner: string) => `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"
                name="test">
  ${inner}
</ecore:EPackage>`;

const eClass = (name: string, body = '', extra = '') =>
  `<eClassifiers xsi:type="ecore:EClass" name="${name}" ${extra}>${body}</eClassifiers>`;

const eAttr = (name: string, eType = '//EString', lower = '0', upper = '1') =>
  `<eStructuralFeatures xsi:type="ecore:EAttribute" name="${name}" eType="${eType}" lowerBound="${lower}" upperBound="${upper}"/>`;

const eRef = (
  name: string,
  targetName: string,
  containment = false,
  lower = '1',
  upper = '1',
) =>
  `<eStructuralFeatures xsi:type="ecore:EReference" name="${name}" eType="#//${targetName}" containment="${containment}" lowerBound="${lower}" upperBound="${upper}"/>`;

// ── invalid / empty input ─────────────────────────────────────────────────────

describe('nextUniqueAttributeName', () => {
  it('returns the base name when unused', () => {
    expect(nextUniqueAttributeName(['other'], 'attribute')).toBe('attribute');
  });

  it('suffixes when the base name is taken', () => {
    expect(nextUniqueAttributeName(['attribute'], 'attribute')).toBe('attribute2');
    expect(nextUniqueAttributeName(['attribute', 'attribute2'], 'attribute')).toBe('attribute3');
  });

  it('is case-insensitive', () => {
    expect(nextUniqueAttributeName(['Name'], 'name')).toBe('name2');
  });
});

describe('ecoreToUml – invalid / empty input', () => {
  it('returns empty model for malformed XML', () => {
    const result = ecoreToUml('<not valid xml');
    expect(result).toEqual({ classes: [], relationships: [] });
  });

  it('returns empty model for empty string', () => {
    const result = ecoreToUml('');
    expect(result.classes).toHaveLength(0);
    expect(result.relationships).toHaveLength(0);
  });

  it('returns empty model when XML has no EClass elements', () => {
    const result = ecoreToUml(wrap(''));
    expect(result).toEqual({ classes: [], relationships: [] });
  });

  it('returns empty model when a runtime exception occurs', () => {
    const result = ecoreToUml(null as unknown as string);
    expect(result).toEqual({ classes: [], relationships: [] });
  });
});

// ── class parsing ─────────────────────────────────────────────────────────────

describe('ecoreToUml – class parsing', () => {
  it('creates one UMLClass per EClass element', () => {
    const xml = wrap(eClass('Animal') + eClass('Dog'));
    const { classes } = ecoreToUml(xml);
    expect(classes).toHaveLength(2);
    expect(classes.map(c => c.name)).toEqual(expect.arrayContaining(['Animal', 'Dog']));
  });

  it('sets isAbstract=true for abstract="true"', () => {
    const xml = wrap(eClass('Base', '', 'abstract="true"'));
    const { classes } = ecoreToUml(xml);
    expect(classes[0].isAbstract).toBe(true);
  });

  it('sets isInterface=true for interface="true"', () => {
    const xml = wrap(eClass('ISerializable', '', 'interface="true"'));
    const { classes } = ecoreToUml(xml);
    expect(classes[0].isInterface).toBe(true);
  });

  it('sets isAbstract=false for plain classes', () => {
    const xml = wrap(eClass('Plain'));
    const { classes } = ecoreToUml(xml);
    expect(classes[0].isAbstract).toBe(false);
    expect(classes[0].isInterface).toBe(false);
  });

  it('uses sanitized name as id', () => {
    const xml = wrap(eClass('My-Class'));
    const { classes } = ecoreToUml(xml);
    expect(classes[0].id).toBe('My_Class');
    expect(classes[0].name).toBe('My-Class');
  });
});

// ── intelligent layout ────────────────────────────────────────────────────────

describe('ecoreToUml – intelligent layout', () => {
  it('assigns non-overlapping positions to isolated classes', () => {
    const xml = wrap(eClass('A') + eClass('B'));
    const { classes } = ecoreToUml(xml);
    const dist = Math.hypot(classes[1].x - classes[0].x, classes[1].y - classes[0].y);
    expect(dist).toBeGreaterThan(50);
  });

  it('places subclass below superclass for inheritance', () => {
    const xml = wrap(
      eClass('Parent') + eClass('Child', '', 'eSuperTypes="#//Parent"'),
    );
    const { classes } = ecoreToUml(xml);
    const parent = classes.find(c => c.name === 'Parent')!;
    const child = classes.find(c => c.name === 'Child')!;
    expect(parent.y).toBeLessThan(child.y);
  });
});

// ── attributes ────────────────────────────────────────────────────────────────

describe('ecoreToUml – attributes', () => {
  it('parses an EAttribute into a UMLAttribute with primitive display type', () => {
    const xml = wrap(eClass('Person', eAttr('name', '//EString', '1', '1')));
    const { classes } = ecoreToUml(xml);
    const attr = classes[0].attributes[0];
    expect(attr.name).toBe('name');
    expect(attr.type).toBe('String');
    expect(attr.visibility).toBe('+');
  });

  it('parses attribute visibility from uml.visibility annotation', () => {
    const attrXml =
      '<eStructuralFeatures xsi:type="ecore:EAttribute" name="secret" eType="//EString" lowerBound="0" upperBound="1">' +
      '<eAnnotations source="uml.visibility"><details key="symbol" value="-"/></eAnnotations>' +
      '</eStructuralFeatures>';
    const xml = wrap(eClass('Person', attrXml));
    const { classes } = ecoreToUml(xml);
    expect(classes[0].attributes[0].visibility).toBe('-');
  });

  it('does not include multiplicity on attributes', () => {
    const xml = wrap(eClass('Team', eAttr('scores', '//EInt', '0', '-1')));
    const { classes } = ecoreToUml(xml);
    expect(classes[0].attributes[0]).not.toHaveProperty('multiplicity');
    expect(classes[0].attributes[0].type).toBe('Int');
  });

  it('converts class-typed EAttribute into an association', () => {
    const xml = wrap(
      eClass('Order', eAttr('customer', '#//Customer', '1', '1')) +
      eClass('Customer'),
    );
    const { classes, relationships } = ecoreToUml(xml);
    const order = classes.find(c => c.name === 'Order')!;
    expect(order.attributes).toHaveLength(0);
    expect(relationships).toContainEqual(expect.objectContaining({
      sourceId: 'Order',
      targetId: 'Customer',
      type: 'association',
      label: 'customer',
    }));
  });

  it('does NOT include EReference elements as attributes', () => {
    const xml = wrap(
      eClass('Order', eRef('items', 'Item')) +
      eClass('Item'),
    );
    const { classes } = ecoreToUml(xml);
    const order = classes.find(c => c.name === 'Order')!;
    expect(order.attributes).toHaveLength(0);
  });

  it('assigns sequential ids to attributes', () => {
    const xml = wrap(
      eClass('X', eAttr('a') + eAttr('b') + eAttr('c')),
    );
    const { classes } = ecoreToUml(xml);
    const ids = classes[0].attributes.map(a => a.id);
    expect(ids).toEqual(['X-0', 'X-1', 'X-2']);
  });

  it('ensures attribute names are unique within a class', () => {
    const xml = wrap(
      eClass('X', eAttr('name') + eAttr('name') + eAttr('name')),
    );
    const { classes } = ecoreToUml(xml);
    const names = classes[0].attributes.map(a => a.name);
    expect(names).toEqual(['name', 'name2', 'name3']);
  });
});

// ── inheritance relationships ─────────────────────────────────────────────────

describe('ecoreToUml – inheritance', () => {
  it('creates an inheritance relationship for eSuperTypes', () => {
    const xml = wrap(
      eClass('Animal') +
      eClass('Dog', '', 'eSuperTypes="#//Animal"'),
    );
    const { relationships } = ecoreToUml(xml);
    expect(relationships).toHaveLength(1);
    expect(relationships[0]).toMatchObject({
      sourceId: 'Dog',
      targetId: 'Animal',
      type: 'inheritance',
    });
  });

  it('creates multiple inheritance relationships for multiple super types', () => {
    const xml = wrap(
      eClass('A') +
      eClass('B') +
      eClass('C', '', 'eSuperTypes="#//A #//B"'),
    );
    const { relationships } = ecoreToUml(xml);
    const types = relationships.map(r => r.targetId);
    expect(types).toContain('A');
    expect(types).toContain('B');
  });

  it('ignores super types that are not in the model', () => {
    const xml = wrap(eClass('Dog', '', 'eSuperTypes="#//Unknown"'));
    const { relationships } = ecoreToUml(xml);
    expect(relationships).toHaveLength(0);
  });

  it('ignores self-referential super types', () => {
    const xml = wrap(eClass('Loop', '', 'eSuperTypes="#//Loop"'));
    const { relationships } = ecoreToUml(xml);
    expect(relationships).toHaveLength(0);
  });
});

// ── association / composition relationships ───────────────────────────────────

describe('ecoreToUml – references', () => {
  it('creates an association relationship for a non-containment EReference', () => {
    const xml = wrap(
      eClass('Order', eRef('customer', 'Customer')) +
      eClass('Customer'),
    );
    const { relationships } = ecoreToUml(xml);
    expect(relationships).toHaveLength(1);
    expect(relationships[0]).toMatchObject({
      sourceId: 'Order',
      targetId: 'Customer',
      type: 'association',
      label: 'customer',
      sourceMultiplicity: '1',
      targetMultiplicity: '1',
    });
  });

  it('maps EReference bounds to source and target multiplicity', () => {
    const xml = wrap(
      eClass('Order', eRef('lines', 'LineItem', false, '0', '-1')) +
      eClass('LineItem'),
    );
    const { relationships } = ecoreToUml(xml);
    expect(relationships[0]).toMatchObject({
      sourceMultiplicity: '1',
      targetMultiplicity: '0..*',
    });
  });

  it('creates a composition relationship for a containment EReference', () => {
    const xml = wrap(
      eClass('Library', eRef('books', 'Book', true)) +
      eClass('Book'),
    );
    const { relationships } = ecoreToUml(xml);
    expect(relationships[0]).toMatchObject({
      type: 'composition',
      label: 'books',
    });
  });

  it('ignores EReference targets not present in the model', () => {
    const xml = wrap(eClass('Node', eRef('missing', 'Ghost')));
    const { relationships } = ecoreToUml(xml);
    expect(relationships).toHaveLength(0);
  });

  it('assigns sequential ids to relationships', () => {
    const xml = wrap(
      eClass('A') +
      eClass('B') +
      eClass('C', '', 'eSuperTypes="#//A"') +
      eClass('D', eRef('ref', 'B')),
    );
    const { relationships } = ecoreToUml(xml);
    expect(relationships[0].id).toBe('rel-0');
    expect(relationships[1].id).toBe('rel-1');
  });
});
