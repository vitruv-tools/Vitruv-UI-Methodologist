import type { FlowEcoreEdge } from '../../types/flow';
import {
  createVsumDetailsStore,
  deleteVsumDetailsStore,
  VsumDetailsHelper,
} from '../../store/VsumDetails';
import { useProjectStore } from '../../store/Project';
import {
  getLowCodeReactionConfig,
  hasLowCodeReactionConfig,
  temporarilySaveLowCodeReactionConfig,
} from '../../utils/LowCodeReactionUtils';

const edge = (fromModel = 'http://a', toModel = 'http://b'): FlowEcoreEdge =>
  ({
    id: 'e1',
    source: 'n1',
    target: 'n2',
    type: 'fine-granular-reaction',
    data: {
      relationshipType: 'fine-granular-reaction',
      ecore: {
        eObjectSourceId: 'http://a#A',
        eObjectTargetId: 'http://b#B',
        fromModel,
        toModel,
      },
    },
  }) as FlowEcoreEdge;

describe('LowCodeReactionUtils', () => {
  afterEach(() => {
    deleteVsumDetailsStore(1);
    useProjectStore.getState().setActiveId(null);
  });

  const seedStore = () => {
    useProjectStore.getState().setActiveId(1);
    createVsumDetailsStore(1, { metaModels: [], metaModelsRelation: [] });
    const helper = new VsumDetailsHelper(1);
    helper.setIdentifiersToBackendMetaModelId(
      new Map([
        ['http://a', 10],
        ['http://b', 20],
      ]),
    );
    helper.saveToStore();
  };

  it('returns false when no config has been saved', () => {
    seedStore();
    expect(hasLowCodeReactionConfig(edge())).toBe(false);
    expect(getLowCodeReactionConfig(edge())).toBeUndefined();
  });

  it('writes form values onto a new fine relation and reads them back', () => {
    seedStore();
    temporarilySaveLowCodeReactionConfig(
      {
        _reactionTemplate: 'create_corresponding_root_on_insert_root',
        name: 'Create Corresponding Root',
        reactionName: 'first_save',
      },
      edge(),
    );

    expect(hasLowCodeReactionConfig(edge())).toBe(true);
    expect(getLowCodeReactionConfig(edge())).toMatchObject({
      name: 'create_corresponding_root_on_insert_root',
      reactionName: 'first_save',
    });
  });

  it('sets regenerate: true when updating a persisted fine relation', () => {
    seedStore();
    const helper = new VsumDetailsHelper(1);
    helper.addFineGranularMetaModelRelation(10, 20, {
      id: 42,
      sourceId: 'http://a#A',
      targetId: 'http://b#B',
      reactionFileStorageId: 88,
    });
    helper.saveToStore();

    temporarilySaveLowCodeReactionConfig({ reactionName: 'updated_name' }, edge());
    expect(getLowCodeReactionConfig(edge())).toMatchObject({
      reactionName: 'updated_name',
      regenerate: true,
    });
  });
});
