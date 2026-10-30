import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { AlternativeSwitcher } from '../../../components/semanticOverlap/AlternativeSwitcher';
import { sampleAlternativesResult } from './sampleResult';

const { alternatives } = sampleAlternativesResult();

describe('AlternativeSwitcher', () => {
  it('labels each alternative by what it favours and marks the default', () => {
    render(<AlternativeSwitcher alternatives={alternatives!} selected={1} onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Lexical' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Balanced (default)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Structural' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('reports the chosen alternative', () => {
    const onSelect = vi.fn();
    render(<AlternativeSwitcher alternatives={alternatives!} selected={1} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Structural' }));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it('names merged alternatives by all their labels', () => {
    const merged = [{ ...alternatives![1], label: 'balanced, lexical' }];
    render(<AlternativeSwitcher alternatives={merged} selected={0} onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Balanced · Lexical (default)' })).toBeInTheDocument();
  });
});
