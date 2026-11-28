import * as Y from 'yjs';
import {
  LAYOUT,
  LAYOUT_META_MODELS,
  LAYOUT_REACTIONS,
  LAYOUT_VSUM_CIRCLE,
  MODELS,
  RELATIONS,
  type CopyFields,
  type ModelFields,
  type Position,
  type RelationFields,
  type VsumCircle,
} from './document';

/** A metamodel of the project as the document has it. */
export interface ModelState {
  /** Library ID of the metamodel. */
  sourceId: number;
  name: string;
  /** Position on the canvas; `null` if the document has none. */
  position: Position | null;
  /**
   * The project's copy of the metamodel, whose files every member may read. Missing until the
   * server saved a new metamodel, and on the canvas, which doesn't know it.
   */
  copy?: ModelCopy;
}

/** IDs of the project's copy of a metamodel; it always has an ecore file. */
export type ModelCopy = CopyFields & { ecoreFileId: number };

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
  /** The shared VSUM circle; `null` if the document has none (yet). */
  vsumCircle: VsumCircle | null;
}

/** What changed between two states, to be applied to the canvas. */
export interface ProjectChanges {
  addedModels: ModelState[];
  removedModels: number[];
  renamedModels: { sourceId: number; name: string }[];
  movedModels: { sourceId: number; position: Position }[];
  /**
   * Metamodels whose copy got new files, e.g. once the server saved a metamodel another user added.
   * Not when a copy is removed.
   */
  copiedModels: ModelState[];
  /** Relations that are new or whose reaction file or mappings changed. */
  upsertedRelations: RelationState[];
  removedRelations: { sourceId: number; targetId: number }[];
  /** The new reaction layout if it changed, otherwise `undefined`. */
  reactionLayout: Record<string, unknown> | undefined;
  /** The new VSUM circle if it changed, otherwise `undefined`. A circle that is removed isn't a change. */
  vsumCircle: VsumCircle | undefined;
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
    changes.copiedModels.length > 0 ||
    changes.upsertedRelations.length > 0 ||
    changes.removedRelations.length > 0 ||
    changes.reactionLayout !== undefined ||
    changes.vsumCircle !== undefined
  );
}

/**
 * Reads the project from the document. Elements that are soft-deleted or can't be read are left
 * out, and so are relations to a metamodel that isn't live. Reading never changes the document.
 */
export function readProjectState(doc: Y.Doc): ProjectState {
  const layout = doc.getMap(LAYOUT);
  const models = readModels(doc, layout.get(LAYOUT_META_MODELS));
  const reactions = layout.get(LAYOUT_REACTIONS);
  return {
    models,
    relations: readRelations(doc, models),
    reactionLayout: reactions instanceof Y.Map ? (reactions.toJSON() as Record<string, unknown>) : {},
    vsumCircle: toVsumCircle(layout.get(LAYOUT_VSUM_CIRCLE)),
  };
}

function readModels(doc: Y.Doc, positions: unknown): Map<number, ModelState> {
  const models = new Map<number, ModelState>();
  for (const [key, element] of sortedEntries(doc.getMap(MODELS))) {
    const sourceId = parseModelKey(key);
    if (sourceId === null || !(element instanceof Y.Map) || isDeleted(element)) {
      continue;
    }
    const name = field<ModelFields>(element, 'name');
    const copy = readCopy(element);
    models.set(sourceId, {
      sourceId,
      name: typeof name === 'string' ? name : '',
      position: positions instanceof Y.Map ? toPosition(positions.get(key)) : null,
      ...(copy === undefined ? {} : { copy }),
    });
  }
  return models;
}

/** The project's copy of a metamodel, or `undefined` if it has no ecore file (yet). */
function readCopy(element: Y.Map<unknown>): ModelCopy | undefined {
  const ecoreFileId = field<ModelFields>(element, 'ecoreFileId');
  if (!isId(ecoreFileId)) {
    return undefined;
  }
  const projectMetaModelId = field<ModelFields>(element, 'projectMetaModelId');
  const genModelFileId = field<ModelFields>(element, 'genModelFileId');
  return {
    projectMetaModelId: isId(projectMetaModelId) ? projectMetaModelId : null,
    ecoreFileId,
    genModelFileId: isId(genModelFileId) ? genModelFileId : null,
  };
}

type RelationCandidate = RelationState & { backendId: number | null };

/** The relation in an element of `relations`, or `null` if it isn't live or between live models. */
function readRelation(key: string, element: unknown, models: Map<number, ModelState>): RelationCandidate | null {
  if (!(element instanceof Y.Map) || isDeleted(element)) {
    return null;
  }
  const sourceId = field<RelationFields>(element, 'sourceId');
  const targetId = field<RelationFields>(element, 'targetId');
  if (!isId(sourceId) || !isId(targetId) || !models.has(sourceId) || !models.has(targetId)) {
    return null;
  }
  const reactionFileId = field<RelationFields>(element, 'reactionFileId');
  const fineGranular = field<RelationFields>(element, 'fineGranular');
  const backendId = field<RelationFields>(element, 'backendId');
  return {
    key,
    sourceId,
    targetId,
    backendId: isId(backendId) ? backendId : null,
    reactionFileId: isId(reactionFileId) ? reactionFileId : null,
    fineGranular: Array.isArray(fineGranular) ? fineGranular.filter(isObject) : [],
  };
}

function readRelations(doc: Y.Doc, models: Map<number, ModelState>): Map<string, RelationState> {
  const candidates = new Map<string, RelationCandidate[]>();
  for (const [key, element] of sortedEntries(doc.getMap(RELATIONS))) {
    const relation = readRelation(key, element, models);
    if (relation === null) {
      continue;
    }
    const pair = pairKey(relation.sourceId, relation.targetId);
    candidates.set(pair, [...(candidates.get(pair) ?? []), relation]);
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
  return relations;
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
  return {
    ...diffModels(previous.models, next.models),
    ...diffRelations(previous.relations, next.relations, compareMappings),
    reactionLayout:
      canonicalJson(previous.reactionLayout) === canonicalJson(next.reactionLayout) ? undefined : next.reactionLayout,
    vsumCircle:
      next.vsumCircle === null || isSameVsumCircle(previous.vsumCircle, next.vsumCircle) ? undefined : next.vsumCircle,
  };
}

function diffModels(
  previous: Map<number, ModelState>,
  next: Map<number, ModelState>,
): Pick<ProjectChanges, 'addedModels' | 'removedModels' | 'renamedModels' | 'movedModels' | 'copiedModels'> {
  const changes: ReturnType<typeof diffModels> = {
    addedModels: [],
    removedModels: [],
    renamedModels: [],
    movedModels: [],
    copiedModels: [],
  };
  for (const model of next.values()) {
    const before = previous.get(model.sourceId);
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
    if (model.copy !== undefined && model.copy.ecoreFileId !== before.copy?.ecoreFileId) {
      changes.copiedModels.push(model);
    }
  }
  changes.removedModels = [...previous.keys()].filter((sourceId) => !next.has(sourceId));
  return changes;
}

function diffRelations(
  previous: Map<string, RelationState>,
  next: Map<string, RelationState>,
  compareMappings: boolean,
): Pick<ProjectChanges, 'upsertedRelations' | 'removedRelations'> {
  const isChanged = (before: RelationState | undefined, relation: RelationState): boolean => {
    if (before === undefined) {
      return true;
    }
    const mappingsChanged = canonicalJson(before.fineGranular) !== canonicalJson(relation.fineGranular);
    return before.reactionFileId !== relation.reactionFileId || (compareMappings && mappingsChanged);
  };
  return {
    upsertedRelations: [...next].filter(([pair, relation]) => isChanged(previous.get(pair), relation)).map(([, relation]) => relation),
    removedRelations: [...previous]
      .filter(([pair]) => !next.has(pair))
      .map(([, relation]) => ({ sourceId: relation.sourceId, targetId: relation.targetId })),
  };
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

/** The VSUM circle in a value of the document, or `null` if it isn't one. */
function toVsumCircle(value: unknown): VsumCircle | null {
  if (!isObject(value) || !isFiniteNumber(value.cx) || !isFiniteNumber(value.cy) || !isFiniteNumber(value.r) || value.r <= 0) {
    return null;
  }
  return { cx: value.cx, cy: value.cy, r: value.r };
}

export function isSameVsumCircle(a: VsumCircle | null, b: VsumCircle | null): boolean {
  return a === b || (a !== null && b !== null && a.cx === b.cx && a.cy === b.cy && a.r === b.r);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isSamePosition(a: Position | null, b: Position | null): boolean {
  return a === b || (a !== null && b !== null && a.x === b.x && a.y === b.y);
}

function sortedEntries(map: Y.Map<unknown>): [string, unknown][] {
  return [...map.entries()].sort(([a], [b]) => compareStrings(a, b));
}

/** Orders strings by their code units, the same everywhere, unlike `localeCompare`. */
function compareStrings(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

/** JSON text of a value that doesn't depend on the order of object keys. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (isObject(value)) {
    const keys = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort(compareStrings);
    const members = keys.map((key) => JSON.stringify(key) + ':' + canonicalJson(value[key]));
    return '{' + members.join(',') + '}';
  }
  return JSON.stringify(value) ?? 'undefined';
}
