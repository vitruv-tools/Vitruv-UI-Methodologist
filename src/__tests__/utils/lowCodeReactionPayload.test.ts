import {
  resolveLowCodeReactionDiscriminator,
  toWireLowCodeReactionRequestBase,
} from '../../utils/lowCodeReactionPayload';

describe('resolveLowCodeReactionDiscriminator', () => {
  it('prefers the metadata-map key stored as _reactionTemplate', () => {
    expect(
      resolveLowCodeReactionDiscriminator({
        _reactionTemplate: 'create_corresponding_root_on_insert_root',
        name: 'Create Corresponding Root',
      }),
    ).toBe('create_corresponding_root_on_insert_root');
  });

  it('uses name when it is already a Jackson type id', () => {
    expect(
      resolveLowCodeReactionDiscriminator({
        name: 'create_corresponding_root_on_insert_root',
        regenerate: true,
      }),
    ).toBe('create_corresponding_root_on_insert_root');
  });

  it('ignores display titles', () => {
    expect(
      resolveLowCodeReactionDiscriminator({ name: 'Create Corresponding Root' }),
    ).toBeUndefined();
  });
});

describe('toWireLowCodeReactionRequestBase', () => {
  it('sets name to the Jackson discriminator and strips the UI template key', () => {
    expect(
      toWireLowCodeReactionRequestBase({
        _reactionTemplate: 'create_corresponding_root_on_insert_root',
        regenerate: true,
        model1Uri: 'http://families',
        model2Uri: 'http://persons',
        reactionName: 'syncFamiliesToPersons',
      }),
    ).toEqual({
      name: 'create_corresponding_root_on_insert_root',
      regenerate: true,
      model1Uri: 'http://families',
      model2Uri: 'http://persons',
      reactionName: 'syncFamiliesToPersons',
    });
  });

  it('overwrites a display-title name with the discriminator', () => {
    expect(
      toWireLowCodeReactionRequestBase({
        _reactionTemplate: 'create_corresponding_root_on_insert_root',
        name: 'Create Corresponding Root',
        regenerate: true,
      }),
    ).toEqual({
      name: 'create_corresponding_root_on_insert_root',
      regenerate: true,
    });
  });

  it('returns undefined for empty input', () => {
    expect(toWireLowCodeReactionRequestBase(undefined)).toBeUndefined();
    expect(toWireLowCodeReactionRequestBase({})).toBeUndefined();
  });
});
