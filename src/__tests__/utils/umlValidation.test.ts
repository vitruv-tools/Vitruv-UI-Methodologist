import { validateUmlModel } from '../../utils/umlValidation';

describe('validateUmlModel', () => {
  it('warns on duplicate class names', () => {
    const issues = validateUmlModel({
      classes: [
        { id: 'A', name: 'Foo', isAbstract: false, isInterface: false, attributes: [], operations: [], x: 0, y: 0 },
        { id: 'B', name: 'foo', isAbstract: false, isInterface: false, attributes: [], operations: [], x: 0, y: 0 },
      ],
      relationships: [],
    });
    expect(issues.some(i => i.message.includes('Duplicate class name'))).toBe(true);
  });

  it('errors on self-referential connections', () => {
    const issues = validateUmlModel({
      classes: [
        { id: 'A', name: 'A', isAbstract: false, isInterface: false, attributes: [], operations: [], x: 0, y: 0 },
      ],
      relationships: [{ id: 'r1', sourceId: 'A', targetId: 'A', type: 'association' }],
    });
    expect(issues.some(i => i.severity === 'error')).toBe(true);
  });
});
