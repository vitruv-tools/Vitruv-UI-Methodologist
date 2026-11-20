import * as Y from 'yjs';
import {
  LAYOUT,
  LAYOUT_META_MODELS,
  LAYOUT_REACTIONS,
  MODELS,
  RELATIONS,
  type ModelFields,
  type Position,
  type RelationFields,
} from './document';

/** A metamodel of the project as the document has it. */
export interface ModelState {
  /** Library ID of the metamodel. */
  sourceId: number;
  name: string;
  /** Position on the canvas; `null` if the document has none. */
  position: Position | null;
}

/** A relation between two metamodels as the document has it. */
export interface RelationState {
  /** Key of the relation in the document. */
  key: string;
  sourceId: number;
  targetId: number;
  reactionFileId: number | null;
  fineGranular: Record<string, unknown>[];
}

/**
 * What the document says about a project, without what is soft-deleted: the metamodels and the
 * relations between them. There is one relation per pair of metamodels, as in the backend.
 */
export interface ProjectState {
  models: Map<number, ModelState>;
  /** Keyed by {@link pairKey}. */
  relations: Map<string, RelationState>;
  /** Layout of the reaction editor, keyed by what the editor uses; the document doesn't interpret it. */
  reactionLayout: Record<string, unknown>;
}

/** What changed between two states, to be applied to the canvas. */
export interface ProjectChanges {
  addedModels: ModelState[];
  removedModels: number[];
  renamedModels: { sourceId: number; name: string }[];
  movedModels: { sourceId: number; position: Position }[];
  /** Relations that are new or whose reaction file or mappings changed. */
  upsertedRelations: RelationState[];
  removedRelations: { sourceId: number; targetId: number }[];
  /** The new reaction layout if it changed, otherwise `undefined`. */
  reactionLayout: Record<string, unknown> | undefined;
}

/** The key of the relation from one metamodel to another. */
export function pairKey(sourceId: number, targetId: number): string {
  return `${sourceId}->${targetId}`;
}

export function hasChanges(changes: ProjectChanges): boolean {
  return (
    changes.addedModels.length > 0 ||
    changes.removedModels.length > 0 ||
    changes.renamedModels.length > 0 ||
    changes.movedModels.length > 0 ||
    changes.upsertedRelations.length > 0 ||
    changes.removedRelations.length > 0 ||
    changes.reactionLayout !== undefined
  );
}

/**
 * Reads the project from the document. Elements that are soft-deleted or can't be read are left
 * out, and so are relations to a metamodel that isn't live. Reading never changes the document.
 */
export function readProjectState(doc: Y.Doc): ProjectState {
  const layout = doc.getMap(LAYOUT);
  const positions = layout.get(LAYOUT_META_MODELS);

  const models = new Map<number, ModelState>();
  for (const [key, element] of sortedEntries(doc.getMap(MODELS))) {
    const sourceId = parseModelKey(key);
    if (sourceId === null || !(element instanceof Y.Map) || isDeleted(element)) {
      continue;
    }
    const name = field<ModelFields>(element, 'name');
    models.set(sourceId, {
      sourceId,
      name: typeof name === 'string' ? name : '',
      position: positions instanceof Y.Map ? toPosition(positions.get(key)) : null,
    });
  }

  const candidates = new Map<string, (RelationState & { backendId: number | null })[]>();
  for (const [key, element] of sortedEntries(doc.getMap(RELATIONS))) {
    if (!(element instanceof Y.Map) || isDeleted(element)) {
      continue;
    }
    const sourceId = field<RelationFields>(element, 'sourceId');
    const targetId = field<RelationFields>(element, 'targetId');
    if (!isId(sourceId) || !isId(targetId) || !models.has(sourceId) || !models.has(targetId)) {
      continue;
    }
    const reactionFileId = field<RelationFields>(element, 'reactionFileId');
    const fineGranular = field<RelationFields>(element, 'fineGranular');
    const backendId = field<RelationFields>(element, 'backendId');
    const pair = pairKey(sourceId, targetId);
    const list = candidates.get(pair) ?? [];
    list.push({
      key,
      sourceId,
      targetId,
      backendId: isId(backendId) ? backendId : null,
      reactionFileId: isId(reactionFileId) ? reactionFileId : null,
      fineGranular: Array.isArray(fineGranular) ? fineGranular.filter(isObject) : [],
    });
    candidates.set(pair, list);
  }
  const relations = new Map<string, RelationState>();
  for (const [pair, list] of candidates) {
    // Entries are in the order of their keys. The same pick as the server's writeback: the relation
    // the backend has, then one that is configured, then the smallest key.
    const chosen =
      list.find((relation) => relation.backendId !== null) ??
      list.find((relation) => relation.reactionFileId !== null || relation.fineGranular.length > 0) ??
      list[0];
    const { backendId: _backendId, ...state } = chosen;
    relations.set(pair, state);
  }

  const reactions = layout.get(LAYOUT_REACTIONS);
  return {
    models,
    relations,
    reactionLayout: reactions instanceof Y.Map ? (reactions.toJSON() as Record<string, unknown>) : {},
  };
}

/**
 * What changed from `previous` to `next`. With `compareMappings: false`, a relation only counts as
 * changed if it is new or its reaction file changed, not its fine-granular mappings.
 */
export function diffProjectState(
  previous: ProjectState,
  next: ProjectState,
  { compareMappings = true }: { compareMappings?: boolean } = {},
): ProjectChanges {
  const changes: ProjectChanges = {
    addedModels: [],
    removedModels: [],
    renamedModels: [],
    movedModels: [],
    upsertedRelations: [],
    removedRelations: [],
    reactionLayout: undefined,
  };

  for (const model of next.models.values()) {
    const before = previous.models.get(model.sourceId);
    if (before === undefined) {
      changes.addedModels.push(model);
      continue;
    }
    if (before.name !== model.name) {
      changes.renamedModels.push({ sourceId: model.sourceId, name: model.name });
    }
    if (model.position !== null && !isSamePosition(before.position, model.position)) {
      changes.movedModels.push({ sourceId: model.sourceId, position: model.position });
    }
  }
  for (const sourceId of previous.models.keys()) {
    if (!next.models.has(sourceId)) {
      changes.removedModels.push(sourceId);
    }
  }

  for (const [pair, relation] of next.relations) {
    const before = previous.relations.get(pair);
    if (
      before === undefined ||
      before.reactionFileId !== relation.reactionFileId ||
      (compareMappings && canonicalJson(before.fineGranular) !== canonicalJson(relation.fineGranular))
    ) {
      changes.upsertedRelations.push(relation);
    }
  }
  for (const [pair, relation] of previous.relations) {
    if (!next.relations.has(pair)) {
      changes.removedRelations.push({ sourceId: relation.sourceId, targetId: relation.targetId });
    }
  }

  if (canonicalJson(previous.reactionLayout) !== canonicalJson(next.reactionLayout)) {
    changes.reactionLayout = next.reactionLayout;
  }
  return changes;
}

function isDeleted(element: Y.Map<unknown>): boolean {
  return field<ModelFields>(element, 'softDeleted') === true;
}

/** Reads a field of an element. The key must be a field of `T`, so renaming a field is noticed. */
function field<T>(element: Y.Map<unknown>, key: keyof T & string): unknown {
  return element.get(key);
}

/** The ID in a key of `models`, or `null` if the key isn't a canonical decimal ID. */
function parseModelKey(key: string): number | null {
  return /^[1-9]\d{0,14}$/.test(key) ? Number(key) : null;
}

function isId(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toPosition(value: unknown): Position | null {
  if (!isObject(value) || !isFiniteNumber(value.x) || !isFiniteNumber(value.y)) {
    return null;
  }
  return { x: value.x, y: value.y };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isSamePosition(a: Position | null, b: Position | null): boolean {
  return a === b || (a !== null && b !== null && a.x === b.x && a.y === b.y);
}

function sortedEntries(map: Y.Map<unknown>): [string, unknown][] {
  return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/** JSON text of a value that doesn't depend on the order of object keys. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (isObject(value)) {
    const keys = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}
