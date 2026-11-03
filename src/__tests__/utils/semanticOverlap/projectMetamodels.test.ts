import type { Node } from 'reactflow';
import { NO_CLASSES_MESSAGE, projectMetamodels } from '../../../utils/semanticOverlap/projectMetamodels';
import { readFixture } from './fixtures';

const fileNode = (id: string, fileName: string, fileContent: string, data: Record<string, unknown> = {}): Node => ({
  id, type: 'ecoreFile', position: { x: 0, y: 0 }, data: { fileName, fileContent, ...data },
});

const EMPTY_ECORE = `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmi:version="2.0" xmlns:xmi="http://www.omg.org/XMI" xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore" name="empty" nsURI="http://empty" nsPrefix="empty"/>`;

describe('projectMetamodels', () => {
  it('parses the distinct metamodels of the canvas, sorted by name', async () => {
    const nodes = [
      fileNode('n1', 'uml.ecore', readFixture('uml-excerpt.ecore'), { metaModelId: 2, ecoreFileId: 20 }),
      fileNode('n2', 'ecore.ecore', readFixture('ecore-excerpt.ecore'), { metaModelId: 1, ecoreFileId: 10 }),
      fileNode('n3', 'ecore.ecore', readFixture('ecore-excerpt.ecore'), { metaModelId: 1, ecoreFileId: 10 }),
      { id: 'other', type: 'note', position: { x: 0, y: 0 }, data: {} } as Node,
    ];
    const metamodels = await projectMetamodels(nodes);
    expect(metamodels.map(m => m.name)).toEqual(['ecore', 'uml']);
    expect(metamodels[0]).toMatchObject({ key: 'mm:1', error: null, ref: { libraryId: 1, ecoreFileId: 10, name: 'ecore' } });
    expect(metamodels[0].ref.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(metamodels[0].graph?.classes.map(c => c.name)).toEqual(['EClass', 'EReference', 'EAttribute']);
  });

  it('keeps a metamodel that cannot be read, with the reason', async () => {
    const [broken] = await projectMetamodels([fileNode('n1', 'broken.ecore', '<broken')]);
    expect(broken).toMatchObject({ name: 'broken', graph: null, error: 'broken: the file is not valid XML' });
    expect(broken.ref).toMatchObject({ libraryId: 0, ecoreFileId: 0 });
  });

  it('keeps a metamodel without classes, with the reason', async () => {
    const [empty] = await projectMetamodels([fileNode('n1', 'empty.ecore', EMPTY_ECORE)]);
    expect(empty).toMatchObject({ graph: null, error: NO_CLASSES_MESSAGE });
  });

  it('gives changed content a different hash', async () => {
    const [before] = await projectMetamodels([fileNode('n1', 'a.ecore', readFixture('ecore-excerpt.ecore'))]);
    const [after] = await projectMetamodels([fileNode('n1', 'a.ecore', readFixture('uml-excerpt.ecore'))]);
    expect(after.ref.contentHash).not.toBe(before.ref.contentHash);
  });
});
