import {
  EMPTY_DRAFT,
  dedent,
  formatSignature,
  formatTypeSelection,
  utilityMethodCall,
  utilityMethodCallContext,
  utilityMethodCallSnippet,
  missingField,
  parseTypeSelection,
  requestFromDraft,
} from '../../../components/utilitymethods/utilityMethodUtils';

describe('utilityMethodUtils', () => {
  it('splits collection types into kind and element, and formats them back', () => {
    expect(parseTypeSelection('Sequence(simulink::Block)')).toEqual({ collection: 'Sequence', element: 'simulink::Block' });
    expect(parseTypeSelection(' Integer ')).toEqual({ collection: null, element: 'Integer' });
    expect(parseTypeSelection('Sequence(Set(Integer))')).toBeNull();
    expect(parseTypeSelection('Tuple(a)')).toBeNull();
    expect(formatTypeSelection({ collection: 'Set', element: 'String' })).toBe('Set(String)');
    expect(formatTypeSelection({ collection: null, element: 'simulink::Block' })).toBe('simulink::Block');
  });

  it('formats signatures in OCL style', () => {
    expect(formatSignature({
      name: 'getAll',
      parameters: [{ name: 'model', type: 'simulink::SimulinkModel' }],
      returnType: 'Sequence(simulink::SubSystem)',
    })).toBe('getAll(model : simulink::SimulinkModel) : Sequence(simulink::SubSystem)');
  });

  it('reports the first missing field', () => {
    expect(missingField(EMPTY_DRAFT)).toBe('Enter a name.');
    expect(missingField({ ...EMPTY_DRAFT, name: 'x', parameters: [{ name: '', type: 'Integer' }] }))
      .toBe('Every parameter needs a name and a type.');
    expect(missingField({ ...EMPTY_DRAFT, name: 'x', body: 'true' })).toBeNull();
  });

  it('trims the request and leaves out an empty description', () => {
    expect(requestFromDraft({
      ...EMPTY_DRAFT,
      name: ' answer ',
      description: '  ',
      parameters: [{ name: ' n ', type: ' Integer ' }],
      body: 'n + 1',
    })).toEqual({
      name: 'answer',
      description: undefined,
      returnType: 'Boolean',
      parameters: [{ name: 'n', type: 'Integer' }],
      imports: [],
      body: 'n + 1',
    });
  });

  it('removes the indentation shared by all lines', () => {
    expect(dedent('  void a() {\n\n    return;\n  }\n')).toBe('void a() {\n\n  return;\n}\n');
  });

  it('writes calls of other utility methods', () => {
    const utilityMethod = { name: 'pair', parameters: [{ name: 'a', type: 'Integer' }, { name: 'b$', type: 'Integer' }] };
    expect(utilityMethodCall(utilityMethod)).toBe('pair(a, b$)');
    expect(utilityMethodCall(utilityMethod, true)).toBe('pair(b$)');
    // eslint-disable-next-line no-template-curly-in-string -- Monaco snippet syntax
    expect(utilityMethodCallSnippet(utilityMethod)).toBe('pair(${1:a}, ${2:b\\$})');
    expect(utilityMethodCallSnippet({ name: 'none', parameters: [] })).toBe('none()');
  });

  it('knows where a utility method call can be written', () => {
    expect(utilityMethodCallContext('let x = get')).toBe('plain');
    expect(utilityMethodCallContext('thisModule.get')).toBe('plain');
    expect(utilityMethodCallContext('model.')).toBe('operation');
    expect(utilityMethodCallContext('model.contains->')).toBeNull();
    expect(utilityMethodCallContext('model.contains->sel')).toBeNull();
  });
});
