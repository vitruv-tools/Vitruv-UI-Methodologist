import {
  formatMultiplicity,
  parseMultiplicity,
  relationshipMultiplicitySelectOptions,
} from '../../utils/umlMultiplicity';

describe('umlMultiplicity', () => {
  it('parses single value', () => {
    expect(parseMultiplicity('1')).toEqual({ lower: '1', upper: '1' });
  });

  it('parses range with star', () => {
    expect(parseMultiplicity('0..*')).toEqual({ lower: '0', upper: '-1' });
  });

  it('parses bracketed range', () => {
    expect(parseMultiplicity('[1..5]')).toEqual({ lower: '1', upper: '5' });
  });

  it('defaults empty to 0..1', () => {
    expect(parseMultiplicity('')).toEqual({ lower: '0', upper: '1' });
  });

  it('formats single value', () => {
    expect(formatMultiplicity('1', '1')).toBe('1');
  });

  it('formats range with star', () => {
    expect(formatMultiplicity('0', '-1')).toBe('0..*');
  });

  it('lists standard relationship multiplicity options', () => {
    expect(relationshipMultiplicitySelectOptions('1')).toEqual(['', '1', '0..1', '0..*', '1..*', '*']);
  });

  it('preserves custom multiplicity in select options', () => {
    expect(relationshipMultiplicitySelectOptions('2..5')).toContain('2..5');
  });
});
