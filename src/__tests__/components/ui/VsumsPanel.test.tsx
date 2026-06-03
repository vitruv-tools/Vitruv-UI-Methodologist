import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Vsum } from '../../../types';

import {
  DELETED_PROJECT_RETENTION_DAYS,
  formatDaysRemainingLabel,
  getDaysUntilPermanentDelete,
  getDeletionUrgency,
  isRestorableDeletedVsum,
} from '../../../utils/deletedProjectUtils';

const daysAgo = (n: number): string =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

// ─── getDaysUntilPermanentDelete ──────────────────────────────────────────────
// Use fake timers so Date.now() is frozen: daysAgo() and getDaysLeft() see the
// exact same millisecond and there is no floating-point jitter from real elapsed
// time between the two calls.

describe('getDaysUntilPermanentDelete', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-06-15T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns 0 when removedAt is null or undefined', () => {
    expect(getDaysUntilPermanentDelete(null)).toBe(0);
    expect(getDaysUntilPermanentDelete(undefined)).toBe(0);
  });

  it('returns full window when deleted just now', () => {
    expect(getDaysUntilPermanentDelete(new Date().toISOString())).toBe(DELETED_PROJECT_RETENTION_DAYS);
  });

  it('returns 20 when deleted 10 days ago', () => {
    expect(getDaysUntilPermanentDelete(daysAgo(10))).toBe(20);
  });

  it('returns 1 when deleted 29 days ago', () => {
    expect(getDaysUntilPermanentDelete(daysAgo(29))).toBe(1);
  });

  it('returns 0 when deleted 30 or more days ago', () => {
    expect(getDaysUntilPermanentDelete(daysAgo(30))).toBe(0);
    expect(getDaysUntilPermanentDelete(daysAgo(35))).toBe(0);
  });
});

// ─── getDeletionUrgency ───────────────────────────────────────────────────────

describe('getDeletionUrgency', () => {
  it('critical for 0 days', () => expect(getDeletionUrgency(0)).toBe('critical'));
  it('critical for 3 days', () => expect(getDeletionUrgency(3)).toBe('critical'));
  it('warning for 4 days', () => expect(getDeletionUrgency(4)).toBe('warning'));
  it('warning for 7 days', () => expect(getDeletionUrgency(7)).toBe('warning'));
  it('caution for 8 days', () => expect(getDeletionUrgency(8)).toBe('caution'));
  it('caution for 14 days', () => expect(getDeletionUrgency(14)).toBe('caution'));
  it('safe for 15 days', () => expect(getDeletionUrgency(15)).toBe('safe'));
  it('safe for 30 days', () => expect(getDeletionUrgency(30)).toBe('safe'));
});

// ─── Countdown badge label format ─────────────────────────────────────────────

describe('formatDaysRemainingLabel', () => {
  it('shows explicit day count at 0 days', () => {
    expect(formatDaysRemainingLabel(0)).toBe('0 days left');
  });

  it('uses singular "day" at exactly 1 day left', () => {
    expect(formatDaysRemainingLabel(1)).toBe('1 day left');
  });

  it('uses plural "days" at 2+ days left', () => {
    expect(formatDaysRemainingLabel(2)).toBe('2 days left');
    expect(formatDaysRemainingLabel(29)).toBe('29 days left');
  });
});

// ─── Vsum type contract ───────────────────────────────────────────────────────

describe('Vsum type contract', () => {
  it('includes removedAt for a deleted project', () => {
    const withRemoved: Vsum = {
      id: 1,
      name: 'test',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      removedAt: daysAgo(5),
    };
    expect(withRemoved.removedAt).toBeDefined();
    const days = getDaysUntilPermanentDelete(withRemoved.removedAt);
    expect(days).toBeGreaterThanOrEqual(24);
    expect(days).toBeLessThanOrEqual(25);
    expect(isRestorableDeletedVsum(withRemoved)).toBe(true);
  });

  it('allows removedAt to be absent (active project)', () => {
    const active: Vsum = {
      id: 2,
      name: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(active.removedAt).toBeUndefined();
    expect(isRestorableDeletedVsum(active)).toBe(false);
  });
});

// ─── VsumsPanel component (mocked) ───────────────────────────────────────────

jest.mock('../../../components/ui/VsumsPanel', () => {
  const React = require('react');
  return {
    __esModule: true,
    VsumsPanel: jest.fn(() =>
      React.createElement('div', { 'data-testid': 'vsums-panel' }, 'VsumsPanel mock'),
    ),
  };
});

import { VsumsPanel } from '../../../components/ui/VsumsPanel';
const mockPanel = VsumsPanel as jest.Mock;

describe('VsumsPanel component (mocked)', () => {
  beforeEach(() => mockPanel.mockClear());

  it('renders without throwing', () => {
    expect(() => render(<VsumsPanel />)).not.toThrow();
  });

  it('mock factory is invoked once per render', () => {
    render(<VsumsPanel />);
    expect(mockPanel).toHaveBeenCalledTimes(1);
  });
});

// ─── VsumsPanel real component tests ─────────────────────────────────────────

jest.mock('../../../services/api', () => ({
  apiService: {
    getVsumsPaginated: jest.fn().mockResolvedValue({ data: [] }),
    getRemovedVsumsPaginated: jest.fn().mockResolvedValue({ data: [] }),
    recoverVsum: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('../../../components/ui/CreateVsumModal', () => ({
  CreateVsumModal: ({ isOpen }: any) =>
    isOpen ? <div data-testid="create-vsum-modal" /> : null,
}));

jest.mock('../../../components/ui/VsumDetailsModal', () => ({
  VsumDetailsModal: () => null,
}));

jest.mock('../../../components/ui/ConfirmDialog', () => ({
  ConfirmDialog: ({ isOpen, onConfirm, confirmText }: any) =>
    isOpen ? <button onClick={onConfirm}>{confirmText}</button> : null,
}));

const { apiService } = require('../../../services/api') as {
  apiService: Record<string, jest.Mock>;
};

const { VsumsPanel: RealVsumsPanel } =
  jest.requireActual('../../../components/ui/VsumsPanel');

describe('VsumsPanel – real component tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiService.getVsumsPaginated.mockResolvedValue({ data: [] });
    apiService.getRemovedVsumsPaginated.mockResolvedValue({ data: [] });
  });

  it('renders Projects title and Create New Project button', async () => {
    render(<RealVsumsPanel />);
    expect(await screen.findByText('Projects')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Create New Project/i }),
    ).toBeInTheDocument();
  });

  it('shows empty state for active VSUMs', async () => {
    render(<RealVsumsPanel />);
    expect(
      await screen.findByText(/No Projects Found/i),
    ).toBeInTheDocument();
  });

  it('renders VSUM cards when API returns data', async () => {
    apiService.getVsumsPaginated.mockResolvedValueOnce({
      data: [{
        id: 1, name: 'Test Project',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        removedAt: null, role: 'OWNER',
      }],
    });
    render(<RealVsumsPanel />);
    expect(await screen.findByText('Test Project')).toBeInTheDocument();
  });

  it('switches to Deleted Projects tab and calls getRemovedVsumsPaginated', async () => {
    render(<RealVsumsPanel />);
    fireEvent.click(await screen.findByRole('button', { name: /Deleted Projects/i }));
    await waitFor(() => {
      expect(apiService.getRemovedVsumsPaginated).toHaveBeenCalled();
    });
  });

  it('opens CreateVsumModal when Create New Project is clicked', async () => {
    render(<RealVsumsPanel />);
    fireEvent.click(await screen.findByRole('button', { name: /Create New Project/i }));
    expect(screen.getByTestId('create-vsum-modal')).toBeInTheDocument();
  });

  it('shows error message when API fails', async () => {
    apiService.getVsumsPaginated.mockRejectedValueOnce(new Error('Fetch failed'));
    render(<RealVsumsPanel />);
    expect(await screen.findByText(/Fetch failed/i)).toBeInTheDocument();
  });
});