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

function resolveMergedSharedBy(
  role: VsumRole | null,
  patch: Partial<StoredProjectAccess>,
  existing: StoredProjectAccess | null,
): SharedByContact | null {
  if (role === 'OWNER') return null;
  if (patch.sharedBy === undefined) return existing?.sharedBy ?? null;
  return patch.sharedBy;
}

/** Update stored access without dropping an existing shared-by contact. */
export function mergeStoredProjectAccess(
  projectId: number,
  patch: Partial<StoredProjectAccess>,
): void {
  const existing = readStoredProjectAccess(projectId);
  const accessRole = patch.accessRole ?? existing?.accessRole;
  const role = resolveVsumAccessRole(accessRole);
  const sharedBy = resolveMergedSharedBy(role, patch, existing);
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
  const seenIds = new Set<number>();
  const seenEmails = new Set<string>();
  const result: VsumUserResponse[] = [];

  for (const member of members) {
    const email = member.email?.toLowerCase();
    if (email && seenEmails.has(email)) {
      const existingIndex = result.findIndex(m => m.email?.toLowerCase() === email);
      if (existingIndex >= 0 && result[existingIndex].id < 0 && member.id > 0) {
        seenIds.delete(result[existingIndex].id);
        result[existingIndex] = member;
        seenIds.add(member.id);
      }
      continue;
    }
    if (seenIds.has(member.id)) continue;

    seenIds.add(member.id);
    if (email) seenEmails.add(email);
    result.push(member);
  }

  return result;
}

/** Combine sharer contact with loaded members without duplicate people. */
export function mergeSharerWithMembers(
  projectSharer: VsumUserResponse | null,
  projectMembers: VsumUserResponse[],
): VsumUserResponse[] {
  const members = uniqueVsumMembers(projectMembers);
  if (!projectSharer) return members;

  const sharerEmail = projectSharer.email?.toLowerCase();
  const alreadyListed = members.some(m =>
    m.id === projectSharer.id
    || (sharerEmail && m.email?.toLowerCase() === sharerEmail),
  );
  if (alreadyListed) return members;
  return uniqueVsumMembers([projectSharer, ...members]);
}

export function formatProjectMemberStackLabel(
  count: number,
  options?: { isSharedAccess?: boolean; isSoloOwner?: boolean },
): string {
  if (count <= 0) return 'People';
  if (count === 1 && options?.isSoloOwner && !options?.isSharedAccess) return 'Only you';
  if (count === 1) return '1 person';
  return `${count} people`;
}

export function findVsumOwner(members: VsumUserResponse[]): VsumUserResponse | null {
  return members.find(m =>
    m.role === 'OWNER' || (m.roleEn ?? '').toLowerCase().includes('owner'),
  ) ?? null;
}

/**
 * Contact for the person who shared a project with the current user, derived
 * from the project's owner.
 *
 * Returns null when the owner *is* the current user. Nobody shared the project
 * with you, and `resolveProjectAccessRole` reads a stored `sharedBy` as proof
 * of shared access — so recording yourself here downgrades an owner to VIEWER.
 */
export function sharedByFromOwner(
  owner: VsumUserResponse | null | undefined,
  currentUserEmail?: string,
): SharedByContact | null {
  if (!owner) return null;

  const ownerEmail = owner.email?.toLowerCase();
  const selfEmail = currentUserEmail?.toLowerCase();
  if (ownerEmail && selfEmail && ownerEmail === selfEmail) return null;

  return {
    firstName: owner.firstName,
    lastName: owner.lastName,
    email: owner.email,
  };
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

function resolveSharedByFromHints(hints: Array<Vsum | null | undefined>): SharedByContact | null {
  for (const item of hints) {
    if (!item) continue;
    const fromHint = sharedByFromVsum(item);
    if (fromHint) return fromHint;
  }
  return null;
}

async function fetchOwnerFromMembers(projectId: number): Promise<SharedByContact | null> {
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
  return null;
}

async function fetchSharedByFromList(projectId: number): Promise<SharedByContact | null> {
  try {
    const listRes = await apiService.getVsumsPaginated('', 0, 100);
    const listItem = (listRes.data ?? []).find(v => v.id === projectId);
    if (!listItem) return null;
    return sharedByFromVsum(listItem);
  } catch {
    return null;
  }
}

async function fetchSharedByFromVsum(projectId: number): Promise<SharedByContact | null> {
  try {
    const vsumRes = await apiService.getVsum(projectId);
    return sharedByFromVsum(vsumRes.data);
  } catch {
    return null;
  }
}

async function fetchSharedByFromDetails(projectId: number): Promise<SharedByContact | null> {
  try {
    const detailsRes = await apiService.getVsumDetails(projectId);
    return sharedByFromVsum(detailsRes.data);
  } catch {
    return null;
  }
}

/** Resolve project owner contact for shared viewers (list API, details, or stored access). */
export async function fetchOwnerContactForVsum(
  projectId: number,
  ...hints: Array<Vsum | null | undefined>
): Promise<SharedByContact | null> {
  const fromStored = storedOwnerContact(projectId);
  if (fromStored) return fromStored;

  const fromHints = resolveSharedByFromHints(hints);
  if (fromHints) return fromHints;

  const fromMembers = await fetchOwnerFromMembers(projectId);
  if (fromMembers) return fromMembers;

  const fromList = await fetchSharedByFromList(projectId);
  if (fromList) return fromList;

  const fromVsum = await fetchSharedByFromVsum(projectId);
  if (fromVsum) return fromVsum;

  return fetchSharedByFromDetails(projectId);
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
