import { act, renderHook } from '@testing-library/react';
import { useRef, useState } from 'react';
import type { UmlDiagramClass } from '../../components/canvas/umlDiagramTypes';
import {
  useUmlDiagramPrimaryEditing,
  type UseUmlDiagramPrimaryEditingOptions,
  type UseUmlDiagramPrimaryEditingResult,
} from '../../hooks/useUmlDiagramPrimaryEditing';
import type { UMLRelationship } from '../../utils/ecoreToUml';

const EMPLOYEE: UmlDiagramClass = {
  id: 'employee',
  name: 'Employee',
  isAbstract: false,
  isInterface: false,
  attributes: [
    { id: 'employee-title', name: 'title', type: 'EString', visibility: '-' },
    { id: 'employee-code', name: 'code', type: 'EInt', visibility: '+' },
  ],
  operations: [
    {
      id: 'employee-calculate', name: 'calculate',
      returnType: 'EVoid', visibility: '+',
    },
    {
      id: 'employee-render', name: 'render',
      returnType: 'EString', visibility: '#',
    },
  ],
  x: 10,
  y: 20,
};

const DEPARTMENT: UmlDiagramClass = {
  id: 'department', name: 'Department',
  isAbstract: false, isInterface: false,
  attributes: [], operations: [],
  x: 300, y: 40,
};

const ASSOCIATION: UMLRelationship = {
  id: 'employee-department', sourceId: 'employee', targetId: 'department',
  type: 'association', label: 'assignedTo',
  sourceMultiplicity: '0..*', targetMultiplicity: '1',
};

const INHERITANCE: UMLRelationship = {
  id: 'department-employee', sourceId: 'department',
  targetId: 'employee', type: 'inheritance',
};

interface HarnessOptions extends Omit<
  UseUmlDiagramPrimaryEditingOptions,
  | 'classes'
  | 'relationships'
  | 'setClasses'
  | 'setRelationships'
  | 'setSelectedClassId'
  | 'setSelectedRelationshipId'
  | 'setConnectSourceId'
> {
  initialClasses: UmlDiagramClass[];
  initialRelationships: UMLRelationship[];
  initialSelectedClassId: string | null;
  initialSelectedRelationshipId: string | null;
  initialConnectSourceId: string | null;
}

interface HistorySnapshot {
  classes: UmlDiagramClass[];
  relationships: UMLRelationship[];
}

function usePrimaryEditingHarness(options: HarnessOptions) {
  const [classes, setClasses] = useState(options.initialClasses);
  const [relationships, setRelationships] = useState(options.initialRelationships);
  const [selectedClassId, setSelectedClassId] = useState(options.initialSelectedClassId);
  const [selectedRelationshipId, setSelectedRelationshipId] = useState(
    options.initialSelectedRelationshipId,
  );
  const [connectSourceId, setConnectSourceId] = useState(options.initialConnectSourceId);
  const recordSnapshotsRef = useRef<HistorySnapshot[]>([]);
  const editing = useUmlDiagramPrimaryEditing({
    classes,
    relationships,
    setClasses,
    setRelationships,
    setSelectedClassId,
    setSelectedRelationshipId,
    setConnectSourceId,
    recordChange: () => {
      recordSnapshotsRef.current.push(structuredClone({ classes, relationships }));
      options.recordChange();
    },
    hasAdditionalModels: options.hasAdditionalModels,
    areClassesInSameModel: options.areClassesInSameModel,
    containerRef: options.containerRef,
    getCurrentViewport: options.getCurrentViewport,
    getCurrentLayoutOffset: options.getCurrentLayoutOffset,
    scheduleDebouncedLayoutSave: options.scheduleDebouncedLayoutSave,
    scheduleLayoutSave: options.scheduleLayoutSave,
  });
  return {
    ...editing, classes, relationships,
    selectedClassId, selectedRelationshipId, connectSourceId,
    recordSnapshots: recordSnapshotsRef.current,
  };
}

function makeOptions(
  overrides: Partial<HarnessOptions> = {},
): HarnessOptions {
  return {
    initialClasses: [EMPLOYEE, DEPARTMENT],
    initialRelationships: [ASSOCIATION, INHERITANCE],
    initialSelectedClassId: null,
    initialSelectedRelationshipId: null,
    initialConnectSourceId: null,
    recordChange: jest.fn(),
    hasAdditionalModels: false,
    areClassesInSameModel: jest.fn(() => true),
    containerRef: { current: null },
    getCurrentViewport: jest.fn(() => ({ x: 0, y: 0, scale: 1 })),
    getCurrentLayoutOffset: jest.fn(() => ({ offsetX: 0, offsetY: 0 })),
    scheduleDebouncedLayoutSave: jest.fn(),
    scheduleLayoutSave: jest.fn(),
    ...overrides,
  };
}

function renderPrimaryEditing(overrides: Partial<HarnessOptions> = {}) {
  const options = makeOptions(overrides);
  const view = renderHook(
    (hookOptions: HarnessOptions) => usePrimaryEditingHarness(hookOptions),
    { initialProps: options },
  );
  return {
    options,
    ...view,
  };
}

function classById(
  classes: readonly UmlDiagramClass[],
  classId: string,
): UmlDiagramClass {
  const classItem = classes.find(candidate => candidate.id === classId);
  if (!classItem) throw new Error(`Missing class ${classId}`);
  return classItem;
}

function relationshipById(
  relationships: readonly UMLRelationship[],
  relationshipId: string,
): UMLRelationship {
  const relationship = relationships.find(candidate => candidate.id === relationshipId);
  if (!relationship) throw new Error(`Missing relationship ${relationshipId}`);
  return relationship;
}

function perform<T>(command: () => T): T {
  let value!: T;
  act(() => {
    value = command();
  });
  return value;
}

function expectedAssociation(
  id: string, sourceId = 'employee', targetId = 'department',
): UMLRelationship {
  return {
    id, sourceId, targetId, type: 'association',
    sourceMultiplicity: '1', targetMultiplicity: '0..1',
  };
}

type MemberKind = 'attribute' | 'operation';

const MEMBER_CASES = [
  { kind: 'attribute', label: 'attributes', timestampBase: 1000 },
  { kind: 'operation', label: 'operations', timestampBase: 2000 },
] as const;

function membersOf(classItem: UmlDiagramClass, kind: MemberKind) {
  return kind === 'attribute' ? classItem.attributes : classItem.operations;
}

function addMember(editing: UseUmlDiagramPrimaryEditingResult, kind: MemberKind) {
  if (kind === 'attribute') editing.addAttribute('employee');
  else editing.addOperation('employee');
}

function saveMember(
  editing: UseUmlDiagramPrimaryEditingResult,
  kind: MemberKind, memberId: string, name: string, type: string,
  visibility: '+' | '-' | '#',
) {
  if (kind === 'attribute') {
    editing.saveAttribute('employee', memberId, name, type, visibility);
  } else {
    editing.saveOperation('employee', memberId, name, type, visibility);
  }
}

function deleteMember(
  editing: UseUmlDiagramPrimaryEditingResult, kind: MemberKind, memberId: string,
) {
  if (kind === 'attribute') editing.deleteAttribute('employee', memberId);
  else editing.deleteOperation('employee', memberId);
}

function generatedMember(kind: MemberKind, timestamp: number, index: number) {
  const name = `${kind}${index === 0 ? '' : '2'}`;
  return kind === 'attribute'
    ? { id: `employee-${timestamp}`, name, type: 'String', visibility: '+' }
    : { id: `employee-op-${timestamp}`, name, returnType: 'Void', visibility: '+' };
}

function savedMember(kind: MemberKind, duplicate: boolean) {
  if (kind === 'attribute') {
    return duplicate
      ? { id: 'employee-title', name: 'code2', type: 'Int', visibility: '#' }
      : { id: 'employee-code', name: 'code', type: 'Int', visibility: '-' };
  }
  return duplicate
    ? { id: 'employee-calculate', name: 'render2', returnType: 'Int', visibility: '-' }
    : { id: 'employee-render', name: 'render', returnType: 'String', visibility: '+' };
}

describe('useUmlDiagramPrimaryEditing', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    document.body.replaceChildren();
  });

  it('constructs and cancels normalized name, attribute, and operation edit sessions', () => {
    const { result } = renderPrimaryEditing();

    perform(() => result.current.startNameEdit('employee'));
    expect(result.current.edit).toEqual({
      classId: 'employee', kind: 'name', val: 'Employee',
    });
    perform(result.current.cancelEdit);
    expect(result.current.edit).toBeNull();

    perform(() => result.current.startAttributeEdit('employee', 'employee-title'));
    expect(result.current.edit).toEqual({
      classId: 'employee', kind: 'attr', attrId: 'employee-title',
      name: 'title', type: 'String', visibility: '-',
    });
    perform(result.current.cancelEdit);

    perform(() => result.current.startOperationEdit('employee', 'employee-calculate'));
    expect(result.current.edit).toEqual({
      classId: 'employee', kind: 'op', opId: 'employee-calculate',
      name: 'calculate', returnType: 'Void', visibility: '+',
    });
  });

  it('flushes a prior edit before starting the next edit session', () => {
    const { result, options } = renderPrimaryEditing();

    perform(() => result.current.startAttributeEdit('employee', 'employee-title'));
    perform(() => result.current.changeEdit({
      classId: 'employee', kind: 'attr', attrId: 'employee-title',
      name: 'renamed', type: 'Int', visibility: '#',
    }));
    perform(() => result.current.startOperationEdit('employee', 'employee-calculate'));

    expect(classById(result.current.classes, 'employee').attributes[0])
      .toMatchObject({ name: 'renamed', type: 'Int', visibility: '#' });
    expect(options.recordChange).toHaveBeenCalledTimes(1);
    expect(result.current.edit).toEqual(expect.objectContaining({
      kind: 'op',
      opId: 'employee-calculate',
    }));
  });

  it('blurs an active editable element and only direct-flushes afterward', () => {
    const { result, options } = renderPrimaryEditing();
    perform(() => result.current.startNameEdit('employee'));
    perform(() => result.current.changeEdit({
      classId: 'employee', kind: 'name', val: 'Temporary Employee',
    }));
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    const blurSpy = jest.spyOn(input, 'blur');

    perform(result.current.flushPendingEdit);
    expect(blurSpy).toHaveBeenCalledTimes(1);
    expect(options.recordChange).not.toHaveBeenCalled();
    expect(result.current.edit).not.toBeNull();

    perform(result.current.flushPendingEdit);
    expect(options.recordChange).toHaveBeenCalledTimes(1);
    expect(result.current.edit).toBeNull();
    expect(classById(result.current.classes, 'Temporary_Employee').name)
      .toBe('Temporary Employee');
  });

  it('closes a blank inline name without recording or renaming', () => {
    const { result, options } = renderPrimaryEditing();
    perform(() => result.current.startNameEdit('employee'));
    perform(() => result.current.saveName('employee', '   '));

    expect(result.current.edit).toBeNull();
    expect(options.recordChange).not.toHaveBeenCalled();
    expect(result.current.classes).toEqual([EMPLOYEE, DEPARTMENT]);
  });

  it('renames a class and remaps members, relationships, selection, and connect source', () => {
    const { result, options } = renderPrimaryEditing({
      initialSelectedClassId: 'employee',
      initialConnectSourceId: 'employee',
    });
    const departmentBefore = result.current.classes[1];

    perform(() => result.current.saveName('employee', '  Renamed Employee  '));

    const renamed = classById(result.current.classes, 'Renamed_Employee');
    expect(renamed).toMatchObject({
      name: 'Renamed Employee',
      attributes: [
        expect.objectContaining({ id: 'Renamed_Employee-0' }),
        expect.objectContaining({ id: 'Renamed_Employee-1' }),
      ],
      operations: [
        expect.objectContaining({ id: 'Renamed_Employee-op-0' }),
        expect.objectContaining({ id: 'Renamed_Employee-op-1' }),
      ],
    });
    expect(result.current.classes[1]).toBe(departmentBefore);
    expect(relationshipById(
      result.current.relationships,
      'employee-department',
    )).toMatchObject({ sourceId: 'Renamed_Employee' });
    expect(relationshipById(
      result.current.relationships,
      'department-employee',
    )).toMatchObject({ targetId: 'Renamed_Employee' });
    expect(result.current.selectedClassId).toBe('Renamed_Employee');
    expect(result.current.connectSourceId).toBe('Renamed_Employee');
    expect(options.recordChange).toHaveBeenCalledTimes(1);
  });

  it.each(MEMBER_CASES)(
    'adds uniquely named $label with exact defaults, IDs, and edit state',
    ({ kind, timestampBase }) => {
      jest.spyOn(Date, 'now')
        .mockReturnValueOnce(timestampBase + 1)
        .mockReturnValueOnce(timestampBase + 2);
      const { result, options } = renderPrimaryEditing();

      perform(() => addMember(result.current, kind));
      const employee = () => classById(result.current.classes, 'employee');
      expect(membersOf(employee(), kind)[2])
        .toEqual(generatedMember(kind, timestampBase + 1, 0));
      expect(result.current.edit).toEqual(expect.objectContaining({
        kind: kind === 'attribute' ? 'attr' : 'op',
        [kind === 'attribute' ? 'attrId' : 'opId']:
          generatedMember(kind, timestampBase + 1, 0).id,
      }));

      perform(result.current.cancelEdit);
      perform(() => addMember(result.current, kind));
      expect(membersOf(employee(), kind)[3])
        .toEqual(generatedMember(kind, timestampBase + 2, 1));
      expect(options.recordChange).toHaveBeenCalledTimes(2);
    },
  );

  it.each(MEMBER_CASES)(
    'saves duplicate and blank $label, deletes only the target, and records exactly',
    ({ kind }) => {
      const { result, options } = renderPrimaryEditing();
      const departmentBefore = result.current.classes[1];
      const isAttribute = kind === 'attribute';
      const firstId = isAttribute ? 'employee-title' : 'employee-calculate';
      const secondId = isAttribute ? 'employee-code' : 'employee-render';
      const employee = () => classById(result.current.classes, 'employee');

      perform(() => saveMember(
        result.current,
        kind,
        firstId,
        isAttribute ? ' code ' : ' render ',
        ' EInt ',
        isAttribute ? '#' : '-',
      ));
      expect(membersOf(employee(), kind)[0]).toEqual(savedMember(kind, true));

      perform(() => saveMember(
        result.current,
        kind,
        secondId,
        '   ',
        '   ',
        isAttribute ? '-' : '+',
      ));
      expect(membersOf(employee(), kind)[1]).toEqual(savedMember(kind, false));

      perform(() => deleteMember(result.current, kind, firstId));
      expect(membersOf(employee(), kind))
        .toEqual([expect.objectContaining({ id: secondId })]);
      expect(result.current.classes[1]).toBe(departmentBefore);
      expect(options.recordChange).toHaveBeenCalledTimes(3);
    },
  );

  it('preserves panel update timing for blank, boolean, and rename patches', () => {
    const { result, options } = renderPrimaryEditing({
      initialSelectedClassId: 'employee',
      initialConnectSourceId: 'employee',
    });

    perform(() => result.current.updateClass('employee', { name: '   ' }));
    expect(result.current.classes).toEqual([EMPLOYEE, DEPARTMENT]);
    expect(options.recordChange).toHaveBeenCalledTimes(1);

    perform(() => result.current.updateClass('employee', { isAbstract: true }));
    perform(() => result.current.updateClass('employee', { isInterface: true }));
    expect(classById(result.current.classes, 'employee')).toMatchObject({
      isAbstract: true, isInterface: true,
    });

    perform(() => result.current.updateClass('employee', {
      name: ' Team Lead ',
      isAbstract: false,
    }));
    expect(classById(result.current.classes, 'Team_Lead')).toMatchObject({
      name: 'Team Lead', isAbstract: true, isInterface: true,
    });
    expect(result.current.selectedClassId).toBe('Team_Lead');
    expect(result.current.connectSourceId).toBe('Team_Lead');
    expect(options.recordChange).toHaveBeenCalledTimes(4);
  });

  it('deletes a class with its relationships and conditionally clears owned state', () => {
    const { result, options } = renderPrimaryEditing({
      initialSelectedClassId: 'employee',
      initialSelectedRelationshipId: 'employee-department',
      initialConnectSourceId: 'employee',
    });
    perform(() => result.current.startAttributeEdit('employee', 'employee-title'));
    perform(() => result.current.deleteClass('employee'));

    expect(result.current.classes).toEqual([DEPARTMENT]);
    expect(result.current.relationships).toEqual([]);
    expect(result.current.selectedClassId).toBeNull();
    expect(result.current.connectSourceId).toBeNull();
    expect(result.current.edit).toBeNull();
    expect(result.current.selectedRelationshipId).toBe('employee-department');
    expect(options.recordChange).toHaveBeenCalledTimes(1);
  });

  it('gets, replaces, clears, and self-clears inheritance with one parent', () => {
    jest.spyOn(Date, 'now')
      .mockReturnValueOnce(3001)
      .mockReturnValueOnce(3002);
    const duplicateOutgoing: UMLRelationship = {
      id: 'department-company', sourceId: 'department',
      targetId: 'company', type: 'inheritance',
    };
    const incoming: UMLRelationship = {
      id: 'company-department-inheritance', sourceId: 'company',
      targetId: 'department', type: 'inheritance',
    };
    const { result, options } = renderPrimaryEditing({
      initialRelationships: [ASSOCIATION, INHERITANCE, duplicateOutgoing, incoming],
    });

    expect(result.current.getInheritanceParentId('department')).toBe('employee');
    expect(result.current.getInheritanceParentId('employee')).toBeNull();

    perform(() => result.current.setInheritanceParent('department', 'company'));
    expect(result.current.relationships.filter(relationship => (
      relationship.type === 'inheritance'
        && relationship.sourceId === 'department'
    ))).toEqual([{
      id: 'rel-3001', sourceId: 'department',
      targetId: 'company', type: 'inheritance',
    }]);
    expect(result.current.relationships).toContainEqual(ASSOCIATION);
    expect(result.current.relationships).toContainEqual(incoming);

    perform(() => result.current.setInheritanceParent('department', null));
    expect(result.current.getInheritanceParentId('department')).toBeNull();

    perform(() => result.current.setInheritanceParent('department', 'employee'));
    expect(result.current.getInheritanceParentId('department')).toBe('employee');
    perform(() => result.current.setInheritanceParent('department', 'department'));
    expect(result.current.getInheritanceParentId('department')).toBeNull();
    expect(options.recordChange).toHaveBeenCalledTimes(4);
  });

  it('adds fallback and viewport-centered classes with unique names and selection', () => {
    const {
      result: fallbackResult,
      options: fallbackOptions,
      unmount: unmountFallback,
    } = renderPrimaryEditing();
    perform(fallbackResult.current.addClass);
    perform(fallbackResult.current.addClass);

    expect(fallbackResult.current.classes.slice(-2)).toEqual([
      {
        id: 'NewClass', name: 'NewClass',
        isAbstract: false, isInterface: false,
        attributes: [], operations: [],
        x: 200, y: 120,
      },
      {
        id: 'NewClass1', name: 'NewClass1',
        isAbstract: false, isInterface: false,
        attributes: [], operations: [],
        x: 200, y: 120,
      },
    ]);
    expect(fallbackResult.current.selectedClassId).toBe('NewClass1');
    expect(fallbackOptions.getCurrentViewport).toHaveBeenCalledTimes(2);
    expect(fallbackOptions.getCurrentLayoutOffset).toHaveBeenCalledTimes(2);
    unmountFallback();

    const container = document.createElement('section');
    Object.defineProperties(container, {
      clientWidth: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 800 },
    });
    const { result: centeredResult } = renderPrimaryEditing({
      containerRef: { current: container },
      getCurrentViewport: jest.fn(() => ({ x: 20, y: 30, scale: 2 })),
      getCurrentLayoutOffset: jest.fn(() => ({ offsetX: 100, offsetY: 80 })),
    });
    perform(centeredResult.current.addClass);
    expect(classById(centeredResult.current.classes, 'NewClass'))
      .toMatchObject({ x: -4, y: 33 });
  });

  it('records once per class drag gesture and schedules movement and final layout saves', () => {
    const { result, options } = renderPrimaryEditing();
    const departmentBefore = result.current.classes[1];

    perform(result.current.beginClassDrag);
    perform(() => result.current.moveClass('employee', 30, 40));
    perform(() => result.current.moveClass('employee', 50, 60));
    perform(result.current.finishClassDrag);

    expect(classById(result.current.classes, 'employee'))
      .toMatchObject({ x: 50, y: 60 });
    expect(result.current.classes[1]).toBe(departmentBefore);
    expect(options.recordChange).toHaveBeenCalledTimes(1);
    expect(options.scheduleDebouncedLayoutSave).toHaveBeenCalledTimes(2);
    expect(options.scheduleLayoutSave).toHaveBeenCalledTimes(1);

    perform(result.current.beginClassDrag);
    perform(() => result.current.moveClass('employee', 70, 80));
    perform(result.current.finishClassDrag);
    expect(options.recordChange).toHaveBeenCalledTimes(2);
    expect(options.scheduleLayoutSave).toHaveBeenCalledTimes(2);
  });

  it('rejects self, duplicate, and cross-model relationships without history', () => {
    const {
      result: selfAndDuplicateResult,
      options: selfAndDuplicateOptions,
      unmount: unmountSelfAndDuplicate,
    } = renderPrimaryEditing({
      hasAdditionalModels: true,
      areClassesInSameModel: jest.fn(() => true),
    });
    expect(perform(() => selfAndDuplicateResult.current.addRelationship(
      'employee',
      'employee',
    ))).toBe(false);
    expect(selfAndDuplicateOptions.areClassesInSameModel).not.toHaveBeenCalled();
    expect(perform(() => selfAndDuplicateResult.current.addRelationship(
      'employee',
      'department',
    ))).toBe(false);
    expect(selfAndDuplicateOptions.recordChange).not.toHaveBeenCalled();
    unmountSelfAndDuplicate();

    const {
      result: crossModelResult,
      options: crossModelOptions,
    } = renderPrimaryEditing({
      initialRelationships: [],
      hasAdditionalModels: true,
      areClassesInSameModel: jest.fn(() => false),
    });
    expect(perform(() => crossModelResult.current.addRelationship(
      'employee',
      'department',
    ))).toBe(false);
    expect(crossModelOptions.areClassesInSameModel)
      .toHaveBeenCalledWith('employee', 'department');
    expect(crossModelOptions.recordChange).not.toHaveBeenCalled();
  });

  it('creates a same-model relationship with exact defaults and selection', () => {
    jest.spyOn(Date, 'now').mockReturnValue(4001);
    const { result, options } = renderPrimaryEditing({
      initialRelationships: [],
      hasAdditionalModels: true,
      areClassesInSameModel: jest.fn(() => true),
    });
    expect(perform(() => result.current.addRelationship('employee', 'department')))
      .toBe(true);
    expect(result.current.relationships)
      .toEqual([expectedAssociation('rel-4001')]);
    expect(result.current.selectedRelationshipId).toBe('rel-4001');
    expect(options.recordChange).toHaveBeenCalledTimes(1);
  });

  it('allows reverse associations and ignores other edge types when checking duplicates', () => {
    jest.spyOn(Date, 'now').mockReturnValue(4002);
    const areClassesInSameModel = jest.fn(() => false);
    const { result, options } = renderPrimaryEditing({
      areClassesInSameModel,
    });
    expect(perform(() => result.current.addRelationship('department', 'employee')))
      .toBe(true);
    expect(areClassesInSameModel).not.toHaveBeenCalled();
    expect(result.current.relationships).toContainEqual(
      expectedAssociation('rel-4002', 'department', 'employee'),
    );
    expect(options.recordChange).toHaveBeenCalledTimes(1);
  });

  it('records pre-mutation snapshots before generating IDs and applying relationship changes', () => {
    const events: string[] = [];
    const { result } = renderPrimaryEditing({
      initialRelationships: [],
      recordChange: jest.fn(() => events.push('record')),
    });
    jest.spyOn(Date, 'now').mockImplementation(() => {
      events.push('date');
      return 7001;
    });

    perform(() => result.current.addAttribute('employee'));
    expect(events).toEqual(['record', 'date']);
    expect(result.current.recordSnapshots[0]).toEqual({
      classes: [EMPLOYEE, DEPARTMENT], relationships: [],
    });

    events.length = 0;
    perform(() => result.current.addRelationship('employee', 'department'));
    expect(events).toEqual(['record', 'date']);
    expect(result.current.recordSnapshots[1]).toEqual({
      classes: result.current.classes, relationships: [],
    });

    perform(() => result.current.updateRelationship('rel-7001', {
      label: 'manages',
    }));
    expect(result.current.recordSnapshots[2].relationships)
      .toEqual([expectedAssociation('rel-7001')]);

    perform(() => result.current.deleteRelationship('rel-7001'));
    expect(result.current.recordSnapshots[3].relationships).toEqual([
      expect.objectContaining({ id: 'rel-7001', label: 'manages' }),
    ]);
  });

  it('updates and deletes relationships while preserving fields and selection cleanup', () => {
    const { result, options } = renderPrimaryEditing({
      initialSelectedRelationshipId: 'employee-department',
    });
    const inheritanceBefore = result.current.relationships[1];

    perform(() => result.current.updateRelationship(
      'employee-department',
      { label: 'manages', targetMultiplicity: '0..1' },
    ));
    expect(relationshipById(
      result.current.relationships,
      'employee-department',
    )).toEqual({
      ...ASSOCIATION,
      label: 'manages', targetMultiplicity: '0..1',
    });
    expect(result.current.relationships[1]).toBe(inheritanceBefore);

    perform(() => result.current.deleteRelationship('employee-department'));
    expect(result.current.relationships).toEqual([INHERITANCE]);
    expect(result.current.selectedRelationshipId).toBeNull();
    expect(options.recordChange).toHaveBeenCalledTimes(2);
  });
});
