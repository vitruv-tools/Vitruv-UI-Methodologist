import { Vsum } from '../types';
import { isSharedProject } from './vsumProjectList';

function storageKey(userKey?: string | null): string {
  const key = userKey?.trim() || 'anonymous';
  return `vsum-shared-seen:${key}`;
}

export function readSeenSharedProjectIds(userKey?: string | null): Set<number> {
  try {
    const raw = localStorage.getItem(storageKey(userKey));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is number => typeof id === 'number'));
  } catch {
    return new Set();
  }
}

function writeSeenSharedProjectIds(userKey: string | null | undefined, ids: Set<number>): void {
  try {
    localStorage.setItem(storageKey(userKey), JSON.stringify([...ids]));
  } catch {
    // ignore storage errors
  }
}

export function markSharedProjectSeen(projectId: number, userKey?: string | null): void {
  const seen = readSeenSharedProjectIds(userKey);
  if (seen.has(projectId)) return;
  seen.add(projectId);
  writeSeenSharedProjectIds(userKey, seen);
}

export function markSharedProjectsSeen(projectIds: number[], userKey?: string | null): void {
  if (projectIds.length === 0) return;
  const seen = readSeenSharedProjectIds(userKey);
  let changed = false;
  for (const id of projectIds) {
    if (!seen.has(id)) {
      seen.add(id);
      changed = true;
    }
  }
  if (changed) writeSeenSharedProjectIds(userKey, seen);
}

export function countUnreadSharedProjects(items: Vsum[], userKey?: string | null): number {
  const seen = readSeenSharedProjectIds(userKey);
  return items.filter(item => isSharedProject(item) && !seen.has(item.id)).length;
}

export function listUnreadSharedProjectIds(items: Vsum[], userKey?: string | null): number[] {
  const seen = readSeenSharedProjectIds(userKey);
  return items.filter(item => isSharedProject(item) && !seen.has(item.id)).map(item => item.id);
}
