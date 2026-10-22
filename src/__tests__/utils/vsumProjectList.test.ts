import { matchesProjectListView, isSharedProject, isOwnedProject } from '../../utils/vsumProjectList';
import { Vsum } from '../../types';

const base: Vsum = {
  id: 1,
  name: 'Test',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('vsumProjectList', () => {
  it('identifies owned projects', () => {
    expect(isOwnedProject({ ...base, role: 'OWNER' })).toBe(true);
    expect(isOwnedProject({ ...base })).toBe(true);
    expect(isOwnedProject({ ...base, role: 'VIEWER' })).toBe(false);
  });

  it('identifies shared projects', () => {
    expect(isSharedProject({ ...base, role: 'VIEWER' })).toBe(true);
    expect(isSharedProject({ ...base, role: 'MEMBER' })).toBe(true);
    expect(isSharedProject({ ...base, role: 'OWNER' })).toBe(false);
  });

  it('filters by list view', () => {
    expect(matchesProjectListView({ ...base, role: 'OWNER' }, 'mine')).toBe(true);
    expect(matchesProjectListView({ ...base, role: 'VIEWER' }, 'shared')).toBe(true);
    expect(matchesProjectListView({ ...base, role: 'VIEWER' }, 'mine')).toBe(false);
    expect(matchesProjectListView({ ...base, removedAt: '2024-02-01' }, 'deleted')).toBe(true);
  });
});
