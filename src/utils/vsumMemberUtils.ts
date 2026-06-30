import { apiService, VsumRole, VsumUserResponse } from '../services/api';
import { Vsum } from '../types';

export interface SharedByContact {
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface StoredProjectAccess {
  accessRole?: string;
  sharedBy?: SharedByContact | null;
}

const projectAccessStorageKey = (projectId: number) => `vsum-access:${projectId}`;

export function readStoredProjectAccess(projectId: number | undefined): StoredProjectAccess | null {
  if (!projectId || !Number.isFinite(projectId)) return null;
  try {
    const raw = sessionStorage.getItem(projectAccessStorageKey(projectId));
    if (!raw) return null;
    return JSON.parse(raw) as StoredProjectAccess;
  } catch {
    return null;
  }
}

export function writeStoredProjectAccess(projectId: number, access: StoredProjectAccess): void {
  try {
    sessionStorage.setItem(projectAccessStorageKey(projectId), JSON.stringify(access));
  } catch {
    // ignore storage errors
  }
}

export function clearStoredProjectAccess(projectId: number | undefined): void {
  if (!projectId || !Number.isFinite(projectId)) return;
  try {
    sessionStorage.removeItem(projectAccessStorageKey(projectId));
  } catch {
    // ignore storage errors
  }
}

/** Update stored access without dropping an existing shared-by contact. */
export function mergeStoredProjectAccess(
  projectId: number,
  patch: Partial<StoredProjectAccess>,
): void {
  const existing = readStoredProjectAccess(projectId);
  const accessRole = patch.accessRole ?? existing?.accessRole;
  const role = resolveVsumAccessRole(accessRole);
  const sharedBy = role === 'OWNER'
    ? null
    : (patch.sharedBy !== undefined ? patch.sharedBy : existing?.sharedBy ?? null);
  writeStoredProjectAccess(projectId, { accessRole, sharedBy });
}

export function parseVsumMembersResponse(res: { data?: unknown } | null | undefined): VsumUserResponse[] {
  const data = res?.data;
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && Array.isArray((data as { content?: unknown }).content)) {
    return (data as { content: VsumUserResponse[] }).content;
  }
  return [];
}

export function uniqueVsumMembers(members: VsumUserResponse[]): VsumUserResponse[] {
  const seen = new Set<number>();
  return members.filter(m => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

export function findVsumOwner(members: VsumUserResponse[]): VsumUserResponse | null {
  return members.find(m =>
    m.role === 'OWNER' || (m.roleEn ?? '').toLowerCase().includes('owner'),
  ) ?? null;
}

export function findMembershipForEmail(
  members: VsumUserResponse[],
  email?: string,
): VsumUserResponse | undefined {
  const normalized = email?.toLowerCase();
  if (!normalized) return undefined;
  return members.find(m => m.email?.toLowerCase() === normalized);
}

export function normalizeVsumRole(role?: string | null): VsumRole | null {
  const upper = (role ?? '').toUpperCase();
  if (upper === 'OWNER' || upper === 'MEMBER' || upper === 'VIEWER') return upper;
  const lower = (role ?? '').toLowerCase();
  if (lower.includes('viewer')) return 'VIEWER';
  if (lower.includes('owner')) return 'OWNER';
  if (lower.includes('member')) return 'MEMBER';
  return null;
}

/** Resolve role from API fields (role and/or localized roleEn). */
export function resolveVsumAccessRole(role?: string | null, roleEn?: string | null): VsumRole | null {
  return normalizeVsumRole(role) ?? normalizeVsumRole(roleEn);
}

/** When sources disagree, use the least privileged role (viewer beats owner). */
export function pickMostRestrictiveRole(
  ...roles: Array<VsumRole | null | undefined>
): VsumRole | null {
  const set = new Set(roles.filter(Boolean) as VsumRole[]);
  if (set.has('VIEWER')) return 'VIEWER';
  if (set.has('MEMBER')) return 'MEMBER';
  if (set.has('OWNER')) return 'OWNER';
  return null;
}

/** Effective access role for a project (stored access + optional API role). */
export function resolveProjectAccessRole(
  projectId: number,
  apiRole?: VsumRole | null,
): VsumRole {
  const stored = readStoredProjectAccess(projectId);
  const storedRole = resolveVsumAccessRole(stored?.accessRole);
  const inferredViewer: VsumRole | null = stored?.sharedBy ? 'VIEWER' : null;
  const role = pickMostRestrictiveRole(storedRole, inferredViewer, apiRole ?? null);
  if (role) return role;
  if (stored?.sharedBy) return 'VIEWER';
  return 'OWNER';
}

export function sharedByFromVsum(item: Vsum): SharedByContact | null {
  return contactFromOwnerFields(item as Vsum & Record<string, unknown>);
}

function pickStringField(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function contactFromOwnerFields(record: Record<string, unknown> | null | undefined): SharedByContact | null {
  if (!record) return null;

  for (const nestedKey of ['owner', 'user', 'createdBy', 'projectOwner']) {
    const nested = record[nestedKey];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      const fromNested = contactFromOwnerFields(nested as Record<string, unknown>);
      if (fromNested) return fromNested;
    }
  }

  const email = pickStringField(record, [
    'ownerEmail', 'owner_email', 'userEmail', 'createdByEmail', 'sharedByEmail', 'email',
  ]);
  const firstName = pickStringField(record, [
    'ownerFirstName', 'owner_first_name', 'userFirstName', 'createdByFirstName', 'sharedByFirstName', 'firstName',
  ]);
  const lastName = pickStringField(record, [
    'ownerLastName', 'owner_last_name', 'userLastName', 'createdByLastName', 'sharedByLastName', 'lastName',
  ]);

  if (!email && !firstName && !lastName) return null;
  return { email, firstName, lastName };
}

function inviterContactFromMember(member: VsumUserResponse): SharedByContact | null {
  const raw = member as VsumUserResponse & Record<string, unknown>;
  return contactFromOwnerFields({
    ownerEmail: pickStringField(raw, ['invitedByEmail', 'inviterEmail', 'sharedByEmail']),
    ownerFirstName: pickStringField(raw, ['invitedByFirstName', 'inviterFirstName', 'sharedByFirstName']),
    ownerLastName: pickStringField(raw, ['invitedByLastName', 'inviterLastName', 'sharedByLastName']),
  });
}

function memberToOwnerContact(member: VsumUserResponse): SharedByContact {
  return {
    firstName: member.firstName,
    lastName: member.lastName,
    email: member.email,
  };
}

function storedOwnerContact(projectId: number): SharedByContact | null {
  const sharedBy = readStoredProjectAccess(projectId)?.sharedBy;
  if (!sharedBy) return null;
  if (sharedBy.email || sharedBy.firstName || sharedBy.lastName) return sharedBy;
  return null;
}

/** Resolve project owner contact for shared viewers (list API, details, or stored access). */
export async function fetchOwnerContactForVsum(
  projectId: number,
  ...hints: Array<Vsum | null | undefined>
): Promise<SharedByContact | null> {
  const fromStored = storedOwnerContact(projectId);
  if (fromStored) return fromStored;

  for (const item of hints) {
    const fromHint = item ? sharedByFromVsum(item) : null;
    if (fromHint) return fromHint;
  }

  try {
    const membersRes = await apiService.getVsumMembers(projectId);
    const members = parseVsumMembersResponse(membersRes);
    const owner = findVsumOwner(members);
    if (owner) return memberToOwnerContact(owner);
    for (const member of members) {
      const inviter = inviterContactFromMember(member);
      if (inviter) return inviter;
    }
  } catch {
    // members lookup is best-effort for viewers
  }

  try {
    const listRes = await apiService.getVsumsPaginated('', 0, 100);
    const listItem = (listRes.data ?? []).find(v => v.id === projectId);
    const fromList = listItem ? sharedByFromVsum(listItem) : null;
    if (fromList) return fromList;
  } catch {
    // list lookup is best-effort
  }

  try {
    const vsumRes = await apiService.getVsum(projectId);
    const fromVsum = sharedByFromVsum(vsumRes.data);
    if (fromVsum) return fromVsum;
  } catch {
    // ignore
  }

  try {
    const detailsRes = await apiService.getVsumDetails(projectId);
    return sharedByFromVsum(detailsRes.data);
  } catch {
    return null;
  }
}

export function sharedByToMember(contact: SharedByContact, vsumId: number): VsumUserResponse {
  return {
    id: -1,
    vsumId,
    firstName: contact.firstName ?? '',
    lastName: contact.lastName ?? '',
    email: contact.email ?? '',
    role: 'OWNER',
    roleEn: 'Owner',
    createdAt: '',
  };
}

export function memberDisplayName(m: Pick<VsumUserResponse, 'firstName' | 'lastName' | 'email'>): string {
  const full = [m.firstName, m.lastName].filter(Boolean).join(' ').trim();
  if (full) return full;
  return m.email || 'Member';
}
