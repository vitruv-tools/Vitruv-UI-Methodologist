/**
 * Unit tests for ProjectsView date helpers and shared deleted-project utilities.
 */

import {
  DELETED_PROJECT_RETENTION_DAYS,
  formatDaysRemainingLabel,
  getDaysUntilPermanentDelete,
  getDeletionUrgency,
  isRestorableDeletedVsum,
} from '../../../utils/deletedProjectUtils';
import { Vsum } from '../../../types';

const formatDate = (iso: string): string => {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
};

const daysAgo = (n: number): string =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

// ── formatDate ────────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('returns "--" for empty string', () => {
    expect(formatDate('')).toBe('--');
  });

  it('returns "--" for falsy-but-typed value', () => {
    expect(formatDate(null as unknown as string)).toBe('--');
  });

  it('formats a valid ISO date string as DD/MM/YYYY', () => {
    const result = formatDate('2024-03-15T00:00:00.000Z');
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(result).toContain('2024');
  });

  it('handles a date at year boundary', () => {
    const result = formatDate('2023-12-31T23:59:59.999Z');
    expect(result).toMatch(/\d{2}\/\d{2}\/202[34]/);
  });
});

// ── deleted project retention ─────────────────────────────────────────────────

describe('getDaysUntilPermanentDelete', () => {
  it('returns 0 when removedAt is missing', () => {
    expect(getDaysUntilPermanentDelete(null)).toBe(0);
    expect(getDaysUntilPermanentDelete(undefined)).toBe(0);
    expect(getDaysUntilPermanentDelete('')).toBe(0);
    expect(getDaysUntilPermanentDelete('bad-date')).toBe(0);
  });

  it('returns approximately 20 when deleted 10 days ago', () => {
    const result = getDaysUntilPermanentDelete(daysAgo(10));
    expect(result).toBeGreaterThanOrEqual(19);
    expect(result).toBeLessThanOrEqual(20);
  });

  it('returns 0 when deleted 30+ days ago', () => {
    expect(getDaysUntilPermanentDelete(daysAgo(30))).toBe(0);
    expect(getDaysUntilPermanentDelete(daysAgo(365))).toBe(0);
  });
});

describe('formatDaysRemainingLabel', () => {
  it('never shows vague "Deleting soon" text', () => {
    expect(formatDaysRemainingLabel(0)).toBe('0 days left');
    expect(formatDaysRemainingLabel(3)).toBe('3 days left');
    expect(formatDaysRemainingLabel(1)).toBe('1 day left');
  });
});

describe('isRestorableDeletedVsum', () => {
  it('hides expired or missing removedAt from deleted tab', () => {
    const active = { id: 1, removedAt: daysAgo(5) } as Vsum;
    const expired = { id: 2, removedAt: daysAgo(35) } as Vsum;
    const noDate = { id: 3 } as Vsum;

    expect(isRestorableDeletedVsum(active)).toBe(true);
    expect(isRestorableDeletedVsum(expired)).toBe(false);
    expect(isRestorableDeletedVsum(noDate)).toBe(false);
  });
});

describe('getDeletionUrgency', () => {
  it('returns "critical" for 0–3 days', () => {
    expect(getDeletionUrgency(0)).toBe('critical');
    expect(getDeletionUrgency(3)).toBe('critical');
  });

  it('returns "warning" for 4–7 days', () => {
    expect(getDeletionUrgency(4)).toBe('warning');
    expect(getDeletionUrgency(7)).toBe('warning');
  });

  it('returns "caution" for 8–14 days', () => {
    expect(getDeletionUrgency(8)).toBe('caution');
    expect(getDeletionUrgency(14)).toBe('caution');
  });

  it('returns "safe" for 15+ days', () => {
    expect(getDeletionUrgency(15)).toBe('safe');
    expect(getDeletionUrgency(30)).toBe('safe');
  });
});
