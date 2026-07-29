import type { UMLRelationship } from '../../../utils/ecoreToUml';
import {
  applyWrapperDragToClass,
  mergeAdditionalClassesWithPositions,
  nextUniqueClassName,
  removeAttributeFromClass,
  removeOperationFromClass,
  renameClassInList,
  renameClassInRelationships,
  updateClassAttribute,
  updateClassById,
  updateClassOperation,
} from '../../../components/canvas/umlDiagramClassTransforms';
import type { UmlDiagramClass } from '../../../components/canvas/umlDiagramTypes';

function createClass(
  overrides: Partial<UmlDiagramClass> = {},
): UmlDiagramClass {
  return {
    id: 'employee',
    name: 'Employee',
    isAbstract: false,
    isInterface: false,
    attributes: [
      {
        id: 'employee-legacy-name',
        name: 'title',
        type: 'EString',
        visibility: '-',
      },
      {
        id: 'employee-legacy-code',
        name: 'code',
        type: 'EInt',
        visibility: '+',
      },
    ],
    operations: [
      {
        id: 'employee-legacy-calculate',
        name: 'calculate',
        returnType: 'EVoid',
        visibility: '+',
      },
      {
        id: 'employee-legacy-render',
        name: 'render',
        returnType: 'EString',
        visibility: '#',
      },
    ],
    x: 10,
    y: 20,
    ...overrides,
  };
}

describe('umlDiagramClassTransforms', () => {
  it('generates the existing unique default class-name sequence', () => {
    expect(nextUniqueClassName([])).toBe('NewClass');
    expect(nextUniqueClassName(['NewClass'])).toBe('NewClass1');
    expect(nextUniqueClassName(
      new Set(['NewClass', 'NewClass1', 'NewClass2']),
    )).toBe('NewClass3');
  });

  it('renames a class and remaps member IDs without mutating the input', () => {
    const employee = createClass();
    const department = createClass({
      id: 'department',
      name: 'Department',
      attributes: [],
      operations: [],
    });
    const classes = [employee, department];

    const renamed = renameClassInList(
      classes,
      'employee',
      'renamed-employee',
      'Renamed Employee',
    );

    expect(renamed).not.toBe(classes);
    expect(renamed[0]).toMatchObject({
      id: 'renamed-employee',
      name: 'Renamed Employee',
    });
    expect(renamed[0].attributes.map(attribute => attribute.id)).toEqual([
      'renamed-employee-0',
      'renamed-employee-1',
    ]);
    expect(renamed[0].operations.map(operation => operation.id)).toEqual([
      'renamed-employee-op-0',
      'renamed-employee-op-1',
    ]);
    expect(renamed[1]).toBe(department);
    expect(employee.id).toBe('employee');
    expect(employee.attributes[0].id).toBe('employee-legacy-name');
    expect(employee.operations[0].id).toBe('employee-legacy-calculate');
  });

  it('rewrites relationship source and target endpoints immutably', () => {
    const relationships: UMLRelationship[] = [
      {
        id: 'source-match',
        sourceId: 'employee',
        targetId: 'department',
        type: 'association',
      },
      {
        id: 'target-match',
        sourceId: 'department',
        targetId: 'employee',
        type: 'inheritance',
      },
      {
        id: 'no-match',
        sourceId: 'department',
        targetId: 'company',
        type: 'composition',
      },
    ];

    const renamed = renameClassInRelationships(
      relationships,
      'employee',
      'renamed-employee',
    );

    expect(renamed.map(relationship => [
      relationship.sourceId,
      relationship.targetId,
    ])).toEqual([
      ['renamed-employee', 'department'],
      ['department', 'renamed-employee'],
      ['department', 'company'],
    ]);
    expect(renamed).not.toBe(relationships);
    expect(renamed[0]).not.toBe(relationships[0]);
    expect(relationships[0].sourceId).toBe('employee');
    expect(relationships[1].targetId).toBe('employee');
  });

  it('updates only the requested class by ID', () => {
    const employee = createClass();
    const department = createClass({
      id: 'department',
      name: 'Department',
    });

    const updated = updateClassById(
      [employee, department],
      'employee',
      classItem => ({ ...classItem, isAbstract: true }),
    );

    expect(updated[0].isAbstract).toBe(true);
    expect(updated[0]).not.toBe(employee);
    expect(updated[1]).toBe(department);
    expect(employee.isAbstract).toBe(false);
  });

  it('saves attributes with duplicate and blank-name handling plus type normalization', () => {
    const employee = createClass();
    const classes = [employee];

    const duplicateName = updateClassAttribute(
      classes,
      'employee',
      'employee-legacy-name',
      ' code ',
      ' EInt ',
      '#',
    );
    expect(duplicateName[0].attributes[0]).toEqual({
      id: 'employee-legacy-name',
      name: 'code2',
      type: 'Int',
      visibility: '#',
    });

    const blankNameAndType = updateClassAttribute(
      classes,
      'employee',
      'employee-legacy-name',
      '   ',
      '   ',
      '+',
    );
    expect(blankNameAndType[0].attributes[0]).toEqual({
      id: 'employee-legacy-name',
      name: 'title',
      type: 'String',
      visibility: '+',
    });

    expect(classes).toEqual([employee]);
    expect(employee.attributes[0]).toEqual({
      id: 'employee-legacy-name',
      name: 'title',
      type: 'EString',
      visibility: '-',
    });
  });

  it('saves operations with duplicate and blank-name handling plus return-type normalization', () => {
    const employee = createClass();
    const classes = [employee];

    const duplicateName = updateClassOperation(
      classes,
      'employee',
      'employee-legacy-calculate',
      ' render ',
      ' EInt ',
      '-',
    );
    expect(duplicateName[0].operations[0]).toEqual({
      id: 'employee-legacy-calculate',
      name: 'render2',
      returnType: 'Int',
      visibility: '-',
    });

    const blankNameAndType = updateClassOperation(
      classes,
      'employee',
      'employee-legacy-calculate',
      '   ',
      '   ',
      '#',
    );
    expect(blankNameAndType[0].operations[0]).toEqual({
      id: 'employee-legacy-calculate',
      name: 'calculate',
      returnType: 'Void',
      visibility: '#',
    });

    expect(classes).toEqual([employee]);
    expect(employee.operations[0]).toEqual({
      id: 'employee-legacy-calculate',
      name: 'calculate',
      returnType: 'EVoid',
      visibility: '+',
    });
  });

  it('removes attributes and operations without mutating the source class', () => {
    const employee = createClass();

    const withoutAttribute = removeAttributeFromClass(
      employee,
      'employee-legacy-name',
    );
    const withoutOperation = removeOperationFromClass(
      employee,
      'employee-legacy-calculate',
    );

    expect(withoutAttribute.attributes.map(attribute => attribute.id)).toEqual([
      'employee-legacy-code',
    ]);
    expect(withoutOperation.operations.map(operation => operation.id)).toEqual([
      'employee-legacy-render',
    ]);
    expect(employee.attributes).toHaveLength(2);
    expect(employee.operations).toHaveLength(2);
  });

  it('merges additional classes while retaining prior positions', () => {
    const previous = [
      createClass({ x: 15, y: 25 }),
    ];
    const incomingEmployee = createClass({
      name: 'Updated Employee',
      x: 300,
      y: 400,
    });
    const incomingDepartment = createClass({
      id: 'department',
      name: 'Department',
      attributes: [],
      operations: [],
      x: 500,
      y: 600,
    });
    const incoming = [incomingEmployee, incomingDepartment];

    const merged = mergeAdditionalClassesWithPositions(previous, incoming);

    expect(merged[0]).toMatchObject({
      name: 'Updated Employee',
      x: 15,
      y: 25,
    });
    expect(merged[0]).not.toBe(incomingEmployee);
    expect(merged[1]).toBe(incomingDepartment);
    expect(previous[0]).toMatchObject({ x: 15, y: 25 });
    expect(incomingEmployee).toMatchObject({ x: 300, y: 400 });
  });

  it('applies wrapper drag deltas from original positions immutably', () => {
    const employee = createClass({ x: 100, y: 200 });
    const origins = new Map([
      ['employee', { x: 10, y: 20 }],
    ]);

    const moved = applyWrapperDragToClass(employee, origins, 7.5, -4);

    expect(moved).toMatchObject({ x: 17.5, y: 16 });
    expect(moved).not.toBe(employee);
    expect(employee).toMatchObject({ x: 100, y: 200 });
    expect(applyWrapperDragToClass(
      employee,
      new Map(),
      7.5,
      -4,
    )).toBe(employee);
  });
});
