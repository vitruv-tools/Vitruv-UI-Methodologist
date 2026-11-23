import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublishedVersionPage } from '../../pages/PublishedVersionPage';
import { useProjectStore } from '../../store/Project';
import type { VsumVersionContentResponse } from '../../types/vsumBuild';

const { mockGetContent, mockGetFile, canvas } = vi.hoisted(() => ({
  mockGetContent: vi.fn(),
  mockGetFile: vi.fn(),
  canvas: {
    props: null as Record<string, unknown> | null,
    added: [] as Array<{ fileName: string; fileContent: string; meta: Record<string, unknown> }>,
    setEcorePositions: vi.fn(),
  },
}));

vi.mock('../../services/api', () => ({
  apiService: {
    getLatestVsumVersionContent: mockGetContent,
    getFile: mockGetFile,
  },
}));

vi.mock('../../components/flow/FlowCanvas', async () => {
  const ReactModule = await import('react');
  return {
    // Holds the boxes it was given, like the real canvas, so the page can wait for them.
    FlowCanvas: ReactModule.forwardRef((props: Record<string, unknown>, ref: React.Ref<unknown>) => {
      canvas.props = props;
      ReactModule.useImperativeHandle(ref, () => ({
        addEcoreFile: (fileName: string, fileContent: string, meta: Record<string, unknown>) => {
          canvas.added.push({ fileName, fileContent, meta });
        },
        getNodes: () =>
          canvas.added.map(({ meta }) => ({
            id: String(meta.metaModelId),
            type: 'ecoreFile',
            data: { metaModelId: meta.metaModelId, metaModelSourceId: meta.metaModelSourceId },
          })),
        setEcorePositions: canvas.setEcorePositions,
        establishBaseline: vi.fn(),
      }));
      return <div data-testid="flow-canvas" />;
    }),
  };
});

function content(overrides: Partial<VsumVersionContentResponse> = {}): VsumVersionContentResponse {
  return {
    number: 2,
    createdBy: 'owner@example.com',
    createdAt: '2026-11-23T20:00:00Z',
    project: {
      id: 23,
      name: 'Demo',
      metaModels: [
        { id: 6, sourceId: 6, name: 'Families', ecoreFileId: 217 },
        { id: 12, sourceId: 12, name: 'Persons', ecoreFileId: 218 },
      ],
      metaModelsRelation: [],
      layout: { metaModels: { '6': { x: 10, y: 20 }, '12': { x: 300, y: 40 } } },
    } as unknown as VsumVersionContentResponse['project'],
    ruleSets: [],
    ...overrides,
  };
}

function renderPage(projectId = '23') {
  return render(
    <MemoryRouter initialEntries={[`/canvas/${projectId}/published`]}>
      <Routes>
        <Route path="/canvas/:id/published" element={<PublishedVersionPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PublishedVersionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canvas.props = null;
    canvas.added = [];
    mockGetFile.mockImplementation(async (id: number) => `<ecore ${id}/>`);
    useProjectStore.getState().setActiveId(null);
  });

  it('shows the published version read-only with its number, date and publisher', async () => {
    mockGetContent.mockResolvedValue(content());

    renderPage();

    expect(await screen.findByText(/Published version v2 · 23 Nov/)).toBeInTheDocument();
    expect(screen.getByText(/owner@example\.com/)).toBeInTheDocument();
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
    expect(mockGetContent).toHaveBeenCalledWith(23);
    expect(canvas.props?.readOnly).toBe(true);
    expect(canvas.props?.collaboration).toBeUndefined();
  });

  it('puts a box for each metamodel on the canvas with its published ecore file', async () => {
    mockGetContent.mockResolvedValue(content());

    renderPage();

    await waitFor(() => expect(canvas.added).toHaveLength(2));
    expect(mockGetFile).toHaveBeenCalledWith(217);
    expect(mockGetFile).toHaveBeenCalledWith(218);
    expect(canvas.added[0]).toMatchObject({
      fileContent: '<ecore 217/>',
      meta: { metaModelId: 6, ecoreFileId: 217, fromServerLoad: true },
    });
  });

  it('places the boxes where they were when the version was published', async () => {
    mockGetContent.mockResolvedValue(content());

    renderPage();

    await waitFor(() => expect(canvas.setEcorePositions).toHaveBeenCalled());
    const positions = canvas.setEcorePositions.mock.calls[0][0] as Map<number, unknown>;
    expect([...positions.entries()]).toEqual([
      [6, { x: 10, y: 20 }],
      [12, { x: 300, y: 40 }],
    ]);
  });

  it('keeps the box positions of the live project untouched', async () => {
    mockGetContent.mockResolvedValue(content());
    useProjectStore.getState().setActiveId(23);

    renderPage();

    await screen.findByText(/Published version v2/);
    // Box positions are kept per active project; the published version must not use the live one.
    expect(useProjectStore.getState().activeId).toBeNull();
  });

  it('colours the banner from the theme, so it reads in light and dark mode', async () => {
    mockGetContent.mockResolvedValue(content());

    renderPage();

    const banner = await screen.findByTestId('published-version-banner');
    expect(banner.style.background).toBe('var(--v-warning-bg)');
    expect(banner.style.color).toBe('var(--v-warning-text)');
  });

  it('links back to the project', async () => {
    mockGetContent.mockResolvedValue(content());

    renderPage();

    expect(await screen.findByRole('link', { name: /Open the project/ })).toHaveAttribute(
      'href',
      '/canvas/23',
    );
  });

  it('explains when there is no published version to show', async () => {
    mockGetContent.mockResolvedValue(null);

    renderPage();

    expect(await screen.findByText(/no published version to show/i)).toBeInTheDocument();
    expect(screen.getByText(/publish the project again/i)).toBeInTheDocument();
    expect(screen.queryByTestId('flow-canvas')).not.toBeInTheDocument();
  });

  it('says so when the published version cannot be loaded', async () => {
    mockGetContent.mockRejectedValue(new Error('Server error'));

    renderPage();

    expect(await screen.findByText(/could not be loaded/i)).toBeInTheDocument();
    expect(screen.queryByTestId('flow-canvas')).not.toBeInTheDocument();
  });

  it('does not load anything for a project id that is not a number', async () => {
    renderPage('abc');

    expect(await screen.findByText(/no published version to show/i)).toBeInTheDocument();
    expect(mockGetContent).not.toHaveBeenCalled();
  });
});
