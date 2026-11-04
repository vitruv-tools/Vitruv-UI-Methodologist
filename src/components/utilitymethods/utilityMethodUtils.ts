import type { UtilityMethodParameter, UtilityMethodRequest, UtilityMethodResponse } from '../../services/api';

export const PRIMITIVE_TYPES = ['String', 'boolean', 'int', 'long', 'double'] as const;
export const COLLECTION_KINDS = ['List', 'Set', 'Iterable'] as const;

export type CollectionKind = typeof COLLECTION_KINDS[number];

/** A type as edited in the type picker: an element type, optionally wrapped in a collection. */
export interface TypeSelection {
  collection: CollectionKind | null;
  /** A value type (`int`) or a metamodel type by simple or qualified Java name (`SubSystem`). */
  element: string;
}

/**
 * Splits `List<SubSystem>` into collection and element type.
 * Returns `null` for types the picker cannot represent, e.g. nested generics or arrays.
 */
export function parseTypeSelection(type: string): TypeSelection | null {
  const trimmed = type.trim();
  const open = trimmed.indexOf('<');
  if (open === -1) return trimmed.includes('[') ? null : { collection: null, element: trimmed };
  if (!trimmed.endsWith('>')) return null;
  const kind = trimmed.slice(0, open).trim();
  const element = trimmed.slice(open + 1, -1).trim();
  if (!(COLLECTION_KINDS as readonly string[]).includes(kind) || /[<>,[]/.test(element)) return null;
  return { collection: kind as CollectionKind, element };
}

export function formatTypeSelection(selection: TypeSelection): string {
  if (!selection.element) return '';
  return selection.collection ? `${selection.collection}<${boxed(selection.element)}>` : selection.element;
}

/** Collections cannot hold primitive values in Java, so `List<int>` becomes `List<Integer>`. */
function boxed(type: string): string {
  const boxes: Record<string, string> = { boolean: 'Boolean', int: 'Integer', long: 'Long', double: 'Double' };
  return boxes[type] ?? type;
}

/** The simple name of a qualified Java name, e.g. `SubSystem` for `a.b.SubSystem`. */
export function simpleName(javaName: string): string {
  return javaName.slice(javaName.lastIndexOf('.') + 1);
}

/** The package of a qualified Java name, e.g. `a.b` for `a.b.SubSystem`. */
export function packageName(javaName: string): string {
  const dot = javaName.lastIndexOf('.');
  return dot === -1 ? '' : javaName.slice(0, dot);
}

/** Whether `imports` already make the type available by its simple name. */
export function isImported(javaName: string, imports: readonly string[]): boolean {
  return imports.some(entry => {
    const trimmed = entry.trim();
    return trimmed === javaName || trimmed === `${packageName(javaName)}.*`;
  });
}

/** `getAll(SimulinkModel model) : List<SubSystem>` */
export function formatSignature(
  utilityMethod: { name: string; parameters: UtilityMethodParameter[]; returnType: string },
): string {
  const params = utilityMethod.parameters.map(p => `${p.type} ${p.name}`).join(', ');
  return `${utilityMethod.name || '…'}(${params}) : ${utilityMethod.returnType || '…'}`;
}

/** `def static List<SubSystem> getAll(SimulinkModel model)`, the header the body belongs to. */
export function formatXtendHeader(
  utilityMethod: { name: string; parameters: UtilityMethodParameter[]; returnType: string },
): string {
  const params = utilityMethod.parameters.map(p => `${p.type || '…'} ${p.name || '…'}`).join(', ');
  return `def static ${utilityMethod.returnType || '…'} ${utilityMethod.name || '…'}(${params})`;
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
  returnType: 'boolean',
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
  if (!draft.body.trim()) return 'Enter the Xtend body.';
  return null;
}

/**
 * The call of another utility method, e.g. `getAll(model)`. Utility methods are static methods of
 * the same class, so they call each other by name.
 */
export function utilityMethodCall(utilityMethod: { name: string; parameters: UtilityMethodParameter[] }): string {
  return `${utilityMethod.name}(${utilityMethod.parameters.map(p => p.name).join(', ')})`;
}

/** Escapes the characters that have a meaning in Monaco snippet placeholder text. */
function escapeSnippetText(text: string): string {
  return text.replace(/[$}\\]/g, String.raw`\$&`);
}

/** Like {@link utilityMethodCall}, as a Monaco snippet whose arguments are tab stops. */
export function utilityMethodCallSnippet(utilityMethod: { name: string; parameters: UtilityMethodParameter[] }): string {
  const params = utilityMethod.parameters
    .map((p, i) => `\${${i + 1}:${escapeSnippetText(p.name)}}`);
  return `${utilityMethod.name}(${params.join(', ')})`;
}

const UTILITY_CLASS = 'Utility';
const NAME_CHAR = /^[\p{L}\p{N}_]$/u;

/** `text` without the (partial) name at its end. A loop, because `/[…]*$/` backtracks. */
function withoutTrailingName(text: string): string {
  const chars = Array.from(text);
  while (chars.length > 0 && NAME_CHAR.test(chars.at(-1) ?? '')) chars.pop();
  return chars.join('');
}

/**
 * Whether a utility method call can be written at the end of `textBefore`: anywhere a name can
 * start, and after `Utility.`, but not after another receiver such as `model.`.
 */
export function canCallUtilityMethodAt(textBefore: string): boolean {
  const prefix = withoutTrailingName(textBefore).trimEnd();
  if (!prefix.endsWith('.')) return true;
  const receiver = prefix.slice(0, -1).trimEnd();
  if (!receiver.endsWith(UTILITY_CLASS)) return false;
  const beforeReceiver = receiver.slice(0, -UTILITY_CLASS.length);
  return !/[\p{L}\p{N}_.]$/u.test(beforeReceiver);
}
