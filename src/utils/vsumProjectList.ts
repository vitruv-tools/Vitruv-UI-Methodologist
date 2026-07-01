import { Vsum } from '../types';
import { resolveVsumAccessRole } from './vsumMemberUtils';

export type ProjectListView = 'mine' | 'shared' | 'deleted';

export function getVsumAccessRole(item: Vsum): string {
  return resolveVsumAccessRole(item.role, item.roleEn) ?? '';
}

export function isOwnedProject(item: Vsum): boolean {
  const role = getVsumAccessRole(item);
  return !role || role === 'OWNER';
}

export function isSharedProject(item: Vsum): boolean {
  const role = getVsumAccessRole(item);
  return role === 'VIEWER' || role === 'MEMBER';
}

export function matchesProjectListView(item: Vsum, view: ProjectListView): boolean {
  if (view === 'deleted') return Boolean(item.removedAt);
  if (item.removedAt) return false;
  if (view === 'shared') return isSharedProject(item);
  return isOwnedProject(item);
}
