import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { VsumTabs } from '../../../components/ui/VsumTabs';
import { apiService } from '../../../services/api';
import { WorkspaceSnapshot } from '../../../types/workspace';

jest.mock('../../../services/api', () => ({
  apiService: {
    getVsumDetails: jest.fn(),
    updateVsumSyncChanges: jest.fn(),
    getFile: jest.fn(),
    buildVsum: jest.fn(),
    downloadVsumArtifact: jest.fn(),
  },
}));

describe('VsumTabs ViewType sync', () => {
  const mockedApi = apiService as jest.Mocked<typeof apiService>;

  const snapshot: WorkspaceSnapshot = {
    metaModelIds: [11],
    metaModelRelationRequests: [],
    viewRequests: [{ metaModelIds: [11], fileStorageId: 0 }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedApi.getVsumDetails.mockResolvedValue({
      data: {
        id: 1,
        name: 'VSUM-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        metaModels: [
          {
            id: 101,
            name: 'MM',
            description: '',
            domain: '',
            sourceId: 11,
            keyword: [],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            ecoreFileId: 1,
            genModelFileId: 2,
          },
        ],
        metaModelsRelation: [],
      },
      message: 'ok',
    } as any);
    mockedApi.updateVsumSyncChanges.mockResolvedValue({ data: {}, message: 'saved' } as any);
    mockedApi.getFile.mockResolvedValue('file-content' as any);
  });

  it('syncs viewRequests to backend on sync event', async () => {
    const requestWorkspaceSnapshot = jest.fn().mockResolvedValue(snapshot);

    render(
      <VsumTabs
        openTabs={[{ instanceId: 'i-1', id: 1 }]}
        activeInstanceId="i-1"
        onActivate={jest.fn()}
        onClose={jest.fn()}
        requestWorkspaceSnapshot={requestWorkspaceSnapshot}
      />
    );

    await waitFor(() => expect(mockedApi.getVsumDetails).toHaveBeenCalledWith(1));
    await waitFor(() => expect(screen.getByText('VSUM-1')).toBeInTheDocument());

    await act(async () => {
      globalThis.dispatchEvent(new CustomEvent('vitruv.syncActiveVsumChanges'));
    });

    await waitFor(() =>
      expect(mockedApi.updateVsumSyncChanges).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          metaModelIds: [11],
          metaModelRelationRequests: null,
          viewRequests: [{ metaModelIds: [11], fileStorageId: 0 }],
        })
      )
    );
  });
});

