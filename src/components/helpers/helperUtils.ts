import type { HelperParameter, HelperRequest, HelperResponse } from '../../services/api';

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
  const match = /^(\w+)\s*\(\s*(.*?)\s*\)$/.exec(trimmed);
  if (match) {
    const [, kind, element] = match;
    if (!(COLLECTION_KINDS as readonly string[]).includes(kind) || element.includes('(')) return null;
    return { collection: kind as CollectionKind, element };
  }
  if (trimmed.includes('(')) return null;
  return { collection: null, element: trimmed };
}

export function formatTypeSelection(selection: TypeSelection): string {
  if (!selection.element) return '';
  return selection.collection ? `${selection.collection}(${selection.element})` : selection.element;
}

/** `getAll(model : simulink::SimulinkModel) : Sequence(simulink::SubSystem)` */
export function formatSignature(
  helper: { name: string; parameters: HelperParameter[]; returnType: string },
): string {
  const params = helper.parameters.map(p => `${p.name} : ${p.type}`).join(', ');
  return `${helper.name || '…'}(${params}) : ${helper.returnType || '…'}`;
}

/** Removes the indentation all non-empty lines share, e.g. of a method inside its class. */
export function dedent(code: string): string {
  const lines = code.split('\n');
  const indents = lines.filter(line => line.trim()).map(line => /^ */.exec(line)?.[0].length ?? 0);
  const common = indents.length > 0 ? Math.min(...indents) : 0;
  return lines.map(line => line.slice(Math.min(common, line.length - line.trimStart().length))).join('\n');
}

/** The editable state of a helper. */
export interface HelperDraft {
  name: string;
  description: string;
  returnType: string;
  parameters: HelperParameter[];
  imports: string[];
  body: string;
}

export const EMPTY_DRAFT: HelperDraft = {
  name: '',
  description: '',
  returnType: 'Boolean',
  parameters: [],
  imports: [],
  body: '',
};

export function draftFromHelper(helper: HelperResponse): HelperDraft {
  return {
    name: helper.name,
    description: helper.description ?? '',
    returnType: helper.returnType,
    parameters: helper.parameters.map(p => ({ ...p })),
    imports: [...helper.imports],
    body: helper.body,
  };
}

export function requestFromDraft(draft: HelperDraft): HelperRequest {
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
export function missingField(draft: HelperDraft): string | null {
  if (!draft.name.trim()) return 'Enter a name.';
  if (!draft.returnType.trim()) return 'Choose a return type.';
  if (draft.parameters.some(p => !p.name.trim() || !p.type.trim())) {
    return 'Every parameter needs a name and a type.';
  }
  if (!draft.body.trim()) return 'Enter the OCL definition.';
  return null;
}

/**
 * The OCL call of another helper, e.g. `getAll(model)`, or `getAll()` when written as an
 * operation of its first argument (`model.getAll()`).
 */
export function helperCall(helper: { name: string; parameters: HelperParameter[] }, onFirstArgument = false): string {
  const params = helper.parameters.slice(onFirstArgument ? 1 : 0).map(p => p.name);
  return `${helper.name}(${params.join(', ')})`;
}

/** Like {@link helperCall}, as a Monaco snippet whose arguments are tab stops. */
export function helperCallSnippet(helper: { name: string; parameters: HelperParameter[] }, onFirstArgument = false): string {
  const params = helper.parameters.slice(onFirstArgument ? 1 : 0)
    .map((p, i) => `\${${i + 1}:${p.name.replace(/[$}\\]/g, '\\$&')}}`);
  return `${helper.name}(${params.join(', ')})`;
}

/**
 * How a helper call can be written at the end of `textBefore`:
 * - `'plain'`: as `helper(args)`, also after `thisModule.`
 * - `'operation'`: after `x.`, as `x.helper(remaining args)`
 * - `null`: not at all, e.g. after `->`, which only takes collection operations
 */
export function helperCallContext(textBefore: string): 'plain' | 'operation' | null {
  const prefix = textBefore.replace(/[\p{L}\p{N}_]*$/u, '');
  if (/->\s*$/.test(prefix)) return null;
  if (/\.\s*$/.test(prefix)) {
    return /(?:^|[^\p{L}\p{N}_.])thisModule\s*\.\s*$/u.test(prefix) ? 'plain' : 'operation';
  }
  return 'plain';
}
