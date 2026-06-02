/**
 * Unit tests for the pure helper functions inside ProjectsView.tsx.
 * The functions are module-private, so they are mirrored here.
 */

// ── mirrors of ProjectsView internals ─────────────────────────────────────────

const formatDate = (iso: string): string => {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
};

const getDaysLeft = (removedAt: string | null | undefined): number => {
  if (!removedAt) return 30;
  const elapsed = (Date.now() - new Date(removedAt).getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.floor(30 - elapsed));
};

type Urgency = 'critical' | 'warning' | 'caution' | 'safe';

const getUrgency = (days: number): Urgency => {
  if (days <= 3) return 'critical';
  if (days <= 7) return 'warning';
  if (days <= 14) return 'caution';
  return 'safe';
};

// Helper: returns an ISO string n full days ago
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
    // 2024-03-15T00:00:00.000Z → "15/03/2024" in en-GB
    const result = formatDate('2024-03-15T00:00:00.000Z');
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(result).toContain('2024');
  });

  it('handles a date at year boundary', () => {
    const result = formatDate('2023-12-31T23:59:59.999Z');
    expect(result).toMatch(/\d{2}\/\d{2}\/202[34]/); // could be 2023 or 2024 depending on TZ
  });
});

// ── getDaysLeft ───────────────────────────────────────────────────────────────

describe('getDaysLeft', () => {
  it('returns 30 when removedAt is null', () => {
    expect(getDaysLeft(null)).toBe(30);
  });

  it('returns 30 when removedAt is undefined', () => {
    expect(getDaysLeft(undefined)).toBe(30);
  });

  it('returns 30 when removedAt is empty string', () => {
    // new Date('') is Invalid Date → NaN arithmetic → Math.floor returns NaN clamped by max(0)
    // The function guards against missing value only for falsy; '' is falsy
    expect(getDaysLeft('')).toBe(30);
  });

  it('returns 29 or 30 for a timestamp just now', () => {
    const result = getDaysLeft(new Date().toISOString());
    expect(result).toBeGreaterThanOrEqual(29);
    expect(result).toBeLessThanOrEqual(30);
  });

  it('returns approximately 20 when deleted 10 days ago', () => {
    // Use a range to avoid flakiness from sub-millisecond drift
    const result = getDaysLeft(daysAgo(10));
    expect(result).toBeGreaterThanOrEqual(19);
    expect(result).toBeLessThanOrEqual(20);
  });

  it('returns approximately 1 when deleted 29 days ago', () => {
    const result = getDaysLeft(daysAgo(29));
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
  });

  it('returns 0 when deleted exactly 30 days ago', () => {
    expect(getDaysLeft(daysAgo(30))).toBe(0);
  });

  it('returns 0 when deleted more than 30 days ago', () => {
    expect(getDaysLeft(daysAgo(45))).toBe(0);
    expect(getDaysLeft(daysAgo(100))).toBe(0);
  });

  it('never returns a negative number', () => {
    expect(getDaysLeft(daysAgo(365))).toBe(0);
  });
});

// ── getUrgency ────────────────────────────────────────────────────────────────

describe('getUrgency', () => {
  it('returns "critical" for 0 days', () => {
    expect(getUrgency(0)).toBe('critical');
  });

  it('returns "critical" for 1 day', () => {
    expect(getUrgency(1)).toBe('critical');
  });

  it('returns "critical" for exactly 3 days', () => {
    expect(getUrgency(3)).toBe('critical');
  });

  it('returns "warning" for 4 days', () => {
    expect(getUrgency(4)).toBe('warning');
  });

  it('returns "warning" for exactly 7 days', () => {
    expect(getUrgency(7)).toBe('warning');
  });

  it('returns "caution" for 8 days', () => {
    expect(getUrgency(8)).toBe('caution');
  });

  it('returns "caution" for exactly 14 days', () => {
    expect(getUrgency(14)).toBe('caution');
  });

  it('returns "safe" for 15 days', () => {
    expect(getUrgency(15)).toBe('safe');
  });

  it('returns "safe" for 30 days', () => {
    expect(getUrgency(30)).toBe('safe');
  });

  // boundary values
  it('boundary: 3→critical, 4→warning', () => {
    expect(getUrgency(3)).toBe('critical');
    expect(getUrgency(4)).toBe('warning');
  });

  it('boundary: 7→warning, 8→caution', () => {
    expect(getUrgency(7)).toBe('warning');
    expect(getUrgency(8)).toBe('caution');
  });

  it('boundary: 14→caution, 15→safe', () => {
    expect(getUrgency(14)).toBe('caution');
    expect(getUrgency(15)).toBe('safe');
  });
});
