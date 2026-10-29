import type { UtilityMethodParameter, UtilityMethodRequest, UtilityMethodResponse } from '../../services/api';

export const PRIMITIVE_TYPES = ['Boolean', 'Integer', 'Real', 'String'] as const;
export const COLLECTION_KINDS = ['Sequence', 'Set', 'OrderedSet', 'Bag'] as const;

export type CollectionKind = typeof COLLECTION_KINDS[number];

/** A type as edited in the type picker: an element type, optionally wrapped in a collection. */
export interface TypeSelection {
  collection: CollectionKind | null;
  /** A primitive (`Integer`) or metamodel type (`simulink::Block`). */
  element: string;
}

/**
 * Splits `Sequence(simulink::Block)` into collection and element type.
 * Returns `null` for types the picker cannot represent, e.g. nested collections.
 */
export function parseTypeSelection(type: string): TypeSelection | null {
  const trimmed = type.trim();
  const open = trimmed.indexOf('(');
  if (open === -1) return { collection: null, element: trimmed };
  if (!trimmed.endsWith(')')) return null;
  const kind = trimmed.slice(0, open).trim();
  const element = trimmed.slice(open + 1, -1).trim();
  if (!(COLLECTION_KINDS as readonly string[]).includes(kind) || element.includes('(')) return null;
  return { collection: kind as CollectionKind, element };
}

export function formatTypeSelection(selection: TypeSelection): string {
  if (!selection.element) return '';
  return selection.collection ? `${selection.collection}(${selection.element})` : selection.element;
}

/** `getAll(model : simulink::SimulinkModel) : Sequence(simulink::SubSystem)` */
export function formatSignature(
  utilityMethod: { name: string; parameters: UtilityMethodParameter[]; returnType: string },
): string {
  const params = utilityMethod.parameters.map(p => `${p.name} : ${p.type}`).join(', ');
  return `${utilityMethod.name || '…'}(${params}) : ${utilityMethod.returnType || '…'}`;
}

/** Removes the indentation all non-empty lines share, e.g. of a method inside its class. */
export function dedent(code: string): string {
  const lines = code.split('\n');
  const indents = lines.filter(line => line.trim()).map(line => /^ */.exec(line)?.[0].length ?? 0);
  const common = indents.length > 0 ? Math.min(...indents) : 0;
  return lines.map(line => line.slice(Math.min(common, line.length - line.trimStart().length))).join('\n');
}

/** A parameter as edited, with a stable `key` for React lists that survives removals. */
export interface DraftParameter extends UtilityMethodParameter {
  key: number;
}

let lastParameterKey = 0;

export function newDraftParameter(parameter: UtilityMethodParameter): DraftParameter {
  lastParameterKey += 1;
  return { ...parameter, key: lastParameterKey };
}

/** The editable state of a utility method. */
export interface UtilityMethodDraft {
  name: string;
  description: string;
  returnType: string;
  parameters: DraftParameter[];
  imports: string[];
  body: string;
}

export const EMPTY_DRAFT: UtilityMethodDraft = {
  name: '',
  description: '',
  returnType: 'Boolean',
  parameters: [],
  imports: [],
  body: '',
};

export function draftFromUtilityMethod(utilityMethod: UtilityMethodResponse): UtilityMethodDraft {
  return {
    name: utilityMethod.name,
    description: utilityMethod.description ?? '',
    returnType: utilityMethod.returnType,
    parameters: utilityMethod.parameters.map(newDraftParameter),
    imports: [...utilityMethod.imports],
    body: utilityMethod.body,
  };
}

export function requestFromDraft(draft: UtilityMethodDraft): UtilityMethodRequest {
  return {
    name: draft.name.trim(),
    description: draft.description.trim() || undefined,
    returnType: draft.returnType.trim(),
    parameters: draft.parameters.map(p => ({ name: p.name.trim(), type: p.type.trim() })),
    imports: draft.imports,
    body: draft.body,
  };
}

/** Why the draft cannot be saved yet, or `null` if all required fields are filled. */
export function missingField(draft: UtilityMethodDraft): string | null {
  if (!draft.name.trim()) return 'Enter a name.';
  if (!draft.returnType.trim()) return 'Choose a return type.';
  if (draft.parameters.some(p => !p.name.trim() || !p.type.trim())) {
    return 'Every parameter needs a name and a type.';
  }
  if (!draft.body.trim()) return 'Enter the OCL definition.';
  return null;
}

/**
 * The OCL call of another utility method, e.g. `getAll(model)`, or `getAll()` when written as an
 * operation of its first argument (`model.getAll()`).
 */
export function utilityMethodCall(utilityMethod: { name: string; parameters: UtilityMethodParameter[] }, onFirstArgument = false): string {
  const params = utilityMethod.parameters.slice(onFirstArgument ? 1 : 0).map(p => p.name);
  return `${utilityMethod.name}(${params.join(', ')})`;
}

/** Like {@link utilityMethodCall}, as a Monaco snippet whose arguments are tab stops. */
export function utilityMethodCallSnippet(utilityMethod: { name: string; parameters: UtilityMethodParameter[] }, onFirstArgument = false): string {
  const params = utilityMethod.parameters.slice(onFirstArgument ? 1 : 0)
    .map((p, i) => `\${${i + 1}:${p.name.replace(/[$}\\]/g, String.raw`\$&`)}}`);
  return `${utilityMethod.name}(${params.join(', ')})`;
}

const THIS_MODULE = 'thisModule';

/**
 * How a utility method call can be written at the end of `textBefore`:
 * - `'plain'`: as `utility method(args)`, also after `thisModule.`
 * - `'operation'`: after `x.`, as `x.utility method(remaining args)`
 * - `null`: not at all, e.g. after `->`, which only takes collection operations
 */
export function utilityMethodCallContext(textBefore: string): 'plain' | 'operation' | null {
  const prefix = textBefore.replace(/[\p{L}\p{N}_]*$/u, '').trimEnd();
  if (prefix.endsWith('->')) return null;
  if (!prefix.endsWith('.')) return 'plain';
  const receiver = prefix.slice(0, -1).trimEnd();
  if (!receiver.endsWith(THIS_MODULE)) return 'operation';
  const beforeReceiver = receiver.slice(0, -THIS_MODULE.length);
  return /[\p{L}\p{N}_.]$/u.test(beforeReceiver) ? 'operation' : 'plain';
}
