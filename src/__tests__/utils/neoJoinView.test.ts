import { describe, it, expect } from 'vitest';
import type { Node } from 'reactflow';
import type { ViewType } from '../../hooks/useViewTypes';
import {
  buildInitialNeoJoinCode,
  buildViewRequests,
  countViewProblems,
  neoJoinExportName,
} from '../../utils/neoJoinView';
import { describeBuildSuccess } from '../../utils/buildCheckMessages';
import { isNavigableBuildProblem, isViewsProblem } from '../../utils/buildProblems';

const ecore = '<ecore:EPackage nsURI="http://example.org/shop"><eClassifiers xsi:type="ecore:EClass" name="Item"/></ecore:EPackage>';

const nodes = [
  {
    id: 'n1', type: 'ecoreFile', position: { x: 0, y: 0 },
    data: { nsUri: 'http://example.org/shop', fileContent: ecore, metaModelSourceId: 7 },
  },
] as unknown as Node[];

const vt = (over: Partial<ViewType> = {}): ViewType => ({
  id: 'vt-1', label: 'Shop view', scope: 'single', angle: 0, linkedNodeIds: ['n1'], editable: true, ...over,
});

describe('neoJoinView', () => {
  it('turns labels into unique identifiers', () => {
    const a = vt({ id: 'a', label: 'My View' });
    const b = vt({ id: 'b', label: 'My-View' });
    expect(neoJoinExportName(a, [a, b])).toBe('My_View');
    expect(neoJoinExportName(b, [a, b])).toBe('My_View_2');
    expect(neoJoinExportName(vt({ label: '1st' }), [])).toBe('View_1st');
  });

  it('generates a starting definition with the import and a class', () => {
    const code = buildInitialNeoJoinCode(vt(), [vt()], nodes);
    expect(code).toContain('export Shop_view to "http://methodologist.vitruv/views/Shop_view"');
    expect(code).toContain('import "http://example.org/shop"');
    expect(code).toContain('from Item c');
  });

  it('sends only view types with a file and linked metamodels', () => {
    const stored = vt({ fileStorageId: 5, fileName: 'Shop_view.nj' });
    const requests = buildViewRequests([stored, vt({ id: 'vt-2' }), vt({ id: 'vt-3', fileStorageId: 6, linkedNodeIds: [] })], nodes);
    expect(requests).toEqual([{ name: 'Shop_view', metaModelIds: [7], fileStorageId: 5 }]);
  });

  it('counts view problems per view type by file id, then by file name', () => {
    const viewTypes = [vt({ fileStorageId: 5, fileName: 'a.nj' }), vt({ id: 'vt-2', fileName: 'b.nj' })];
    const counts = countViewProblems([
      { source: 'VIEWS', fileId: 5, message: 'x' },
      { source: 'VIEWS', file: 'b.nj', message: 'y' },
      { source: 'REACTIONS', fileId: 5, message: 'z' },
    ], viewTypes);
    expect(counts).toEqual({ 'vt-1': 1, 'vt-2': 1 });
  });
});

describe('views build problems and messages', () => {
  it('makes VIEWS problems with a file id navigable', () => {
    const problem = { source: 'VIEWS' as const, file: 'a.nj', fileId: 5, line: 3, message: 'x' };
    expect(isViewsProblem(problem)).toBe(true);
    expect(isNavigableBuildProblem(problem)).toBe(true);
    expect(isNavigableBuildProblem({ ...problem, fileId: undefined })).toBe(false);
  });

  it('reports the number of view types', () => {
    expect(describeBuildSuccess(null, 1)).toBe('This VSUM can be built. It includes 1 view type.');
    expect(describeBuildSuccess(null, 3)).toContain('It includes 3 view types.');
    expect(describeBuildSuccess(null, 0)).toContain('It has no view types.');
    expect(describeBuildSuccess(null)).toBe('This VSUM can be built.');
  });
});
