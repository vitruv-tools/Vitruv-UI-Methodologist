import {
  appendMetaModelVersion,
  DEFAULT_META_MODEL_VERSION,
  displayMetaModelVersion,
} from '../../utils/metaModelVersion';

describe('displayMetaModelVersion', () => {
  it('keeps a non-blank version as stored', () => {
    expect(displayMetaModelVersion('2.0')).toBe('2.0');
    expect(displayMetaModelVersion('  beta ')).toBe('beta');
  });

  it('falls back to the backend default when version is missing or blank', () => {
    expect(displayMetaModelVersion(undefined)).toBe(DEFAULT_META_MODEL_VERSION);
    expect(displayMetaModelVersion(null)).toBe('1.0');
    expect(displayMetaModelVersion('   ')).toBe('1.0');
  });
});

describe('appendMetaModelVersion', () => {
  it('leaves the name unchanged when no version was returned', () => {
    expect(appendMetaModelVersion('Foo')).toBe('Foo');
    expect(appendMetaModelVersion('Foo', '  ')).toBe('Foo');
  });

  it('appends a stored version', () => {
    expect(appendMetaModelVersion('Foo', '2.0')).toBe('Foo (2.0)');
  });
});
