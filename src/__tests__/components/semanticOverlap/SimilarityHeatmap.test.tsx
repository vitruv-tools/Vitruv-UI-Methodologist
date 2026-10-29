import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { cellAt, heatmapCellSize, SimilarityHeatmap } from '../../../components/semanticOverlap/SimilarityHeatmap';
import { correspondenceFor, sampleImprovedResult, sampleResult } from './sampleResult';

const result = sampleResult();
const strokes: number[][] = [];
/** Dash pattern in effect for each stroked rectangle. */
const dashes: number[][] = [];
let dash: number[] = [];

beforeEach(() => {
  strokes.length = 0;
  dashes.length = 0;
  dash = [];
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
    clearRect: vi.fn(), fillRect: vi.fn(),
    strokeRect: (...args: number[]) => { strokes.push(args); dashes.push(dash); },
    setLineDash: (segments: number[]) => { dash = segments; },
    set fillStyle(_v: string) {}, set strokeStyle(_v: string) {}, set lineWidth(_v: number) {},
  }) as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0 } as DOMRect);
});

describe('SimilarityHeatmap', () => {
  it('maps pixels to cells', () => {
    expect(cellAt(0, 0, 10)).toEqual({ row: 0, column: 0 });
    expect(cellAt(25, 39, 10)).toEqual({ row: 3, column: 2 });
    expect(heatmapCellSize(3, 3)).toBe(24);
    expect(heatmapCellSize(300, 200)).toBe(6);
  });

  it('labels rows and columns and outlines the chosen correspondences', () => {
    render(<SimilarityHeatmap result={result} minScore={0} selectedId={null} onSelect={vi.fn()} onCellFocus={vi.fn()} />);
    expect(screen.getByTitle('ecore.EClass')).toBeInTheDocument();
    expect(screen.getByTitle('uml.Association')).toBeInTheDocument();
    const chosenPairs = result.correspondences.reduce((n, c) => n + c.sources.length * c.targets.length, 0);
    expect(strokes).toHaveLength(chosenPairs);
  });

  it('selects the correspondence of a clicked cell, or focuses a free cell', () => {
    const onSelect = vi.fn();
    const onCellFocus = vi.fn();
    render(<SimilarityHeatmap result={result} minScore={0} selectedId={null} onSelect={onSelect} onCellFocus={onCellFocus} />);
    const size = heatmapCellSize(3, 3);
    const canvas = screen.getByTestId('similarity-heatmap-canvas');
    fireEvent.click(canvas, { clientX: 1, clientY: 1 }); // EClass × Class
    expect(onSelect).toHaveBeenLastCalledWith(correspondenceFor(result, 'EClass').id);
    fireEvent.click(canvas, { clientX: 2 * size + 1, clientY: 1 }); // EClass × Association
    expect(onSelect).toHaveBeenLastCalledWith(null);
    expect(onCellFocus).toHaveBeenLastCalledWith({ row: 0, column: 2 });
  });

  it('shows a tooltip with the scores of the hovered cell', () => {
    render(<SimilarityHeatmap result={result} minScore={0} selectedId={null} onSelect={vi.fn()} onCellFocus={vi.fn()} />);
    fireEvent.mouseMove(screen.getByTestId('similarity-heatmap-canvas'), { clientX: 1, clientY: 1 });
    expect(screen.getByRole('tooltip')).toHaveTextContent(/EClass ↔ Class.*Overall/);
  });

  it('outlines chosen class ↔ instance correspondences dashed', () => {
    const improved = sampleImprovedResult();
    render(<SimilarityHeatmap result={improved} minScore={0} selectedId={null} onSelect={vi.fn()} onCellFocus={vi.fn()} />);
    const instancePairs = improved.correspondences.filter(c => c.kind === 'instance')
      .reduce((n, c) => n + c.sources.length * c.targets.length, 0);
    expect(dashes.filter(d => d.length > 0)).toHaveLength(instancePairs);
    expect(dashes.filter(d => d.length === 0)).toHaveLength(strokes.length - instancePairs);
  });
});

