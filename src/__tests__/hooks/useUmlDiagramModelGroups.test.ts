import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import type { UmlDiagramClass } from '../../components/canvas/umlDiagramTypes';
import {
  useUmlDiagramModelGroups,
  type UmlDiagramAdditionalModel,
  type UseUmlDiagramModelGroupsOptions,
} from '../../hooks/useUmlDiagramModelGroups';
import {
  ecoreToUml,
  type UMLModel,
  type UMLRelationship,
} from '../../utils/ecoreToUml';
import { computeUmlModelGroups } from '../../utils/umlModelGroups';
import { getUmlClassBoxHeight } from '../../components/canvas/umlDiagramLayoutGeometry';
import { UML_CLASS_BOX_WIDTH } from '../../components/canvas/umlDiagramClassMetrics';

jest.mock('../../utils/ecoreToUml', () => {
  const actual = jest.requireActual('../../utils/ecoreToUml');
  return {
    ...actual,
    ecoreToUml: jest.fn(),
  };
});

const mockedEcoreToUml = ecoreToUml as jest.MockedFunction<typeof ecoreToUml>;

const PRIMARY_A: UmlDiagramClass = {
  id: 'PrimaryA',
  name: 'Primary A',
  isAbstract: false,
  isInterface: false,
  attributes: [],
  operations: [],
  x: 0,
  y: 0,
};

const PRIMARY_B: UmlDiagramClass = {
  id: 'PrimaryB',
  name: 'Primary B',
  isAbstract: false,
  isInterface: false,
  attributes: [],
  operations: [],
  x: 250,
  y: 100,
};

const PRIMARY_RELATIONSHIP: UMLRelationship = {
  id: 'primary-rel',
  sourceId: 'PrimaryA',
  targetId: 'PrimaryB',
  type: 'inheritance',
};

const MODEL_ONE: UmlDiagramAdditionalModel = {
  id: 10,
  name: 'One',
  ecoreContent: 'model-one',
  color: '#dc2626',
  fill: 'rgba(220,38,38,0.06)',
};

const MODEL_TWO: UmlDiagramAdditionalModel = {
  id: 20,
  name: 'Two',
  ecoreContent: 'model-two',
  color: '#059669',
  fill: 'rgba(5,150,105,0.06)',
};

const PARSED_MODEL_ONE = {
  classes: [
    {
      id: 'Alpha',
      name: 'Alpha',
      isAbstract: false,
      isInterface: false,
      attributes: [],
      x: 10,
      y: 20,
    },
    {
      id: 'Beta',
      name: 'Beta',
      isAbstract: false,
      isInterface: false,
      attributes: [],
      operations: [],
      x: 210,
      y: 60,
    },
  ],
  relationships: [{
    id: 'alpha-beta',
    sourceId: 'Alpha',
    targetId: 'Beta',
    type: 'association',
  }],
} as unknown as UMLModel;

const PARSED_MODEL_ONE_UPDATED: UMLModel = {
  classes: [
    {
      id: 'Alpha',
      name: 'Alpha updated',
      isAbstract: false,
      isInterface: false,
      attributes: [{
        id: 'Alpha-0',
        name: 'value',
        type: 'String',
        visibility: '+',
      }],
      operations: [],
      x: 999,
      y: 999,
    },
    {
      id: 'Delta',
      name: 'Delta',
      isAbstract: false,
      isInterface: false,
      attributes: [],
      operations: [],
      x: 50,
      y: 70,
    },
  ],
  relationships: [{
    id: 'alpha-delta',
    sourceId: 'Alpha',
    targetId: 'Delta',
    type: 'composition',
  }],
};

const PARSED_MODEL_TWO: UMLModel = {
  classes: [{
    id: 'Gamma',
    name: 'Gamma',
    isAbstract: false,
    isInterface: false,
    attributes: [],
    operations: [],
    x: 30,
    y: 40,
  }],
  relationships: [{
    id: 'gamma-loop',
    sourceId: 'Gamma',
    targetId: 'Gamma',
    type: 'association',
  }],
};

interface HarnessOptions extends Omit<
  UseUmlDiagramModelGroupsOptions,
  'primaryClasses' | 'setPrimaryClasses'
> {
  initialPrimaryClasses: UmlDiagramClass[];
}

function useModelGroupsHarness(options: HarnessOptions) {
  const [primaryClasses, setPrimaryClasses] = useState(
    options.initialPrimaryClasses,
  );
  const modelGroups = useUmlDiagramModelGroups({
    primaryClasses,
    primaryRelationships: options.primaryRelationships,
    setPrimaryClasses,
    primaryModelName: options.primaryModelName,
    additionalModels: options.additionalModels,
  });
  return { ...modelGroups, primaryClasses };
}

function makeOptions(
  overrides: Partial<HarnessOptions> = {},
): HarnessOptions {
  return {
    initialPrimaryClasses: [PRIMARY_A, PRIMARY_B],
    primaryRelationships: [PRIMARY_RELATIONSHIP],
    primaryModelName: 'Main',
    additionalModels: [MODEL_ONE],
    ...overrides,
  };
}

function renderModelGroups(overrides: Partial<HarnessOptions> = {}) {
  const options = makeOptions(overrides);
  return {
    options,
    ...renderHook(
      (hookOptions: HarnessOptions) => useModelGroupsHarness(hookOptions),
      { initialProps: options },
    ),
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

describe('useUmlDiagramModelGroups', () => {
  beforeEach(() => {
    mockedEcoreToUml.mockImplementation(content => {
      if (content === 'malformed') throw new Error('Malformed Ecore');
      if (content === 'model-one-updated') return PARSED_MODEL_ONE_UPDATED;
      if (content === 'model-two') return PARSED_MODEL_TWO;
      return PARSED_MODEL_ONE;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('parses, namespaces, offsets, and combines multiple models in primary-first order', () => {
    const { result } = renderModelGroups({
      additionalModels: [MODEL_ONE, MODEL_TWO],
    });

    expect(mockedEcoreToUml).toHaveBeenNthCalledWith(1, 'model-one');
    expect(mockedEcoreToUml).toHaveBeenNthCalledWith(2, 'model-two');
    expect(result.current.additionalClasses.map(classItem => classItem.id)).toEqual([
      'addl-10-Alpha',
      'addl-10-Beta',
      'addl-20-Gamma',
    ]);
    expect(classById(result.current.additionalClasses, 'addl-10-Alpha')).toMatchObject({
      x: 460,
      y: 20,
      operations: [],
    });
    expect(classById(result.current.additionalClasses, 'addl-10-Beta')).toMatchObject({
      x: 660,
      y: 60,
    });
    expect(classById(result.current.additionalClasses, 'addl-20-Gamma')).toMatchObject({
      x: 930,
      y: 40,
    });
    expect(result.current.allClasses.map(classItem => classItem.id)).toEqual([
      'PrimaryA',
      'PrimaryB',
      'addl-10-Alpha',
      'addl-10-Beta',
      'addl-20-Gamma',
    ]);
    expect(result.current.allRelationships).toEqual([
      PRIMARY_RELATIONSHIP,
      expect.objectContaining({
        id: 'addl-10-alpha-beta',
        sourceId: 'addl-10-Alpha',
        targetId: 'addl-10-Beta',
      }),
      expect.objectContaining({
        id: 'addl-20-gamma-loop',
        sourceId: 'addl-20-Gamma',
        targetId: 'addl-20-Gamma',
      }),
    ]);
  });

  it('derives model metadata, colors, membership, and bounds through the existing geometry', () => {
    const { result } = renderModelGroups({
      additionalModels: [MODEL_ONE, MODEL_TWO],
    });

    expect(result.current.classModelMap.get('PrimaryA')).toEqual({
      name: 'Main',
      color: '#2563eb',
      fill: 'rgba(37,99,235,0.06)',
    });
    expect(result.current.classModelMap.get('addl-10-Alpha')).toEqual({
      name: 'One',
      color: MODEL_ONE.color,
      fill: MODEL_ONE.fill,
    });
    expect(result.current.classModelMap.get('addl-20-Gamma')).toEqual({
      name: 'Two',
      color: MODEL_TWO.color,
      fill: MODEL_TWO.fill,
    });
    expect(result.current.removableModelNames).toEqual(new Set(['One', 'Two']));
    expect(result.current.modelGroups).toEqual(computeUmlModelGroups(
      result.current.allClasses,
      new Map(result.current.classModelMap),
      getUmlClassBoxHeight,
      UML_CLASS_BOX_WIDTH,
    ));
    expect(result.current.modelGroups.map(group => group.name)).toEqual([
      'Main',
      'One',
      'Two',
    ]);
  });

  it('omits primary group metadata and wrappers when there are no additional models', () => {
    const { result } = renderModelGroups({ additionalModels: [] });

    expect(result.current.additionalClasses).toEqual([]);
    expect(result.current.allClasses).toEqual([PRIMARY_A, PRIMARY_B]);
    expect(result.current.allRelationships).toEqual([PRIMARY_RELATIONSHIP]);
    expect(result.current.classModelMap.size).toBe(0);
    expect(result.current.modelGroups).toEqual([]);
    expect(result.current.removableModelNames.size).toBe(0);
  });

  it('isolates malformed additional Ecore while retaining later index offsets', () => {
    const malformed: UmlDiagramAdditionalModel = {
      ...MODEL_ONE,
      id: 99,
      name: 'Broken',
      ecoreContent: 'malformed',
    };
    const { result } = renderModelGroups({
      additionalModels: [malformed, MODEL_TWO],
    });

    expect(result.current.additionalClasses).toHaveLength(1);
    expect(result.current.additionalClasses[0]).toMatchObject({
      id: 'addl-20-Gamma',
      x: 930,
      y: 40,
    });
    expect(result.current.allRelationships).toEqual([
      PRIMARY_RELATIONSHIP,
      expect.objectContaining({
        id: 'addl-20-gamma-loop',
        sourceId: 'addl-20-Gamma',
        targetId: 'addl-20-Gamma',
      }),
    ]);
    expect(result.current.classModelMap.has('addl-99-Alpha')).toBe(false);
    expect(result.current.removableModelNames).toEqual(new Set(['Broken', 'Two']));
  });

  it('preserves matching live positions while refreshing data and removes stale model data', () => {
    const { result, rerender, options } = renderModelGroups();

    act(() => {
      result.current.moveAdditionalClass('addl-10-Alpha', 777, 888);
    });
    const refreshedModel = {
      ...MODEL_ONE,
      ecoreContent: 'model-one-updated',
    };
    rerender({ ...options, additionalModels: [refreshedModel] });

    expect(result.current.additionalClasses.map(classItem => classItem.id)).toEqual([
      'addl-10-Alpha',
      'addl-10-Delta',
    ]);
    expect(classById(result.current.additionalClasses, 'addl-10-Alpha')).toMatchObject({
      name: 'Alpha updated',
      x: 777,
      y: 888,
      attributes: [expect.objectContaining({ name: 'value' })],
    });
    expect(classById(result.current.additionalClasses, 'addl-10-Delta')).toMatchObject({
      x: 500,
      y: 70,
    });
    expect(result.current.allRelationships.map(relationship => relationship.id)).toEqual([
      'primary-rel',
      'addl-10-alpha-delta',
    ]);

    rerender({ ...options, additionalModels: [] });
    expect(result.current.additionalClasses).toEqual([]);
    expect(result.current.allRelationships).toEqual([PRIMARY_RELATIONSHIP]);
    expect(result.current.classModelMap.size).toBe(0);
  });

  it('removes only stale models while preserving surviving model data and live positions', () => {
    const { result, rerender, options } = renderModelGroups({
      additionalModels: [MODEL_ONE, MODEL_TWO],
    });

    act(() => {
      result.current.moveAdditionalClass('addl-20-Gamma', 1111, 1222);
    });
    rerender({ ...options, additionalModels: [MODEL_TWO] });

    expect(result.current.additionalClasses).toHaveLength(1);
    expect(result.current.additionalClasses[0]).toMatchObject({
      id: 'addl-20-Gamma',
      x: 1111,
      y: 1222,
    });
    expect(result.current.allRelationships).toEqual([
      PRIMARY_RELATIONSHIP,
      expect.objectContaining({ id: 'addl-20-gamma-loop' }),
    ]);
    expect(result.current.classModelMap.has('addl-10-Alpha')).toBe(false);
    expect(result.current.classModelMap.get('addl-20-Gamma')?.name).toBe('Two');
    expect(result.current.removableModelNames).toEqual(new Set(['Two']));
  });

  it('moves one additional class immutably without changing primary or peer classes', () => {
    const { result } = renderModelGroups();
    const primaryRefs = result.current.primaryClasses;
    const alphaBefore = classById(result.current.additionalClasses, 'addl-10-Alpha');
    const betaBefore = classById(result.current.additionalClasses, 'addl-10-Beta');

    act(() => {
      result.current.moveAdditionalClass('addl-10-Alpha', 700, 800);
    });

    const alphaAfter = classById(result.current.additionalClasses, 'addl-10-Alpha');
    const betaAfter = classById(result.current.additionalClasses, 'addl-10-Beta');
    expect(alphaAfter).toMatchObject({ x: 700, y: 800 });
    expect(alphaAfter).not.toBe(alphaBefore);
    expect(betaAfter).toBe(betaBefore);
    expect(result.current.primaryClasses[0]).toBe(primaryRefs[0]);
    expect(result.current.primaryClasses[1]).toBe(primaryRefs[1]);
    expect(alphaBefore).toMatchObject({ x: 460, y: 20 });
  });

  it('checks same-model membership for primary, additional, cross-model, and unknown IDs', () => {
    const { result } = renderModelGroups({
      additionalModels: [MODEL_ONE, MODEL_TWO],
    });

    expect(result.current.areClassesInSameModel('PrimaryA', 'PrimaryB')).toBe(true);
    expect(result.current.areClassesInSameModel('addl-10-Alpha', 'addl-10-Beta')).toBe(true);
    expect(result.current.areClassesInSameModel('addl-10-Alpha', 'addl-20-Gamma')).toBe(false);
    expect(result.current.areClassesInSameModel('PrimaryA', 'addl-10-Alpha')).toBe(false);
    expect(result.current.areClassesInSameModel('PrimaryA', 'missing')).toBe(false);
    expect(result.current.areClassesInSameModel('missing-a', 'missing-b')).toBe(false);
  });

  it('moves the primary group from drag-start origins and clears origins on completion', () => {
    const { result } = renderModelGroups();
    const originalPrimary = result.current.primaryClasses;
    const originalAdditional = result.current.additionalClasses;

    act(() => {
      result.current.moveGroupDrag('Main', 50, 60);
    });
    expect(result.current.primaryClasses).toEqual(originalPrimary);

    act(() => {
      result.current.beginGroupDrag('Main');
      result.current.moveGroupDrag('Main', 10, 20);
    });
    expect(classById(result.current.primaryClasses, 'PrimaryA')).toMatchObject({
      x: 10,
      y: 20,
    });
    expect(classById(result.current.primaryClasses, 'PrimaryB')).toMatchObject({
      x: 260,
      y: 120,
    });

    act(() => {
      result.current.moveGroupDrag('Main', 30, 40);
    });
    expect(classById(result.current.primaryClasses, 'PrimaryA')).toMatchObject({
      x: 30,
      y: 40,
    });
    expect(classById(result.current.primaryClasses, 'PrimaryB')).toMatchObject({
      x: 280,
      y: 140,
    });
    expect(result.current.additionalClasses[0]).toBe(originalAdditional[0]);
    expect(result.current.additionalClasses[1]).toBe(originalAdditional[1]);
    expect(PRIMARY_A).toMatchObject({ x: 0, y: 0 });
    expect(PRIMARY_B).toMatchObject({ x: 250, y: 100 });

    act(() => {
      result.current.endGroupDrag();
    });
    const afterEnd = result.current.primaryClasses;
    act(() => {
      result.current.moveGroupDrag('Main', 100, 100);
    });
    expect(result.current.primaryClasses[0]).toBe(afterEnd[0]);
    expect(result.current.primaryClasses[1]).toBe(afterEnd[1]);
    expect(result.current.primaryClasses.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 30, y: 40 },
      { x: 280, y: 140 },
    ]);
  });

  it('moves exactly one additional group while preserving all unchanged object identities', () => {
    const { result } = renderModelGroups({
      additionalModels: [MODEL_ONE, MODEL_TWO],
    });
    const primaryBefore = result.current.primaryClasses;
    const oneBetaBefore = classById(result.current.additionalClasses, 'addl-10-Beta');
    const twoBefore = classById(result.current.additionalClasses, 'addl-20-Gamma');

    act(() => {
      result.current.moveAdditionalClass('addl-10-Alpha', 700, 800);
    });
    const oneAlphaBefore = classById(result.current.additionalClasses, 'addl-10-Alpha');

    act(() => {
      result.current.beginGroupDrag('One');
    });
    act(() => {
      result.current.moveGroupDrag('One', -25, 15);
    });
    act(() => {
      result.current.endGroupDrag();
    });

    expect(classById(result.current.additionalClasses, 'addl-10-Alpha')).toMatchObject({
      x: 675,
      y: 815,
    });
    expect(classById(result.current.additionalClasses, 'addl-10-Beta')).toMatchObject({
      x: 635,
      y: 75,
    });
    expect(classById(result.current.additionalClasses, 'addl-10-Alpha')).not.toBe(oneAlphaBefore);
    expect(classById(result.current.additionalClasses, 'addl-10-Beta')).not.toBe(oneBetaBefore);
    expect(classById(result.current.additionalClasses, 'addl-20-Gamma')).toBe(twoBefore);
    expect(result.current.primaryClasses[0]).toBe(primaryBefore[0]);
    expect(result.current.primaryClasses[1]).toBe(primaryBefore[1]);
  });
});
