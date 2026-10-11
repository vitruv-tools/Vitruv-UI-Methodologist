import {
  clearStoredCanvasTabs,
  openCanvasTabsStorageKey,
  readStoredCanvasTabs,
  writeStoredCanvasTabs,
} from '../../utils/canvasTabsStorage';

const tabs = [
  { instanceId: '10-1-1', projectId: 10, name: 'Project A' },
  { instanceId: '20-1-2', projectId: 20, name: 'Project B' },
];

describe('canvasTabsStorage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('returns no tabs when nothing is stored', () => {
    expect(readStoredCanvasTabs('max@kit.edu')).toEqual([]);
  });

  it('stores the project id and name of each tab, in order', () => {
    writeStoredCanvasTabs('max@kit.edu', tabs);

    expect(readStoredCanvasTabs('max@kit.edu')).toEqual([
      { projectId: 10, name: 'Project A' },
      { projectId: 20, name: 'Project B' },
    ]);
  });

  it('keeps the tabs of different users apart', () => {
    writeStoredCanvasTabs('max@kit.edu', tabs);

    expect(readStoredCanvasTabs('anna@kit.edu')).toEqual([]);
  });

  it('ignores invalid stored data', () => {
    sessionStorage.setItem(openCanvasTabsStorageKey('max@kit.edu'), 'not json');
    expect(readStoredCanvasTabs('max@kit.edu')).toEqual([]);

    sessionStorage.setItem(
      openCanvasTabsStorageKey('max@kit.edu'),
      JSON.stringify([{ projectId: 10, name: 'Project A' }, { projectId: 'x' }, null]),
    );
    expect(readStoredCanvasTabs('max@kit.edu')).toEqual([{ projectId: 10, name: 'Project A' }]);
  });

  it('does nothing without a user', () => {
    writeStoredCanvasTabs(null, tabs);

    expect(sessionStorage.length).toBe(0);
    expect(readStoredCanvasTabs(null)).toEqual([]);
  });

  it('clears the stored tabs', () => {
    writeStoredCanvasTabs('max@kit.edu', tabs);
    clearStoredCanvasTabs('max@kit.edu');

    expect(readStoredCanvasTabs('max@kit.edu')).toEqual([]);
  });
});
