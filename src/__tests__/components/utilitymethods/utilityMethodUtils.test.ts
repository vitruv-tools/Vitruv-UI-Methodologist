import {
  EMPTY_DRAFT,
  canCallUtilityMethodAt,
  dedent,
  formatSignature,
  formatTypeSelection,
  formatXtendHeader,
  isImported,
  packageName,
  simpleName,
  utilityMethodCall,
  utilityMethodCallSnippet,
  missingField,
  parseTypeSelection,
  requestFromDraft,
} from '../../../components/utilitymethods/utilityMethodUtils';

describe('utilityMethodUtils', () => {
  it('splits collection types into kind and element, and formats them back', () => {
    expect(parseTypeSelection('List<SubSystem>')).toEqual({ collection: 'List', element: 'SubSystem' });
    expect(parseTypeSelection(' int ')).toEqual({ collection: null, element: 'int' });
    expect(parseTypeSelection('List<Set<String>>')).toBeNull();
    expect(parseTypeSelection('Map<String, Block>')).toBeNull();
    expect(parseTypeSelection('Optional<String>')).toBeNull();
    expect(parseTypeSelection(' Set < String > ')).toEqual({ collection: 'Set', element: 'String' });
    expect(parseTypeSelection('List<String')).toBeNull();
    expect(parseTypeSelection('int[]')).toBeNull();
    expect(formatTypeSelection({ collection: 'Set', element: 'String' })).toBe('Set<String>');
    expect(formatTypeSelection({ collection: 'List', element: 'int' })).toBe('List<Integer>');
    expect(formatTypeSelection({ collection: null, element: 'a.b.Block' })).toBe('a.b.Block');
  });

  it('formats signatures and the Xtend header', () => {
    const utilityMethod = {
      name: 'getAll',
      parameters: [{ name: 'model', type: 'SimulinkModel' }],
      returnType: 'List<SubSystem>',
    };
    expect(formatSignature(utilityMethod)).toBe('getAll(SimulinkModel model) : List<SubSystem>');
    expect(formatXtendHeader(utilityMethod)).toBe('def static List<SubSystem> getAll(SimulinkModel model)');
    expect(formatXtendHeader({ name: '', parameters: [], returnType: '' })).toBe('def static … …()');
  });

  it('knows Java names and whether imports cover them', () => {
    expect(simpleName('a.b.SubSystem')).toBe('SubSystem');
    expect(packageName('a.b.SubSystem')).toBe('a.b');
    expect(isImported('a.b.SubSystem', ['a.b.*'])).toBe(true);
    expect(isImported('a.b.SubSystem', [' a.b.SubSystem '])).toBe(true);
    expect(isImported('a.b.SubSystem', ['a.c.*', 'a.b.Other'])).toBe(false);
  });

  it('reports the first missing field', () => {
    expect(missingField(EMPTY_DRAFT)).toBe('Enter a name.');
    expect(missingField({ ...EMPTY_DRAFT, name: 'x', parameters: [{ name: '', type: 'int', key: 1 }] }))
      .toBe('Every parameter needs a name and a type.');
    expect(missingField({ ...EMPTY_DRAFT, name: 'x', body: 'true' })).toBeNull();
  });

  it('trims the request and leaves out an empty description', () => {
    expect(requestFromDraft({
      ...EMPTY_DRAFT,
      name: ' answer ',
      description: '  ',
      parameters: [{ name: ' n ', type: ' int ', key: 1 }],
      body: 'n + 1',
    })).toEqual({
      name: 'answer',
      description: undefined,
      returnType: 'boolean',
      parameters: [{ name: 'n', type: 'int' }],
      imports: [],
      body: 'n + 1',
    });
  });

  it('removes the indentation shared by all lines', () => {
    expect(dedent('  void a() {\n\n    return;\n  }\n')).toBe('void a() {\n\n  return;\n}\n');
  });

  it('writes calls of other utility methods', () => {
    const utilityMethod = { name: 'pair', parameters: [{ name: 'a', type: 'int' }, { name: 'b$', type: 'int' }] };
    expect(utilityMethodCall(utilityMethod)).toBe('pair(a, b$)');
    // eslint-disable-next-line no-template-curly-in-string -- Monaco snippet syntax
    expect(utilityMethodCallSnippet(utilityMethod)).toBe('pair(${1:a}, ${2:b\\$})');
    expect(utilityMethodCallSnippet({ name: 'none', parameters: [] })).toBe('none()');
  });

  it('knows where a utility method call can be written', () => {
    expect(canCallUtilityMethodAt('val x = get')).toBe(true);
    expect(canCallUtilityMethodAt('Utility.get')).toBe(true);
    expect(canCallUtilityMethodAt('Utility . get')).toBe(true);
    expect(canCallUtilityMethodAt('x + Utility.')).toBe(true);
    expect(canCallUtilityMethodAt('model.')).toBe(false);
    expect(canCallUtilityMethodAt('model.contains.fil')).toBe(false);
    expect(canCallUtilityMethodAt('MyUtility.')).toBe(false);
    expect(canCallUtilityMethodAt('a.Utility.')).toBe(false);
    expect(canCallUtilityMethodAt('model.größe')).toBe(false);
    expect(canCallUtilityMethodAt('Utility.𝑥_1')).toBe(true);
    expect(canCallUtilityMethodAt('')).toBe(true);
  });
});
