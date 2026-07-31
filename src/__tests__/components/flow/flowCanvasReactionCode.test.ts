import { Node } from 'reactflow';
import { buildInitialReactionCode } from '../../../components/flow/flowCanvasReactionCode';
import { getToolLabel } from '../../../components/flow/flowCanvasToolLabels';

const ecore = (id: string, data: Record<string, unknown>): Node =>
  ({ id, position: { x: 0, y: 0 }, data, type: 'ecoreFile' } as Node);

describe('buildInitialReactionCode', () => {
  it('uses the EPackage name declared in the ecore content', () => {
    const nodes = [
      ecore('a', { fileContent: '<ecore:EPackage xmi:version="2.0" name="Families"', nsUri: 'http://families' }),
      ecore('b', { fileContent: '<ecore:EPackage xmi:version="2.0" name="Persons"', nsUri: 'http://persons' }),
    ];

    const code = buildInitialReactionCode(nodes, 'a', 'b');

    expect(code).toContain('import "http://families" as Families');
    expect(code).toContain('import "http://persons" as Persons');
    expect(code).toContain('reactions: FamiliesToPersons');
    expect(code).toContain('in reaction to changes in Families');
    expect(code).toContain('execute actions in Persons');
  });

  it('falls back to the file name without its extension', () => {
    const nodes = [
      ecore('a', { fileName: 'Families.ecore' }),
      ecore('b', { fileName: 'Persons.ecore' }),
    ];

    expect(buildInitialReactionCode(nodes, 'a', 'b')).toContain('reactions: FamiliesToPersons');
  });

  it('synthesises a namespace URI when the node has none', () => {
    const nodes = [ecore('a', { fileName: 'Families.ecore' }), ecore('b', { fileName: 'Persons.ecore' })];

    expect(buildInitialReactionCode(nodes, 'a', 'b')).toContain('import "http://vitruv.tools/Families"');
  });

  it('falls back to a placeholder name for unknown nodes', () => {
    expect(buildInitialReactionCode([], 'ghost', 'phantom')).toContain('reactions: sourceTosource');
  });
});

describe('getToolLabel', () => {
  it('maps a known tool to its display label', () => {
    expect(getToolLabel('element', 'abstract-class')).toBe('AbstractClass');
    expect(getToolLabel('member', 'attribute')).toBe('+ attribute: Type');
    expect(getToolLabel('multiplicity', 'range')).toBe('1..*');
  });

  it('falls back to the raw name for an unknown tool or category', () => {
    expect(getToolLabel('element', 'unknown-tool')).toBe('unknown-tool');
    expect(getToolLabel('unknown-category', 'thing')).toBe('thing');
  });
});
