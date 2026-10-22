import { cardColor, darken, metaModelDisplayColor } from '../../utils/metaModelColors';

describe('metaModelDisplayColor', () => {
  it('uses the named domain palette when a domain is set', () => {
    expect(metaModelDisplayColor('pcm', 'other.ecore')).toBe(cardColor('pcm'));
    expect(metaModelDisplayColor('pcm', 'other.ecore')).toBe('#fca5a5');
  });

  it('falls back to the file name so VSUM cards stay unique without a domain', () => {
    expect(metaModelDisplayColor(undefined, 'families.ecore'))
      .toBe(cardColor('families.ecore'));
    expect(metaModelDisplayColor(undefined, 'families.ecore'))
      .not.toBe(metaModelDisplayColor(undefined, 'persons.ecore'));
  });

  it('matches VSUM card color for the same domain or file name', () => {
    expect(metaModelDisplayColor('target')).toBe(cardColor('target'));
    expect(metaModelDisplayColor(undefined, 'model.ecore'))
      .toBe(cardColor('model.ecore'));
  });
});

describe('darken', () => {
  it('subtracts from each RGB channel', () => {
    expect(darken('#ffffff', 16)).toBe('#efefef');
  });
});
