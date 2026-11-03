import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProjectPairDetail } from '../../../components/semanticOverlap/ProjectPairDetail';
import { exportFileName } from '../../../components/semanticOverlap/SemanticOverlapView';
import { overlapResultToCsv, serializeOverlapResult } from '../../../utils/semanticOverlap/overlapResult';
import type { DirectionResult } from '../../../utils/semanticOverlap/overviewTypes';
import { direction, namesOf, pair } from '../../utils/semanticOverlap/overviewHelpers';
import { sampleImprovedResult, sampleResult } from './sampleResult';

const mocks = vi.hoisted(() => ({ download: vi.fn() }));
vi.mock('../../../utils/downloadFile', () => ({ downloadTextAsFile: mocks.download }));
vi.mock('../../../components/semanticOverlap/CorrespondenceLinkDiagram', () => ({
  CorrespondenceLinkDiagram: () => <div data-testid="link-diagram" />,
}));
vi.mock('../../../components/semanticOverlap/SimilarityHeatmap', () => ({
  SimilarityHeatmap: () => <div data-testid="heatmap" />,
}));
vi.mock('../../../hooks/useSemanticOverlapRun', () => ({ useSemanticOverlapRun: () => { throw new Error('no analysis here'); } }));

const forwardResult = sampleResult();
const backwardResult = sampleImprovedResult();
const doneWith = (result: typeof forwardResult): DirectionResult => ({ state: 'done', result, error: null, cacheKey: 'k' });
const names = namesOf('Ecore', 'UML');

function renderDetail(dir: 'forward' | 'backward' = 'forward', backward: DirectionResult = doneWith(backwardResult)) {
  const onDirectionChange = vi.fn();
  const onBack = vi.fn();
  const view = render(
    <ProjectPairDetail pair={pair('Ecore', 'UML', doneWith(forwardResult), backward)} names={names}
      direction={dir} onDirectionChange={onDirectionChange} onBack={onBack} />,
  );
  return { onDirectionChange, onBack, ...view };
}

describe('ProjectPairDetail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the forward result with the overlap the overview shows', () => {
    renderDetail();
    expect(screen.getByRole('heading', { name: 'Ecore ↔ UML' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Ecore → UML' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('region', { name: 'Overlap summary' })).toHaveTextContent(`${forwardResult.summary.overlapPercent.toFixed(0)} %`);
  });

  it('switches the direction', () => {
    const { onDirectionChange, rerender } = renderDetail();
    fireEvent.click(screen.getByRole('radio', { name: 'UML → Ecore' }));
    expect(onDirectionChange).toHaveBeenCalledWith('backward');
    rerender(<ProjectPairDetail pair={pair('Ecore', 'UML', doneWith(forwardResult), doneWith(backwardResult))} names={names}
      direction="backward" onDirectionChange={onDirectionChange} onBack={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'UML → Ecore' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('region', { name: 'Overlap summary' })).toHaveTextContent(`${backwardResult.summary.overlapPercent.toFixed(0)} %`);
  });

  it('disables a direction without a result and says why', () => {
    renderDetail('forward', direction('failed', 'boom'));
    expect(screen.getByRole('radio', { name: 'UML → Ecore (failed)' })).toBeDisabled();
    const { container } = renderDetail('backward', direction('failed', 'boom'));
    expect(container).toHaveTextContent('boom');
  });

  it('exports the shown direction with the existing exports', () => {
    renderDetail();
    fireEvent.click(screen.getByRole('button', { name: 'Export JSON' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(mocks.download).toHaveBeenNthCalledWith(1, serializeOverlapResult(forwardResult), exportFileName(forwardResult, 'json'), 'application/json;charset=utf-8');
    expect(mocks.download).toHaveBeenNthCalledWith(2, overlapResultToCsv(forwardResult), exportFileName(forwardResult, 'csv'), 'text/csv;charset=utf-8');
  });

  it('goes back to the overview', () => {
    const { onBack } = renderDetail();
    fireEvent.click(screen.getByRole('button', { name: '← Back to overview' }));
    expect(onBack).toHaveBeenCalled();
  });
});
