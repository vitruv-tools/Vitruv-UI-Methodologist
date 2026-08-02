import {
  DELETED_PROJECT_RETENTION_DAYS,
  filterRestorableDeletedVsums,
  formatDaysRemainingLabel,
  getDaysUntilPermanentDelete,
  getDeletionUrgency,
  isRestorableDeletedVsum,
} from '../../utils/deletedProjectUtils';
import { Vsum } from '../../types';

const daysAgo = (n: number): string =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

const makeVsum = (overrides: Partial<Vsum> = {}): Vsum =>
  ({
    id: 1,
    name: 'test',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    removedAt: null,
    ...overrides,
  }) as Vsum;

describe('getDaysUntilPermanentDelete', () => {
  it('returns 0 when removedAt is missing or blank', () => {
    expect(getDaysUntilPermanentDelete(null)).toBe(0);
    expect(getDaysUntilPermanentDelete(undefined)).toBe(0);
    expect(getDaysUntilPermanentDelete('')).toBe(0);
  });

  it('returns 0 for invalid removedAt', () => {
    expect(getDaysUntilPermanentDelete('not-a-date')).toBe(0);
  });

  it('counts down from 30 days', () => {
    const afterTen = getDaysUntilPermanentDelete(daysAgo(10));
    expect(afterTen).toBeGreaterThanOrEqual(19);
    expect(afterTen).toBeLessThanOrEqual(20);
    expect(getDaysUntilPermanentDelete(daysAgo(30))).toBe(0);
    expect(getDaysUntilPermanentDelete(daysAgo(100))).toBe(0);
  });
});

describe('formatDaysRemainingLabel', () => {
  it('formats singular and plural days', () => {
    expect(formatDaysRemainingLabel(0)).toBe('0 days left');
    expect(formatDaysRemainingLabel(1)).toBe('1 day left');
    expect(formatDaysRemainingLabel(14)).toBe('14 days left');
  });
});

describe('isRestorableDeletedVsum', () => {
  it('excludes items without removedAt or past retention', () => {
    expect(isRestorableDeletedVsum(makeVsum())).toBe(false);
    expect(isRestorableDeletedVsum(makeVsum({ removedAt: daysAgo(31) }))).toBe(false);
    expect(isRestorableDeletedVsum(makeVsum({ removedAt: daysAgo(5) }))).toBe(true);
  });
});

describe('filterRestorableDeletedVsums', () => {
  it('keeps only restorable deleted projects', () => {
    const items = [
      makeVsum({ id: 1, removedAt: daysAgo(5) }),
      makeVsum({ id: 2, removedAt: daysAgo(40) }),
      makeVsum({ id: 3 }),
    ];
    const filtered = filterRestorableDeletedVsums(items);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(1);
  });
});

describe('getDeletionUrgency', () => {
  it('maps day ranges to urgency levels', () => {
    expect(getDeletionUrgency(3)).toBe('critical');
    expect(getDeletionUrgency(7)).toBe('warning');
    expect(getDeletionUrgency(14)).toBe('caution');
    expect(getDeletionUrgency(15)).toBe('safe');
  });
});
