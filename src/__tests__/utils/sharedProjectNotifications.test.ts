import { Vsum } from '../../types';
import {
  countUnreadSharedProjects,
  listUnreadSharedProjectIds,
  markSharedProjectSeen,
  markSharedProjectsSeen,
  readSeenSharedProjectIds,
} from '../../utils/sharedProjectNotifications';

function sharedVsum(id: number): Vsum {
  return {
    id,
    name: `Shared ${id}`,
    role: 'VIEWER',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  } as Vsum;
}

function ownedVsum(id: number): Vsum {
  return {
    id,
    name: `Mine ${id}`,
    role: 'OWNER',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  } as Vsum;
}

describe('sharedProjectNotifications', () => {
  const userKey = 'test-user@example.com';

  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with no seen projects', () => {
    expect(readSeenSharedProjectIds(userKey).size).toBe(0);
  });

  it('marks a single shared project as seen', () => {
    markSharedProjectSeen(42, userKey);
    expect(readSeenSharedProjectIds(userKey).has(42)).toBe(true);
  });

  it('counts unread shared projects only', () => {
    const items = [sharedVsum(1), sharedVsum(2), ownedVsum(3)];
    expect(countUnreadSharedProjects(items, userKey)).toBe(2);
    markSharedProjectSeen(1, userKey);
    expect(countUnreadSharedProjects(items, userKey)).toBe(1);
  });

  it('lists unread shared project ids', () => {
    const items = [sharedVsum(10), sharedVsum(11)];
    markSharedProjectsSeen([10], userKey);
    expect(listUnreadSharedProjectIds(items, userKey)).toEqual([11]);
  });

  it('keeps seen state per user', () => {
    markSharedProjectSeen(7, 'alice@example.com');
    expect(readSeenSharedProjectIds('bob@example.com').has(7)).toBe(false);
    expect(readSeenSharedProjectIds('alice@example.com').has(7)).toBe(true);
  });
});
