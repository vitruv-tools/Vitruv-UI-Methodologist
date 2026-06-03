import { Vsum } from '../types';

/** Days before soft-deleted projects are permanently removed (matches backend policy). */
export const DELETED_PROJECT_RETENTION_DAYS = 30;

/** Days remaining until permanent deletion; 0 means retention period has ended. */
export const getDaysUntilPermanentDelete = (removedAt: string | null | undefined): number => {
  if (!removedAt || (typeof removedAt === 'string' && !removedAt.trim())) return 0;
  const removedMs = new Date(removedAt).getTime();
  if (!Number.isFinite(removedMs)) return 0;
  const elapsedDays = (Date.now() - removedMs) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.floor(DELETED_PROJECT_RETENTION_DAYS - elapsedDays));
};

/** Soft-deleted project still within the restore window (not yet purged from the database). */
export const isRestorableDeletedVsum = (item: Vsum): boolean => {
  if (!item.removedAt) return false;
  return getDaysUntilPermanentDelete(item.removedAt) > 0;
};

export const filterRestorableDeletedVsums = (items: Vsum[]): Vsum[] =>
  items.filter(isRestorableDeletedVsum);

export const formatDaysRemainingLabel = (days: number): string => {
  if (days <= 0) return '0 days left';
  if (days === 1) return '1 day left';
  return `${days} days left`;
};

export type DeletionUrgency = 'critical' | 'warning' | 'caution' | 'safe';

export const getDeletionUrgency = (daysLeft: number): DeletionUrgency => {
  if (daysLeft <= 3) return 'critical';
  if (daysLeft <= 7) return 'warning';
  if (daysLeft <= 14) return 'caution';
  return 'safe';
};

export const DELETION_URGENCY_STYLES = {
  critical: { bg: '#fef2f2', text: '#991b1b', border: '#fca5a5', dot: '#ef4444' },
  warning: { bg: '#fff7ed', text: '#c2410c', border: '#fdba74', dot: '#f97316' },
  caution: { bg: '#fefce8', text: '#854d0e', border: '#fde68a', dot: '#eab308' },
  safe: { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0', dot: '#22c55e' },
} as const;
