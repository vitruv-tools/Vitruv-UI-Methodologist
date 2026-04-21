import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Vsum } from '../../../types';

// ─── Helpers mirroring VsumsPanel internals ───────────────────────────────────

const getDaysLeft = (removedAt: string | null | undefined): number => {
  if (!removedAt) return 30;
  const deletedMs = new Date(removedAt).getTime();
  const elapsedDays = (Date.now() - deletedMs) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.floor(30 - elapsedDays));
};

type Urgency = 'critical' | 'warning' | 'caution' | 'safe';
const getDaysLeftUrgency = (days: number): Urgency => {
  if (days <= 3) return 'critical';
  if (days <= 7) return 'warning';
  if (days <= 14) return 'caution';
  return 'safe';
};

const daysAgo = (n: number): string =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

// ─── getDaysLeft ──────────────────────────────────────────────────────────────

describe('getDaysLeft', () => {
  it('returns 30 when removedAt is null', () => {
    expect(getDaysLeft(null)).toBe(30);
  });

  it('returns 30 when removedAt is undefined', () => {
    expect(getDaysLeft(undefined)).toBe(30);
  });

  it('returns 29 or 30 when deleted just now', () => {
    const result = getDaysLeft(new Date().toISOString());
    expect(result).toBeGreaterThanOrEqual(29);
    expect(result).toBeLessThanOrEqual(30);
  });

  it('returns 20 when deleted 10 days ago', () => {
    expect(getDaysLeft(daysAgo(10))).toBe(20);
  });

  it('returns 1 when deleted 29 days ago', () => {
    expect(getDaysLeft(daysAgo(29))).toBe(1);
  });

  it('returns 0 when deleted 30 or more days ago', () => {
    expect(getDaysLeft(daysAgo(30))).toBe(0);
    expect(getDaysLeft(daysAgo(35))).toBe(0);
  });
});

// ─── getDaysLeftUrgency ───────────────────────────────────────────────────────

describe('getDaysLeftUrgency', () => {
  it('critical for 0 days', () => expect(getDaysLeftUrgency(0)).toBe('critical'));
  it('critical for 3 days', () => expect(getDaysLeftUrgency(3)).toBe('critical'));
  it('warning for 4 days', () => expect(getDaysLeftUrgency(4)).toBe('warning'));
  it('warning for 7 days', () => expect(getDaysLeftUrgency(7)).toBe('warning'));
  it('caution for 8 days', () => expect(getDaysLeftUrgency(8)).toBe('caution'));
  it('caution for 14 days', () => expect(getDaysLeftUrgency(14)).toBe('caution'));
  it('safe for 15 days', () => expect(getDaysLeftUrgency(15)).toBe('safe'));
  it('safe for 30 days', () => expect(getDaysLeftUrgency(30)).toBe('safe'));
});

// ─── Countdown badge label format ─────────────────────────────────────────────

describe('countdown badge text', () => {
  const badgeText = (daysLeft: number) =>
    daysLeft === 0
      ? 'Deleting soon'
      : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`;

  it('shows "Deleting soon" at 0 days', () => {
    expect(badgeText(0)).toBe('Deleting soon');
  });

  it('uses singular "day" at exactly 1 day left', () => {
    expect(badgeText(1)).toBe('1 day left');
  });

  it('uses plural "days" at 2+ days left', () => {
    expect(badgeText(2)).toBe('2 days left');
    expect(badgeText(29)).toBe('29 days left');
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
    const days = getDaysLeft(withRemoved.removedAt);
    expect(days).toBeGreaterThanOrEqual(24);
    expect(days).toBeLessThanOrEqual(25);
  });

  it('allows removedAt to be absent (active project)', () => {
    const active: Vsum = {
      id: 2,
      name: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(active.removedAt).toBeUndefined();
    expect(getDaysLeft(active.removedAt)).toBe(30);
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