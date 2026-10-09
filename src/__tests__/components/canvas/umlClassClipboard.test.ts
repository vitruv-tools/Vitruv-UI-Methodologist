import {
  UML_PASTE_OFFSET,
  createUmlClassSnapshot,
  findPasteOffset,
  nextCopyClassName,
  pasteUmlClassSnapshot,
} from '../../../components/canvas/umlClassClipboard';
import { UML_CLASS_BOX_WIDTH } from '../../../components/canvas/umlDiagramClassMetrics';
import { getUmlClassBoxHeight } from '../../../components/canvas/umlDiagramLayoutGeometry';
import type { UMLClass, UMLRelationship } from '../../../utils/ecoreToUml';

/** Middle of the rectangle around all class boxes. */
function groupCenter(group: readonly UMLClass[]): { x: number; y: number } {
  const left = Math.min(...group.map(classItem => classItem.x));
  const top = Math.min(...group.map(classItem => classItem.y));
  const right = Math.max(...group.map(classItem => classItem.x + UML_CLASS_BOX_WIDTH));
  const bottom = Math.max(...group.map(classItem => classItem.y + getUmlClassBoxHeight(classItem)));
  return { x: (left + right) / 2, y: (top + bottom) / 2 };
}

function makeClass(id: string, x = 0, y = 0, overrides: Partial<UMLClass> = {}): UMLClass {
  return {
    id,
    name: id,
    isAbstract: false,
    isInterface: false,
    attributes: [],
    operations: [],
    x,
    y,
    ...overrides,
  };
}

const person = makeClass('Person', 40, 40, {
  isAbstract: true,
  documentation: 'A person',
  attributes: [{ id: 'Person-0', name: 'name', type: 'String', visibility: '-', documentation: 'Full name' }],
  operations: [{ id: 'Person-op-0', name: 'greet', returnType: 'Void', visibility: '+', documentation: 'Says hi' }],
});
const address = makeClass('Address', 280, 40);
const company = makeClass('Company', 40, 300);

const personToAddress: UMLRelationship = {
  id: 'rel-0',
  sourceId: 'Person',
  targetId: 'Address',
  type: 'composition',
  label: 'address',
  sourceMultiplicity: '1',
  targetMultiplicity: '0..*',
};
const companyToPerson: UMLRelationship = {
  id: 'rel-1',
  sourceId: 'Company',
  targetId: 'Person',
  type: 'association',
  label: 'employees',
};

const classes = [person, address, company];
const relationships = [personToAddress, companyToPerson];

describe('createUmlClassSnapshot', () => {
  it('copies a single class without its relationships', () => {
    const snapshot = createUmlClassSnapshot(classes, relationships, ['Person']);

    expect(snapshot?.classes).toEqual([person]);
    expect(snapshot?.relationships).toEqual([]);
  });

  it('keeps only relationships between the copied classes', () => {
    const snapshot = createUmlClassSnapshot(classes, relationships, ['Person', 'Address']);

    expect(snapshot?.classes.map(classItem => classItem.id)).toEqual(['Person', 'Address']);
    expect(snapshot?.relationships).toEqual([personToAddress]);
  });

  it('is a copy, not a link to the original classes', () => {
    const original = makeClass('Person', 0, 0, {
      attributes: [{ id: 'Person-0', name: 'name', type: 'String', visibility: '+' }],
    });
    const snapshot = createUmlClassSnapshot([original], [], ['Person']);

    original.attributes[0].name = 'changed';

    expect(snapshot?.classes[0].attributes[0].name).toBe('name');
  });

  it('returns null when no class is selected', () => {
    expect(createUmlClassSnapshot(classes, relationships, [])).toBeNull();
    expect(createUmlClassSnapshot(classes, relationships, ['Missing'])).toBeNull();
  });
});

describe('nextCopyClassName', () => {
  it('appends _copy, then a number', () => {
    expect(nextCopyClassName('Person', new Set(['person']), new Set(['Person']))).toBe('Person_copy');
    expect(nextCopyClassName(
      'Person',
      new Set(['person', 'person_copy']),
      new Set(['Person', 'Person_copy']),
    )).toBe('Person_copy2');
    expect(nextCopyClassName(
      'Person',
      new Set(['person', 'person_copy', 'person_copy2']),
      new Set(),
    )).toBe('Person_copy3');
  });

  it('continues the numbering when a copy is copied again', () => {
    expect(nextCopyClassName(
      'Person_copy',
      new Set(['person', 'person_copy']),
      new Set(),
    )).toBe('Person_copy2');
    expect(nextCopyClassName(
      'Person_copy2',
      new Set(['person', 'person_copy', 'person_copy2']),
      new Set(),
    )).toBe('Person_copy3');
  });

  it('compares names case-insensitively', () => {
    expect(nextCopyClassName('Person', new Set(['person_copy']), new Set())).toBe('Person_copy2');
  });

  it('avoids names whose class id is already taken', () => {
    expect(nextCopyClassName('My Class', new Set(), new Set(['My_Class_copy']))).toBe('My Class_copy2');
  });
});

describe('findPasteOffset', () => {
  it('uses one offset step when that position is free', () => {
    expect(findPasteOffset([person], [person, address])).toBe(UML_PASTE_OFFSET);
  });

  it('starts at the given step', () => {
    expect(findPasteOffset([person], [address], 0)).toBe(0);
    expect(findPasteOffset([person], [person], 0)).toBe(UML_PASTE_OFFSET);
  });

  it('moves further when a class already sits at the pasted position', () => {
    const firstPaste = makeClass('Person_copy', person.x + UML_PASTE_OFFSET, person.y + UML_PASTE_OFFSET);

    expect(findPasteOffset([person], [person, firstPaste])).toBe(2 * UML_PASTE_OFFSET);
  });
});

describe('pasteUmlClassSnapshot', () => {
  it('keeps all class details and renames on a name clash', () => {
    const snapshot = createUmlClassSnapshot(classes, relationships, ['Person'])!;

    const pasted = pasteUmlClassSnapshot(snapshot, classes, relationships);

    expect(pasted.classes).toEqual([{
      ...person,
      id: 'Person_copy',
      name: 'Person_copy',
      attributes: [{ ...person.attributes[0], id: 'Person_copy-0' }],
      operations: [{ ...person.operations[0], id: 'Person_copy-op-0' }],
      x: person.x + UML_PASTE_OFFSET,
      y: person.y + UML_PASTE_OFFSET,
    }]);
    expect(pasted.relationships).toEqual([]);
  });

  it('keeps the name when the model has no class with that name', () => {
    const snapshot = createUmlClassSnapshot(classes, relationships, ['Person'])!;

    const pasted = pasteUmlClassSnapshot(snapshot, [address], []);

    expect(pasted.classes[0].id).toBe('Person');
    expect(pasted.classes[0].name).toBe('Person');
  });

  it('connects copied relationships to the new classes and keeps their details', () => {
    const snapshot = createUmlClassSnapshot(classes, relationships, ['Person', 'Address'])!;

    const pasted = pasteUmlClassSnapshot(snapshot, classes, relationships);

    expect(pasted.classes.map(classItem => classItem.id)).toEqual(['Person_copy', 'Address_copy']);
    expect(pasted.relationships).toEqual([{
      ...personToAddress,
      id: 'rel-0-copy',
      sourceId: 'Person_copy',
      targetId: 'Address_copy',
    }]);
  });

  it('keeps the positions of the pasted classes relative to each other', () => {
    const snapshot = createUmlClassSnapshot(classes, relationships, ['Person', 'Address'])!;

    const [pastedPerson, pastedAddress] = pasteUmlClassSnapshot(snapshot, classes, relationships).classes;

    expect(pastedAddress.x - pastedPerson.x).toBe(address.x - person.x);
    expect(pastedAddress.y - pastedPerson.y).toBe(address.y - person.y);
  });

  it('gives every paste new class and relationship ids', () => {
    const snapshot = createUmlClassSnapshot(classes, relationships, ['Person', 'Address'])!;
    const first = pasteUmlClassSnapshot(snapshot, classes, relationships);
    const afterFirst = {
      classes: [...classes, ...first.classes],
      relationships: [...relationships, ...first.relationships],
    };

    const second = pasteUmlClassSnapshot(snapshot, afterFirst.classes, afterFirst.relationships);

    expect(second.classes.map(classItem => classItem.name)).toEqual(['Person_copy2', 'Address_copy2']);
    expect(second.relationships[0]).toEqual(expect.objectContaining({
      id: 'rel-0-copy2',
      sourceId: 'Person_copy2',
      targetId: 'Address_copy2',
    }));
    expect(second.classes[0].x).toBe(person.x + 2 * UML_PASTE_OFFSET);
  });

  it('centers a pasted class on the given position', () => {
    const snapshot = createUmlClassSnapshot(classes, relationships, ['Person'])!;

    const pasted = pasteUmlClassSnapshot(snapshot, classes, relationships, { x: 500, y: 600 }).classes;

    const center = groupCenter(pasted);
    expect(center.x).toBeCloseTo(500, 0);
    expect(center.y).toBeCloseTo(600, 0);
  });

  it('centers several pasted classes as one group and keeps their relative positions', () => {
    const snapshot = createUmlClassSnapshot(classes, relationships, ['Person', 'Address'])!;

    const pasted = pasteUmlClassSnapshot(snapshot, classes, relationships, { x: 500, y: 600 }).classes;

    const center = groupCenter(pasted);
    expect(center.x).toBeCloseTo(500, 0);
    expect(center.y).toBeCloseTo(600, 0);
    const [pastedPerson, pastedAddress] = pasted;
    expect(pastedAddress.x - pastedPerson.x).toBe(address.x - person.x);
    expect(pastedAddress.y - pastedPerson.y).toBe(address.y - person.y);
  });

  it('moves a paste aside when a class already sits exactly at the pasted position', () => {
    const snapshot = createUmlClassSnapshot(classes, relationships, ['Person'])!;
    const position = { x: 500, y: 600 };
    const [first] = pasteUmlClassSnapshot(snapshot, classes, relationships, position).classes;

    const [second] = pasteUmlClassSnapshot(snapshot, [...classes, first], relationships, position).classes;

    expect(second.x - first.x).toBe(UML_PASTE_OFFSET);
    expect(second.y - first.y).toBe(UML_PASTE_OFFSET);
  });

  it('does not change the snapshot', () => {
    const snapshot = createUmlClassSnapshot(classes, relationships, ['Person', 'Address'])!;
    const before = structuredClone(snapshot);

    pasteUmlClassSnapshot(snapshot, classes, relationships);

    expect(snapshot).toEqual(before);
  });
});
