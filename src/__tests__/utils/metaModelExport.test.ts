import {
  buildMetaModelDownloadFileName,
  downloadMetaModelFile,
  getMetaModelFileId,
  hasMetaModelFile,
  sanitizeFileBaseName,
} from '../../utils/metaModelExport';
import { downloadTextAsFile } from '../../utils/downloadTextAsFile';

jest.mock('../../utils/downloadTextAsFile', () => ({
  downloadTextAsFile: jest.fn(),
}));

describe('metaModelExport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sanitizes unsafe characters in file base names', () => {
    expect(sanitizeFileBaseName('My:Model*')).toBe('My_Model_');
    expect(sanitizeFileBaseName('   ')).toBe('metamodel');
  });

  it('builds download file names with correct extensions', () => {
    expect(buildMetaModelDownloadFileName('Person', 'ecore')).toBe('Person.ecore');
    expect(buildMetaModelDownloadFileName('Person', 'genmodel')).toBe('Person.genmodel');
  });

  it('detects available file ids', () => {
    const model = { name: 'Test', ecoreFileId: 10, genModelFileId: 0 };
    expect(hasMetaModelFile(model, 'ecore')).toBe(true);
    expect(hasMetaModelFile(model, 'genmodel')).toBe(false);
    expect(getMetaModelFileId(model, 'ecore')).toBe(10);
  });

  it('downloads file content via getFile and triggers browser download', async () => {
    const getFile = jest.fn().mockResolvedValue('<ecore/>');
    await downloadMetaModelFile(
      { name: 'Person', ecoreFileId: 42 },
      'ecore',
      getFile,
    );

    expect(getFile).toHaveBeenCalledWith(42);
    expect(downloadTextAsFile).toHaveBeenCalledWith('<ecore/>', 'Person.ecore');
  });

  it('throws when file id is missing', async () => {
    await expect(
      downloadMetaModelFile({ name: 'Person' }, 'ecore', jest.fn()),
    ).rejects.toThrow(/No \.ecore file/i);
  });
});
