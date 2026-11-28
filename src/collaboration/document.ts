/**
 * Layout of a project's shared Yjs document (room `vsum:{id}` on the collaboration server).
 *
 * This is the frontend's copy of `src/document.ts` of vitruv-tools/Methodologist-CollaborationService,
 * which loads the document from the backend and writes it back. Keep the two in sync. This file only
 * names the parts and their values; it doesn't depend on Yjs.
 *
 * ```
 * models     metaModelId → { name, projectMetaModelId, ecoreFileId, genModelFileId, softDeleted, softDeletedVia }
 * relations  key → { backendId, sourceId, targetId, reactionFileId, fineGranular, softDeleted, softDeletedVia }
 * views      key → { backendId, name, description, fileStorageId, metaModelIds, softDeleted, softDeletedVia }
 * layout     { metaModels: metaModelId → { x, y }, reactions: …, vsumCircle: { cx, cy, r }, other stored keys }
 * status     { writebackError, epoch }
 * ```
 *
 * - `models`, `relations` and `views` are `Y.Map`s whose values are `Y.Map`s with the fields below, so
 *   that concurrent changes of different fields are both kept. A field's value is replaced as a
 *   whole: one of two concurrent values wins.
 * - Metamodel IDs are library IDs (`sourceId` of the backend's metamodels), numbers in fields and
 *   decimal strings as keys of `models` and `layout.metaModels`.
 * - Relations and views loaded from the backend are keyed by their backend ID as a string, new ones
 *   by a new UUID. The server fills in `backendId` once it wrote a new element back.
 * - Deleting an element only sets `softDeleted`. `softDeletedVia` is the key of the metamodel whose
 *   deletion also deleted the element. The server leaves soft-deleted elements out of the writeback.
 * - Only the server writes `status`, `backendId` and the IDs of the project's copy of a metamodel
 *   (`projectMetaModelId`, `ecoreFileId`, `genModelFileId`).
 * - A change that adds a metamodel, or restores a deleted one, is written back right away, so that
 *   the backend creates the project's copy and the server can fill in its IDs for the other users.
 */

/** Top-level map of the metamodels, keyed by library metamodel ID. Values: {@link ModelFields}. */
export const MODELS = 'models';
/** Top-level map of the relations. Values: {@link RelationFields}. */
export const RELATIONS = 'relations';
/** Top-level map of the views. Values: {@link ViewFields}. */
export const VIEWS = 'views';
/** Top-level map of the canvas positions. */
export const LAYOUT = 'layout';
/** Top-level map the server reports in. Never written back. */
export const STATUS = 'status';

/** Map in {@link LAYOUT} with the positions of the metamodels, keyed by library metamodel ID. */
export const LAYOUT_META_MODELS = 'metaModels';
/** Map in {@link LAYOUT} with the reaction layouts. */
export const LAYOUT_REACTIONS = 'reactions';
/**
 * Plain value in {@link LAYOUT} with the VSUM circle ({@link VsumCircle}) in canvas coordinates. A
 * client writes it; the server keeps it like any other stored layout key.
 */
export const LAYOUT_VSUM_CIRCLE = 'vsumCircle';
/** Field of {@link STATUS} with the reason of the last failed writeback, `null` if it succeeded. */
export const WRITEBACK_ERROR = 'writebackError';
/** Field of {@link STATUS} that identifies the room the document belongs to. */
export const EPOCH = 'epoch';

/** URL parameter in which a client sends the {@link EPOCH} of its document when it connects. */
export const EPOCH_PARAM = 'epoch';
/**
 * WebSocket close code with which the server closes the connection of a client whose document
 * belongs to an earlier room of the project. The client must start again with a new, empty document.
 */
export const OUTDATED_DOCUMENT_CLOSE_CODE = 4409;

/** Fields every element has. */
export interface SoftDeletable {
  softDeleted: boolean;
  /** Key of the metamodel whose deletion also deleted this element; `null` if deleted itself. */
  softDeletedVia: string | null;
}

/** Fields of a metamodel (a `Y.Map` in {@link MODELS}). */
export interface ModelFields extends SoftDeletable, CopyFields {
  /** Name of the metamodel in this project. */
  name: string;
}

/**
 * IDs of the project's own copy of a metamodel, which the backend makes when the metamodel is
 * written back. Every member of the project may read the copy's files, unlike those of the library
 * metamodel, which only its owner may read. Set by the server when it loads the project and after
 * each writeback, always as the backend has them: `null` until a new metamodel is written back, and
 * again once its deletion is. A client adds a metamodel without them.
 */
export interface CopyFields {
  /** ID of the copy (`id` in `/details`). */
  projectMetaModelId: number | null;
  /** ID of the copy's ecore file. */
  ecoreFileId: number | null;
  /** ID of the copy's genmodel file, `null` if it has none. */
  genModelFileId: number | null;
}

/** Fields of a relation between two metamodels (a `Y.Map` in {@link RELATIONS}). */
export interface RelationFields extends SoftDeletable {
  /** ID of the relation in the backend; `null` until the server wrote a new relation back. */
  backendId: number | null;
  /** Library ID of the source metamodel. */
  sourceId: number;
  /** Library ID of the target metamodel. */
  targetId: number;
  /** ID of the relation's reaction file, if it has one. */
  reactionFileId: number | null;
  /**
   * Element-level mappings as plain JSON objects with the fields of the backend's
   * `FineGranularMetaModelRelationRequest`. The array is replaced as a whole.
   */
  fineGranular: Record<string, unknown>[];
}

/** A position on the canvas. */
export interface Position {
  x: number;
  y: number;
}

/** The VSUM circle the metamodels are kept in, in canvas coordinates; the same for all users. */
export interface VsumCircle {
  cx: number;
  cy: number;
  r: number;
}

/** The values `softDeleted` and `softDeletedVia` of an element that isn't deleted. */
export const NOT_DELETED: SoftDeletable = { softDeleted: false, softDeletedVia: null };
