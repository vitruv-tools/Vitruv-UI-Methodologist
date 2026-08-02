import { apiService } from '../../services/api';

import { ecoreToUml } from '../../utils/ecoreToUml';

import { saveMetaModelEcore } from '../../utils/saveMetaModelEcore';

jest.mock('../../services/api', () => ({
  apiService: {
    updateEcoreFile: jest.fn(),
    uploadFile: jest.fn(),
    getMetaModel: jest.fn(),
    getMetaModels: jest.fn(),
    updateMetaModel: jest.fn(),
  },
}));

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"
                name="testpkg" nsURI="http://example.com/test" nsPrefix="test">
  <eClassifiers xsi:type="ecore:EClass" name="Person"/>
</ecore:EPackage>`;

const META = {
  name: 'PersonModel',
  description: 'Test model',
  domain: 'Testing',
  keyword: ['uml', 'ecore'],
  genModelFileId: 20,
};

describe('saveMetaModelEcore', () => {
  afterEach(() => jest.clearAllMocks());

  it('overwrites the existing ecore file in place when update is supported', async () => {
    (apiService.updateEcoreFile as jest.Mock).mockResolvedValueOnce({});

    const model = ecoreToUml(SAMPLE);
    const result = await saveMetaModelEcore({
      metaModelId: '42',
      ecoreFileId: 7,
      modelName: 'PersonModel',
      model,
      originalEcore: SAMPLE,
    });

    expect(apiService.updateEcoreFile).toHaveBeenCalledTimes(1);
    expect(apiService.uploadFile).not.toHaveBeenCalled();
    expect(result.ecoreFileId).toBe(7);
    expect(result.ecoreContent).toContain('name="Person"');
    const uploaded = (apiService.updateEcoreFile as jest.Mock).mock.calls[0][1] as File;
    expect(uploaded.name).toMatch(/^ecore-7-/);
  });

  it('retries update with another filename when the server reports a duplicate name', async () => {
    (apiService.updateEcoreFile as jest.Mock)
      .mockRejectedValueOnce(Object.assign(new Error('File already exists'), { status: 409 }))
      .mockResolvedValueOnce({});

    const model = ecoreToUml(SAMPLE);
    const result = await saveMetaModelEcore({
      metaModelId: '42',
      ecoreFileId: 7,
      modelName: 'PersonModel',
      model,
      originalEcore: SAMPLE,
    });

    expect(apiService.updateEcoreFile).toHaveBeenCalledTimes(2);
    expect(apiService.uploadFile).not.toHaveBeenCalled();
    expect(result.ecoreFileId).toBe(7);
  });

  it('uploads a new revision when update endpoint is missing', async () => {
    (apiService.updateEcoreFile as jest.Mock).mockRejectedValue(
      Object.assign(new Error('Request failed with status 404'), { status: 404 }),
    );
    (apiService.uploadFile as jest.Mock).mockResolvedValueOnce({ data: 99 });
    (apiService.getMetaModel as jest.Mock).mockResolvedValueOnce({ data: META });
    (apiService.updateMetaModel as jest.Mock).mockResolvedValueOnce({});

    const model = ecoreToUml(SAMPLE);
    const result = await saveMetaModelEcore({
      metaModelId: '42',
      ecoreFileId: 7,
      modelName: 'PersonModel',
      model,
      originalEcore: SAMPLE,
    });

    expect(apiService.uploadFile).toHaveBeenCalledTimes(1);
    const uploaded = (apiService.uploadFile as jest.Mock).mock.calls[0][0] as File;
    expect(uploaded.name).toMatch(/^ecore-7-/);
    expect(apiService.getMetaModel).toHaveBeenCalledWith('42');
    expect(result.ecoreFileId).toBe(99);
  });

  it('relinks using caller metadata when GET /meta-models/{id} is unavailable', async () => {
    (apiService.updateEcoreFile as jest.Mock).mockRejectedValue(
      Object.assign(new Error('Request failed with status 404'), { status: 404 }),
    );
    (apiService.uploadFile as jest.Mock).mockResolvedValueOnce({ data: 101 });
    (apiService.updateMetaModel as jest.Mock).mockResolvedValueOnce({});

    const model = ecoreToUml(SAMPLE);
    const result = await saveMetaModelEcore({
      metaModelId: '4',
      ecoreFileId: 603,
      modelName: 'PersonModel',
      model,
      originalEcore: SAMPLE,
      metaModelMetadata: {
        description: META.description,
        domain: META.domain,
        keyword: META.keyword,
        genModelFileId: META.genModelFileId,
      },
    });

    expect(apiService.getMetaModel).not.toHaveBeenCalled();
    expect(apiService.getMetaModels).not.toHaveBeenCalled();
    expect(apiService.updateMetaModel).toHaveBeenCalledWith('4', expect.objectContaining({
      name: 'PersonModel',
      description: META.description,
      domain: META.domain,
      keyword: META.keyword,
      ecoreFileId: 101,
      genModelFileId: META.genModelFileId,
    }));
    expect(result.ecoreFileId).toBe(101);
  });

  it('falls back to getMetaModels when getMetaModel returns 405', async () => {
    (apiService.updateEcoreFile as jest.Mock).mockRejectedValue(
      Object.assign(new Error('Request failed with status 404'), { status: 404 }),
    );
    (apiService.uploadFile as jest.Mock).mockResolvedValueOnce({ data: 102 });
    (apiService.getMetaModel as jest.Mock).mockRejectedValue(
      Object.assign(new Error('Method Not Allowed'), { status: 405 }),
    );
    (apiService.getMetaModels as jest.Mock).mockResolvedValueOnce({ data: [{ id: 4, ...META }] });
    (apiService.updateMetaModel as jest.Mock).mockResolvedValueOnce({});

    const model = ecoreToUml(SAMPLE);
    const result = await saveMetaModelEcore({
      metaModelId: '4',
      ecoreFileId: 603,
      modelName: 'PersonModel',
      model,
      originalEcore: SAMPLE,
    });

    expect(apiService.getMetaModels).toHaveBeenCalled();
    expect(result.ecoreFileId).toBe(102);
  });
});
