import { parseMultiplicity, formatMultiplicity } from '../../utils/umlMultiplicity';

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
});
