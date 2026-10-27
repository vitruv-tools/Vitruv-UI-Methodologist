import React, { useState } from 'react';
import Slider from '@mui/material/Slider';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { themeVars } from '../../theme/theme';
import { randomSeed } from '../../utils/semanticOverlap/search/rng';
import { EFFORT_PRESETS, validateSettings } from '../../utils/semanticOverlap/settings';
import type { AnalysisSettings, Effort } from '../../utils/semanticOverlap/types';

interface AnalysisSettingsPanelProps {
  settings: AnalysisSettings;
  onChange: (patch: Partial<AnalysisSettings>) => void;
  /** Display threshold (view state, applied without a new run). */
  minScore: number;
  onMinScoreChange: (value: number) => void;
  disabled?: boolean;
}

const EFFORTS: Effort[] = ['fast', 'balanced', 'thorough'];
const percent = (value: number) => `${Math.round(value * 100)} %`;
const toNumber = (text: string) => (text.trim() === '' ? Number.NaN : Number(text));

const SliderRow: React.FC<{
  label: string; hint: string; value: number; disabled?: boolean; onChange: (value: number) => void;
}> = ({ label, hint, value, disabled, onChange }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '220px minmax(160px, 1fr)', alignItems: 'center', gap: 12 }}>
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: themeVars.text }}>{label}</div>
      <div style={{ fontSize: 11, color: themeVars.textMuted }}>{hint}</div>
    </div>
    <Slider
      aria-label={label}
      value={value}
      min={0}
      max={1}
      step={0.05}
      disabled={disabled}
      valueLabelDisplay="auto"
      valueLabelFormat={percent}
      onChange={(_event, next) => onChange(Math.round((next as number) * 100) / 100)}
      sx={{ color: '#049484' }}
    />
  </div>
);

/**
 * Display threshold plus the collapsible analysis settings: objective weights, α/β, effort,
 * seed, null score, maximum targets per element and the GA/SA parameters.
 */
export const AnalysisSettingsPanel: React.FC<AnalysisSettingsPanelProps> = ({
  settings, onChange, minScore, onMinScoreChange, disabled,
}) => {
  const [open, setOpen] = useState(false);
  const [seedText, setSeedText] = useState(String(settings.seed));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const problems = validateSettings(settings);

  const setSeed = (seed: number) => {
    setSeedText(String(seed));
    onChange({ seed });
  };

  return (
    <section aria-label="Analysis settings panel" style={{
      border: `1px solid ${themeVars.border}`, borderRadius: 12, background: themeVars.surface, padding: '12px 16px',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <SliderRow
        label="Minimum score shown"
        hint={`Hide matches below ${percent(minScore)} (no new run needed)`}
        value={minScore}
        onChange={onMinScoreChange}
      />
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        style={{ all: 'unset', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: themeVars.textSecondary }}
      >
        {open ? '▾' : '▸'} Analysis settings (apply on the next run)
      </button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SliderRow
            label="Structural weight"
            hint={`Structure ${percent(settings.weights.structural)} · names ${percent(settings.weights.syntactic)}`}
            value={settings.weights.structural}
            disabled={disabled}
            onChange={value => onChange({ weights: { structural: value, syntactic: Math.round((1 - value) * 100) / 100 } })}
          />
          <SliderRow
            label="Vocabulary weight (α)"
            hint={`Shared words and synonyms ${percent(settings.syntactic.alpha)} · edit distance ${percent(settings.syntactic.beta)}`}
            value={settings.syntactic.alpha}
            disabled={disabled}
            onChange={value => onChange({ syntactic: { alpha: value, beta: Math.round((1 - value) * 100) / 100 } })}
          />
          <SliderRow
            label="Null score"
            hint="A class stays unmatched unless a match scores higher than this"
            value={settings.nullScore}
            disabled={disabled}
            onChange={nullScore => onChange({ nullScore })}
          />
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: themeVars.textSecondary, marginBottom: 4 }}>Search effort</div>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={settings.effort}
                disabled={disabled}
                onChange={(_event, effort: Effort | null) => {
                  if (effort) onChange({ effort, ga: EFFORT_PRESETS[effort].ga, sa: EFFORT_PRESETS[effort].sa });
                }}
              >
                {EFFORTS.map(effort => <ToggleButton key={effort} value={effort}>{effort}</ToggleButton>)}
              </ToggleButtonGroup>
            </div>
            <TextField
              id="overlap-seed"
              label="Seed"
              size="small"
              value={seedText}
              disabled={disabled}
              onChange={event => {
                setSeedText(event.target.value);
                onChange({ seed: toNumber(event.target.value) });
              }}
              sx={{ width: 150 }}
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => setSeed(randomSeed())}
              style={{
                padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${themeVars.border}`,
                background: themeVars.surface, color: themeVars.text, cursor: 'pointer', fontSize: 13,
              }}
            >
              Random seed
            </button>
            <TextField
              id="overlap-max-targets"
              label="Max. targets per element"
              select
              size="small"
              value={settings.maxTargetsPerElement}
              disabled={disabled}
              onChange={event => onChange({ maxTargetsPerElement: Number(event.target.value) })}
              slotProps={{ select: { native: true } }}
              sx={{ width: 190 }}
            >
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
            </TextField>
          </div>
          <button
            type="button"
            aria-expanded={showAdvanced}
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{ all: 'unset', cursor: 'pointer', fontSize: 12, color: themeVars.textMuted }}
          >
            {showAdvanced ? '▾' : '▸'} Advanced (genetic algorithm and simulated annealing)
          </button>
          {showAdvanced && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {([
                ['Population size', settings.ga.populationSize, (v: number) => onChange({ ga: { ...settings.ga, populationSize: v } })],
                ['Generations', settings.ga.generations, (v: number) => onChange({ ga: { ...settings.ga, generations: v } })],
                ['Start temperature', settings.sa.startTemperature, (v: number) => onChange({ sa: { ...settings.sa, startTemperature: v } })],
                ['Cooling factor', settings.sa.coolingFactor, (v: number) => onChange({ sa: { ...settings.sa, coolingFactor: v } })],
              ] as const).map(([label, value, update]) => (
                <TextField
                  key={label}
                  id={`overlap-${label.toLowerCase().replace(/\s+/g, '-')}`}
                  label={label}
                  type="number"
                  size="small"
                  value={Number.isNaN(value) ? '' : value}
                  disabled={disabled}
                  onChange={event => update(toNumber(event.target.value))}
                  sx={{ width: 160 }}
                />
              ))}
            </div>
          )}
        </div>
      )}
      {problems.length > 0 && (
        <ul role="alert" style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: themeVars.dangerText }}>
          {problems.map(problem => <li key={problem}>{problem}</li>)}
        </ul>
      )}
    </section>
  );
};
