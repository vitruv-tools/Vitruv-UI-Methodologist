/** Default label placed on a node created from a palette tool. */
const TOOL_LABELS: Record<string, Record<string, string>> = {
  element: {
    'class': 'Class',
    'abstract-class': 'AbstractClass',
    'interface': 'Interface',
    'enumeration': 'Enumeration',
    'package': 'Package',
  },
  member: {
    'attribute': '+ attribute: Type',
    'method': '+ method(): ReturnType',
    'private-attribute': '- privateAttribute: Type',
    'protected-attribute': '# protectedAttribute: Type',
    'private-method': '- privateMethod(): ReturnType',
    'protected-method': '# protectedMethod(): ReturnType',
  },
  relationship: {
    'association': 'Association',
    'aggregation': 'Aggregation',
    'composition': 'Composition',
    'inheritance': 'Inheritance',
    'realization': 'Realization',
    'dependency': 'Dependency',
  },
  multiplicity: {
    'one': '1',
    'many': '*',
    'optional': '0..1',
    'range': '1..*',
  },
};

/** Falls back to the raw tool name for tools without a friendly label. */
export function getToolLabel(toolType: string, toolName: string): string {
  return TOOL_LABELS[toolType]?.[toolName] || toolName;
}
