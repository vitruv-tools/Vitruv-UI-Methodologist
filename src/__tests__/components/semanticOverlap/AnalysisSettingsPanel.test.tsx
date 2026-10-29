import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { AnalysisSettingsPanel } from '../../../components/semanticOverlap/AnalysisSettingsPanel';
import { DEFAULT_SETTINGS, EFFORT_PRESETS } from '../../../utils/semanticOverlap/settings';
import type { AnalysisSettings } from '../../../utils/semanticOverlap/types';
import type { ApproachId } from '../../../utils/semanticOverlap/approaches/types';
import { DEFAULT_IMPROVED_SETTINGS, type ImprovedSettings } from '../../../utils/semanticOverlap/improved/settings';

/** Panel with real state, so changes are visible like in the view. */
function Harness({ onMinScore = vi.fn(), initial = DEFAULT_SETTINGS, approach }: {
  onMinScore?: (v: number) => void; initial?: AnalysisSettings; approach?: ApproachId;
}) {
  const [settings, setSettings] = useState(initial);
  const [minScore, setMinScore] = useState(0);
  return (
    <>
      <AnalysisSettingsPanel
        approach={approach}
        settings={settings}
        onChange={patch => setSettings(s => ({ ...s, ...patch }))}
        minScore={minScore}
        onMinScoreChange={v => { setMinScore(v); onMinScore(v); }}
      />
      <output data-testid="settings">{JSON.stringify(settings)}</output>
    </>
  );
}

const current = (): AnalysisSettings => JSON.parse(screen.getByTestId('settings').textContent!, (_k, v) => (v === null ? Number.NaN : v));
const open = () => fireEvent.click(screen.getByRole('button', { name: /Analysis settings/ }));
const slide = (name: RegExp, value: number) => fireEvent.change(screen.getByRole('slider', { name }), { target: { value } });

describe('AnalysisSettingsPanel', () => {
  it('is collapsed until opened', () => {
    render(<Harness />);
    expect(screen.queryByRole('slider', { name: /Structural weight/ })).not.toBeInTheDocument();
    open();
    expect(screen.getByRole('slider', { name: /Structural weight/ })).toBeInTheDocument();
  });

  it('keeps structural + syntactic = 1 and alpha + beta = 1', () => {
    render(<Harness />);
    open();
    slide(/Structural weight/, 0.7);
    expect(current().weights.structural).toBeCloseTo(0.7);
    expect(current().weights.syntactic).toBeCloseTo(0.3);
    slide(/Vocabulary weight/, 0.25);
    expect(current().syntactic.alpha).toBeCloseTo(0.25);
    expect(current().syntactic.beta).toBeCloseTo(0.75);
  });

  it('applies the GA/SA parameters of the chosen effort', () => {
    render(<Harness />);
    open();
    fireEvent.click(screen.getByRole('button', { name: 'thorough' }));
    expect(current().effort).toBe('thorough');
    expect(current().ga).toEqual(EFFORT_PRESETS.thorough.ga);
    expect(current().sa).toEqual(EFFORT_PRESETS.thorough.sa);
  });

  it('accepts uint32 seeds, generates random ones and reports invalid values', () => {
    render(<Harness />);
    open();
    const seed = screen.getByLabelText('Seed');
    fireEvent.change(seed, { target: { value: '42' } });
    expect(current().seed).toBe(42);
    fireEvent.click(screen.getByRole('button', { name: 'Random seed' }));
    expect(current().seed).not.toBe(42);
    expect(Number.isInteger(current().seed)).toBe(true);
    fireEvent.change(seed, { target: { value: '-5' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Seed must be a whole number');
  });

  it('changes the null score and the maximum targets per element', () => {
    render(<Harness />);
    open();
    slide(/Null score/, 0.2);
    expect(current().nullScore).toBeCloseTo(0.2);
    fireEvent.change(screen.getByLabelText('Max. targets per element'), { target: { value: '3' } });
    expect(current().maxTargetsPerElement).toBe(3);
  });

  it('updates the display threshold without touching the analysis settings', () => {
    const onMinScore = vi.fn();
    render(<Harness onMinScore={onMinScore} />);
    const before = current();
    slide(/Minimum score shown/, 0.6);
    expect(onMinScore).toHaveBeenCalledWith(0.6);
    expect(current()).toEqual(before);
  });

  describe('per approach', () => {
    it('shows no improvements for the paper approach', () => {
      render(<Harness approach="paper" />);
      open();
      expect(screen.queryByRole('group', { name: 'Improvements' })).not.toBeInTheDocument();
      expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    });

    it('shows the nine improvements of the improved approach and toggles them', () => {
      render(<Harness approach="improved" initial={DEFAULT_IMPROVED_SETTINGS} />);
      open();
      expect(screen.getByRole('group', { name: 'Improvements' })).toBeInTheDocument();
      expect(screen.getAllByRole('checkbox')).toHaveLength(9);
      fireEvent.click(screen.getByRole('checkbox', { name: 'Similarity flooding' }));
      expect((current() as ImprovedSettings).improvements.flooding).toBe(!DEFAULT_IMPROVED_SETTINGS.improvements.flooding);
    });

    it('validates the improvement parameters', () => {
      render(<Harness approach="improved" initial={DEFAULT_IMPROVED_SETTINGS} />);
      open();
      fireEvent.change(screen.getByLabelText('Flooding weight (λ)'), { target: { value: '2' } });
      expect(screen.getByRole('alert')).toHaveTextContent('Flooding weight must be between 0 and 1.');
    });
  });
});

