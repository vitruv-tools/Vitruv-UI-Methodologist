import type { Mock } from 'vitest';
import { apiService } from '../../services/api';
import { isTerminalBuild, waitForVsumBuild } from '../../utils/vsumBuildPolling';
import { buildFailureFromBuildResponse } from '../../utils/buildProblems';
import type { VsumBuildResponse } from '../../types/vsumBuild';

vi.mock('../../services/api', () => ({
  apiService: { getVsumBuild: vi.fn() },
}));

const getVsumBuild = apiService.getVsumBuild as unknown as Mock;
const noSleep = () => Promise.resolve();

const queued: VsumBuildResponse = { id: 3, vsumId: 42, status: 'QUEUED' };

describe('waitForVsumBuild', () => {
  it('polls until the build fails and exposes its problems', async () => {
    const failed: VsumBuildResponse = {
      ...queued,
      status: 'FAILED',
      errorMessage: 'The uploads do not compile',
      errorCode: 'VSUM_BUILD_FAILED',
      problems: [{ source: 'REACTIONS', file: 'my.reactions', fileId: 7, line: 5, message: 'Broken' }],
    };
    getVsumBuild
      .mockResolvedValueOnce({ data: { ...queued, status: 'RUNNING' }, message: '' })
      .mockResolvedValueOnce({ data: failed, message: '' });
    const onUpdate = vi.fn();

    const result = await waitForVsumBuild(42, queued, { sleep: noSleep, onUpdate });

    expect(result).toBe(failed);
    expect(getVsumBuild).toHaveBeenCalledWith(42, 3);
    expect(onUpdate.mock.calls.map(([b]) => b.status)).toEqual(['QUEUED', 'RUNNING', 'FAILED']);
    expect(buildFailureFromBuildResponse(result)).toEqual({
      errorCode: 'VSUM_BUILD_FAILED',
      message: 'The uploads do not compile',
      problems: failed.problems,
    });
  });

  it('returns a finished build without polling', async () => {
    const done: VsumBuildResponse = { ...queued, status: 'SUCCEEDED' };
    await expect(waitForVsumBuild(42, done, { sleep: noSleep })).resolves.toBe(done);
    expect(getVsumBuild).not.toHaveBeenCalled();
  });

  it('gives up after the maximum number of polls', async () => {
    getVsumBuild.mockResolvedValue({ data: { ...queued, status: 'RUNNING' }, message: '' });
    await expect(waitForVsumBuild(42, queued, { sleep: noSleep, maxPolls: 2 }))
      .rejects.toThrow('The build did not finish in time');
    expect(getVsumBuild).toHaveBeenCalledTimes(2);
  });

  it('waits between polls with the default timer', async () => {
    vi.useFakeTimers();
    try {
      getVsumBuild.mockResolvedValueOnce({ data: { ...queued, status: 'SUCCEEDED' }, message: '' });
      const promise = waitForVsumBuild(42, queued, { intervalMs: 1000 });
      await vi.advanceTimersByTimeAsync(1000);
      await expect(promise).resolves.toMatchObject({ status: 'SUCCEEDED' });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('isTerminalBuild', () => {
  it('treats only succeeded and failed builds as finished', () => {
    expect(isTerminalBuild({ ...queued, status: 'RUNNING' })).toBe(false);
    expect(isTerminalBuild({ ...queued, status: 'FAILED' })).toBe(true);
  });
});
