import {
  fetchOwnerContactForVsum,
  findVsumOwner,
  formatProjectMemberStackLabel,
  mergeSharerWithMembers,
  normalizeVsumRole,
  pickMostRestrictiveRole,
  mergeStoredProjectAccess,
  readStoredProjectAccess,
  resolveProjectAccessRole,
  resolveVsumAccessRole,
  sharedByFromVsum,
  sharedByToMember,
  uniqueVsumMembers,
  writeStoredProjectAccess,
} from '../../utils/vsumMemberUtils';

describe('vsumMemberUtils', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });
  it('finds owner in member list', () => {
    const owner = findVsumOwner([
      { id: 1, vsumId: 9, firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', role: 'OWNER', createdAt: '' },
      { id: 2, vsumId: 9, firstName: 'Bob', lastName: 'Viewer', email: 'bob@example.com', role: 'VIEWER', createdAt: '' },
    ]);
    expect(owner?.email).toBe('ada@example.com');
  });

  it('normalizes access roles', () => {
    expect(normalizeVsumRole('viewer')).toBe('VIEWER');
    expect(normalizeVsumRole('unknown')).toBeNull();
  });

  it('resolves role from roleEn when role is missing', () => {
    expect(resolveVsumAccessRole(undefined, 'Viewer')).toBe('VIEWER');
    expect(resolveVsumAccessRole('OWNER', 'Viewer')).toBe('OWNER');
  });

  it('picks the most restrictive role when sources disagree', () => {
    expect(pickMostRestrictiveRole('OWNER', 'VIEWER')).toBe('VIEWER');
    expect(pickMostRestrictiveRole('OWNER', 'MEMBER')).toBe('MEMBER');
    expect(pickMostRestrictiveRole('OWNER', null)).toBe('OWNER');
  });

  it('extracts shared-by contact from vsum list item', () => {
    const contact = sharedByFromVsum({
      id: 1,
      name: 'Shared project',
      createdAt: '',
      updatedAt: '',
      role: 'VIEWER',
      ownerFirstName: 'Tsotne',
      ownerLastName: 'M',
      ownerEmail: 'tsotne@example.com',
    });
    expect(contact?.email).toBe('tsotne@example.com');
    if (!contact) throw new Error('expected contact');
    expect(sharedByToMember(contact, 1).role).toBe('OWNER');
  });

  it('resolves per-project role from stored access', () => {
    writeStoredProjectAccess(10, { accessRole: 'VIEWER', sharedBy: { email: 'o@x.com' } });
    writeStoredProjectAccess(20, { accessRole: 'OWNER' });
    expect(resolveProjectAccessRole(10)).toBe('VIEWER');
    expect(resolveProjectAccessRole(20)).toBe('OWNER');
    expect(resolveProjectAccessRole(99)).toBe('OWNER');
  });

  it('mergeStoredProjectAccess preserves shared-by when updating role', () => {
    writeStoredProjectAccess(7, {
      accessRole: 'VIEWER',
      sharedBy: { email: 'owner@test.com', firstName: 'Ann' },
    });
    mergeStoredProjectAccess(7, { accessRole: 'VIEWER' });
    expect(readStoredProjectAccess(7)?.sharedBy?.email).toBe('owner@test.com');
  });

  it('resolves owner from nested API owner object', () => {
    const contact = sharedByFromVsum({
      id: 2,
      name: 'Shared',
      createdAt: '',
      updatedAt: '',
      owner: { firstName: 'Nino', lastName: 'Beriashvili', email: 'nino@example.com' },
    });
    expect(contact?.email).toBe('nino@example.com');
    expect(contact?.firstName).toBe('Nino');
  });

  it('fetchOwnerContactForVsum reads stored owner contact', async () => {
    writeStoredProjectAccess(5, {
      accessRole: 'VIEWER',
      sharedBy: { email: 'owner@test.com', firstName: 'Ann', lastName: 'Owner' },
    });
    await expect(fetchOwnerContactForVsum(5)).resolves.toEqual({
      email: 'owner@test.com',
      firstName: 'Ann',
      lastName: 'Owner',
    });
  });

  it('deduplicates members by email and prefers real membership ids', () => {
    const owner = {
      id: 42,
      vsumId: 1,
      firstName: 'Tsotne',
      lastName: 'T',
      email: 'tsotne@example.com',
      role: 'OWNER',
      createdAt: '',
    };
    const synthetic = sharedByToMember(
      { email: 'tsotne@example.com', firstName: 'Tsotne', lastName: 'T' },
      1,
    );

    expect(uniqueVsumMembers([owner, synthetic])).toEqual([owner]);
    expect(mergeSharerWithMembers(synthetic, [owner])).toEqual([owner]);
    expect(mergeSharerWithMembers(synthetic, [])).toEqual([synthetic]);
  });

  it('formats solo-owner member stack label', () => {
    expect(formatProjectMemberStackLabel(1, { isSoloOwner: true })).toBe('Only you');
    expect(formatProjectMemberStackLabel(1, { isSharedAccess: true })).toBe('1 person');
    expect(formatProjectMemberStackLabel(3)).toBe('3 people');
  });
});
