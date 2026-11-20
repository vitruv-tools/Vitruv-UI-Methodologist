import type { Mock } from 'vitest';
import { findProjectMetaModel } from '../../collaboration/findProjectMetaModel';
import { apiService } from '../../services/api';

vi.mock('../../services/api', () => ({ apiService: { getVsumDetails: vi.fn() } }));

const details = (metaModels: object[]) => ({ data: { metaModels } });
const car = { id: 501, sourceId: 7, name: 'Car', ecoreFileId: 9 };

afterEach(() => vi.clearAllMocks());

describe('findProjectMetaModel', () => {
  it('finds a metamodel by its library ID in the project the backend has', async () => {
    (apiService.getVsumDetails as Mock).mockResolvedValue(details([{ id: 1, sourceId: 2 }, car]));

    await expect(findProjectMetaModel(12, 7, { intervalMs: 5, timeoutMs: 100 })).resolves.toEqual(car);
  });

  it('keeps asking while the server has not saved the new metamodel yet', async () => {
    (apiService.getVsumDetails as Mock)
      .mockResolvedValueOnce(details([]))
      .mockRejectedValueOnce(new Error('busy'))
      .mockResolvedValueOnce(details([car]));

    await expect(findProjectMetaModel(12, 7, { intervalMs: 5, timeoutMs: 1000 })).resolves.toEqual(car);
    expect(apiService.getVsumDetails).toHaveBeenCalledTimes(3);
  });

  it('resolves null if it does not show up in time', async () => {
    (apiService.getVsumDetails as Mock).mockResolvedValue(details([]));

    await expect(findProjectMetaModel(12, 7, { intervalMs: 5, timeoutMs: 40 })).resolves.toBeNull();
  });
});
