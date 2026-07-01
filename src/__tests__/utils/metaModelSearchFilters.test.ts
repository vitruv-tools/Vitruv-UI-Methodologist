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

  it('uses plain search text as a name filter when no key:value syntax is present', () => {
    expect(buildMetaModelFindFilters('MyModel', [], 'all')).toEqual({
      ownedByUser: false,
      name: 'MyModel',
    });
  });

  it('maps parsed filters to backend find-all fields', () => {
    const parsed = parseMetaModelSearchQuery('name:eco domain:Testing keywords:foo,bar');
    expect(buildMetaModelFindFilters('name:eco domain:Testing keywords:foo,bar', parsed, 'all')).toEqual({
      ownedByUser: false,
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
});
