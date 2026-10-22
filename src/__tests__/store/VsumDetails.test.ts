import {
  createVsumDetailsStore,
  deleteVsumDetailsStore,
  getVsumDetailsStore,
  hasVsumDetailsStore,
  VsumDetailsHelper,
} from '../../store/VsumDetails';
import { NoVsumDetailsStoreError } from '../../store/NoVsumDetailsStoreError';
import type { EditableVsumMetaModelRef } from '../../types/EditableVsumDetails';

const mm = (sourceId: number): EditableVsumMetaModelRef => ({
  id: sourceId,
  name: `M${sourceId}`,
  description: '',
  domain: '',
  sourceId,
  keyword: [],
  createdAt: '',
  updatedAt: '',
  ecoreFileId: 1,
  genModelFileId: 2,
});

describe('VsumDetails store CRUD', () => {
  afterEach(() => {
    deleteVsumDetailsStore(1);
  });

  it('throws until createVsumDetailsStore has been called', () => {
    expect(hasVsumDetailsStore(1)).toBe(false);
    expect(() => getVsumDetailsStore(1)).toThrow(NoVsumDetailsStoreError);
  });

  it('adds, reads, and removes a fine-granular relation', () => {
    createVsumDetailsStore(1, {
      metaModels: [mm(10), mm(20)],
      metaModelsRelation: [],
    });

    const helper = new VsumDetailsHelper(1);
    helper.setIdentifiersToBackendMetaModelId(
      new Map([
        ['http://a', 10],
        ['http://b', 20],
      ]),
    );
    helper.addFineGranularMetaModelRelation(10, 20, {
      id: null,
      sourceId: 'http://a#A',
      targetId: 'http://b#B',
      lowCodeReactionRequestBase: { reactionName: 'sync' },
    });
    helper.saveToStore();

    const persisted = new VsumDetailsHelper(1);
    expect(
      persisted.getFineGranularMetaModelRelation(10, 20, 'http://a#A', 'http://b#B'),
    ).toMatchObject({
      sourceId: 'http://a#A',
      targetId: 'http://b#B',
      lowCodeReactionRequestBase: { reactionName: 'sync' },
    });
    expect(persisted.getAllFineGranularMetaModelRelations()).toHaveLength(1);

    persisted.removeFineGranularMetaModelRelation(10, 20, 'http://a#A', 'http://b#B');
    persisted.saveToStore();
    expect(new VsumDetailsHelper(1).getAllFineGranularMetaModelRelations()).toHaveLength(0);
  });

  it('does not duplicate an existing fine pair', () => {
    createVsumDetailsStore(1, { metaModels: [mm(10), mm(20)], metaModelsRelation: [] });
    const helper = new VsumDetailsHelper(1);
    const fine = { id: null, sourceId: 'http://a#A', targetId: 'http://b#B' };
    helper.addFineGranularMetaModelRelation(10, 20, fine);
    helper.addFineGranularMetaModelRelation(10, 20, {
      ...fine,
      lowCodeReactionRequestBase: { reactionName: 'ignored' },
    });
    expect(helper.getAllFineGranularMetaModelRelations()).toHaveLength(1);
    expect(
      helper.getFineGranularMetaModelRelation(10, 20, 'http://a#A', 'http://b#B')
        ?.lowCodeReactionRequestBase,
    ).toBeUndefined();
  });

  it('serializes fine relations into the workspace snapshot', () => {
    createVsumDetailsStore(1, { metaModels: [mm(10), mm(20)], metaModelsRelation: [] });
    const helper = new VsumDetailsHelper(1);
    helper.addFineGranularMetaModelRelation(10, 20, {
      id: 42,
      sourceId: 'http://a#A',
      targetId: 'http://b#B',
      reactionFileStorageId: 88,
      lowCodeReactionRequestBase: { reactionName: 'sync' },
    });

    expect(helper.getAsWorkspaceSnapshot()).toEqual({
      metaModelIds: [10, 20],
      metaModelRelationRequests: [
        {
          sourceId: 10,
          targetId: 20,
          reactionFileId: null,
          fineGranularMetaModelRelationSet: [
            {
              id: 42,
              sourceId: 'http://a#A',
              targetId: 'http://b#B',
              reactionFileStorageId: 88,
              lowCodeReactionRequestBase: { reactionName: 'sync' },
            },
          ],
        },
      ],
    });
  });
});
