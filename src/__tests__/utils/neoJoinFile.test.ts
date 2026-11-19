import type { Mock } from 'vitest';
import { apiService } from '../../services/api';
import {
  buildNeoJoinSkeleton,
  createNeoJoinFile,
  neoJoinFileName,
  neoJoinPackageName,
  persistNeoJoinCode,
} from '../../utils/neoJoinFile';

vi.mock('../../services/api', () => ({
  apiService: {
    updateNeoJoinFile: vi.fn(),
    uploadFile: vi.fn(),
  },
}));

describe('neoJoin file helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('turns a label into a NeoJoin package name and .nj file name', () => {
    expect(neoJoinPackageName('Brake View')).toBe('BrakeView');
    expect(neoJoinFileName('Brake View')).toBe('BrakeView.nj');
    expect(neoJoinPackageName('12abc')).toBe('View12abc');
    expect(neoJoinPackageName('   ')).toBe('View');
  });

  it('builds a skeleton query the editor can open', () => {
    expect(buildNeoJoinSkeleton('Brake')).toBe(
      'export Brake to "http://vitruv.tools/views/Brake"\n\ncreate root Brake {\n}\n',
    );
  });

  it('adds an import for each linked metamodel', () => {
    expect(buildNeoJoinSkeleton('Brake', ['http://mm/a', 'http://mm/b'])).toContain(
      'import "http://mm/a"\nimport "http://mm/b"\n',
    );
  });

  it('uploads a new NeoJoin file', async () => {
    (apiService.uploadFile as Mock).mockResolvedValueOnce({ data: 21, message: 'ok' });

    await expect(createNeoJoinFile('export Brake to "u"\n', 'Brake')).resolves.toBe(21);
    expect(apiService.uploadFile).toHaveBeenCalledWith(expect.any(File), 'NEO_JOIN');
  });

  it('updates the stored NeoJoin file when the view already has one', async () => {
    (apiService.updateNeoJoinFile as Mock).mockResolvedValueOnce({ data: 'ok', message: 'updated' });

    const fileId = await persistNeoJoinCode('export Brake to "u"\n', 15, 'Brake');

    expect(fileId).toBe(15);
    expect(apiService.updateNeoJoinFile).toHaveBeenCalledTimes(1);
    const [id, file] = (apiService.updateNeoJoinFile as Mock).mock.calls[0];
    expect(id).toBe(15);
    expect(file).toBeInstanceOf(File);
    expect((file as File).name).toBe('Brake.nj');
    expect(await (file as File).text()).toBe('export Brake to "u"\n');
  });

  it('keeps a query that has no backend file yet', async () => {
    const fileId = await persistNeoJoinCode('export Brake to "u"\n', null, 'Brake');

    expect(fileId).toBeNull();
    expect(apiService.updateNeoJoinFile).not.toHaveBeenCalled();
  });

  it('leaves the query unsaved on the server when the update fails', async () => {
    (apiService.updateNeoJoinFile as Mock).mockRejectedValueOnce(new Error('still in use'));

    await expect(persistNeoJoinCode('export Brake to "u"\n', 15, 'Brake')).rejects.toThrow('still in use');
  });
});
