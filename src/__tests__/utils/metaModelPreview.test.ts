import {
  METAMODEL_PREVIEW_LAYOUT_SCOPE,
  metaModelPreviewLayoutFileName,
  shouldFitMetaModelPreview,
} from '../../utils/metaModelPreview';
import { saveUmlLayout } from '../../utils/umlLayoutStorage';

describe('metaModelPreview layout helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('builds a stable layout file name from model id and name', () => {
    expect(metaModelPreviewLayoutFileName(42, 'My Model')).toBe('metamodel-42-My_Model');
  });

  it('skips initial fit when saved layout exists', () => {
    const fileName = metaModelPreviewLayoutFileName(1, 'Test');
    saveUmlLayout(METAMODEL_PREVIEW_LAYOUT_SCOPE, fileName, { A: { x: 10, y: 20 } });
    expect(shouldFitMetaModelPreview(1, 'Test')).toBe(false);
  });

  it('allows initial fit when no saved layout', () => {
    expect(shouldFitMetaModelPreview(99, 'New')).toBe(true);
  });
});
