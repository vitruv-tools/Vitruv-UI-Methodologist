import {
  appendMetaModelSearchToken,
  buildMetaModelFindFilters,
  completeMetaModelSearchToken,
  parseMetaModelSearchQuery,
} from '../../utils/metaModelSearchFilters';

describe('metaModelSearchFilters', () => {
  it('parses GitHub-style filter tokens', () => {
    expect(parseMetaModelSearchQuery('name:test domain:engineering keywords:uml,ecore')).toEqual([
      { key: 'name', value: 'test' },
      { key: 'domain', value: 'engineering' },
      { key: 'keywords', value: 'uml,ecore' },
    ]);
  });

  it('ignores unknown or malformed tokens', () => {
    expect(parseMetaModelSearchQuery('unknown:value name:test plain-text')).toEqual([
      { key: 'name', value: 'test' },
    ]);
  });

  it('uses plain search text as a name filter when no key:value syntax is present', () => {
    expect(buildMetaModelFindFilters('MyModel', [], 'all')).toEqual({
      name: 'MyModel',
    });
  });

  it('includes ownedByUser only when explicitly requested', () => {
    expect(buildMetaModelFindFilters('', [], 'all', true)).toEqual({
      ownedByUser: true,
    });
  });

  it('maps parsed filters to backend find-all fields', () => {
    const parsed = parseMetaModelSearchQuery('name:eco domain:Testing keywords:foo,bar');
    expect(buildMetaModelFindFilters('name:eco domain:Testing keywords:foo,bar', parsed, 'all')).toEqual({
      name: 'eco',
      domain: 'Testing',
      keyword: ['foo', 'bar'],
    });
  });

  it('applies created date presets when no explicit created filter is present', () => {
    const filters = buildMetaModelFindFilters('', [], 'week');
    expect(filters.createdFrom).toBeDefined();
    expect(filters.createdTo).toBeDefined();
  });

  it('appends search tokens for quick filters', () => {
    expect(appendMetaModelSearchToken('name:eco', 'domain', 'Testing')).toBe(
      'name:eco domain:Testing',
    );
    expect(appendMetaModelSearchToken('', 'keywords', 'uml')).toBe('keywords:uml');
  });

  it('maps created date filters to backend date range fields', () => {
    const parsed = parseMetaModelSearchQuery('created:after:2024-01-01');
    const filters = buildMetaModelFindFilters('created:after:2024-01-01', parsed, 'all');
    expect(filters.createdFrom).toBeDefined();
    expect(filters.createdTo).toBeUndefined();
  });

  it('maps before, between, and exact created date filters', () => {
    const beforeParsed = parseMetaModelSearchQuery('created:before:2024-06-01');
    const beforeFilters = buildMetaModelFindFilters('created:before:2024-06-01', beforeParsed, 'all');
    expect(beforeFilters.createdFrom).toBeUndefined();
    expect(beforeFilters.createdTo).toBeDefined();

    const betweenParsed = parseMetaModelSearchQuery('created:between:2024-01-01..2024-12-31');
    const betweenFilters = buildMetaModelFindFilters(
      'created:between:2024-01-01..2024-12-31',
      betweenParsed,
      'all',
    );
    expect(betweenFilters.createdFrom).toBeDefined();
    expect(betweenFilters.createdTo).toBeDefined();

    const exactParsed = parseMetaModelSearchQuery('created:2024-05-15');
    const exactFilters = buildMetaModelFindFilters('created:2024-05-15', exactParsed, 'all');
    expect(exactFilters.createdFrom).toBeDefined();
    expect(exactFilters.createdTo).toBeDefined();
  });

  it('maps description filters and ignores invalid created between ranges', () => {
    const parsed = parseMetaModelSearchQuery('description:notes created:between:2024-01-01');
    const filters = buildMetaModelFindFilters('description:notes created:between:2024-01-01', parsed, 'all');
    expect(filters.description).toBe('notes');
    expect(filters.createdFrom).toBeUndefined();
    expect(filters.createdTo).toBeUndefined();
  });

  it('completes filter keys on tab', () => {
    expect(completeMetaModelSearchToken('name', 4)).toEqual({
      nextValue: 'name:',
      nextCaret: 5,
    });
    expect(completeMetaModelSearchToken('dom', 3)).toEqual({
      nextValue: 'domain:',
      nextCaret: 7,
    });
  });

  it('returns null when tab completion does not match a filter key', () => {
    expect(completeMetaModelSearchToken('', 0)).toBeNull();
    expect(completeMetaModelSearchToken('xyz', 3)).toBeNull();
    expect(completeMetaModelSearchToken('name:eco', 8)).toBeNull();
  });

  it('skips empty parsed filter values', () => {
    const parsed = parseMetaModelSearchQuery('domain: keywords:');
    expect(buildMetaModelFindFilters('domain: keywords:', parsed, 'all')).toEqual({});
  });
});
