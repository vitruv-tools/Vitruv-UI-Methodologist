import * as Y from 'yjs';
import { randomUniqueSuffix } from '../utils/secureRandom';
import {
  LAYOUT,
  LAYOUT_META_MODELS,
  LAYOUT_REACTIONS,
  MODELS,
  NOT_DELETED,
  RELATIONS,
  type ModelFields,
  type Position,
  type RelationFields,
} from './document';
import {
  canonicalJson,
  diffProjectState,
  hasChanges,
  pairKey,
  readProjectState,
  type ProjectChanges,
  type ProjectState,
} from './projectState';

/**
 * Origin of the changes this client makes to the document. The canvas already shows them, so they
 * aren't reported as changes of other users.
 */
export const LOCAL_ORIGIN = Symbol('canvas');

/** What there is to undo and redo for this user. */
export interface UndoHistory {
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * Changes of one undo step are merged as long as the step isn't closed with `stopCapturing()`.
 * Yjs merges a change into the last step if it comes less than this long after it, and a closed
 * step counts as having been changed at time 0, so this must stay far below the current time.
 */
const MERGE_UNTIL_CLOSED_MS = 1e11;

/** The part of a relation that a user changes. */
export interface RelationInput {
  sourceId: number;
  targetId: number;
  reactionFileId: number | null;
  /** The mappings; the relation keeps its own if this is left out. */
  fineGranular?: Record<string, unknown>[];
}

/**
 * A project's shared document, read and changed in the terms of the canvas.
 *
 * Changes are operations of the user (add a metamodel, move it, delete it, ...), each one a single
 * Yjs transaction with {@link LOCAL_ORIGIN}. The canvas is never written into the document as a
 * whole: a state that lacks something another user just added would delete it.
 *
 * Deleting only marks elements as deleted (`softDeleted`); the server leaves those out when it
 * writes the project back.
 */
export class ProjectDocument {
  /**
   * Undoes the user's own changes only: those made with {@link LOCAL_ORIGIN}. What others or the
   * server did, and what is in the document before the user joins, isn't on its stacks, and a value
   * that another user changed since is left as it is.
   */
  private readonly undoManager: Y.UndoManager;
  /** The last change was part of a drag that is still going on, so the next one belongs to it. */
  private stepOpen = false;
  private readonly historyListeners = new Set<(history: UndoHistory) => void>();

  constructor(readonly doc: Y.Doc) {
    this.undoManager = new Y.UndoManager([doc.getMap(MODELS), doc.getMap(RELATIONS), doc.getMap(LAYOUT)], {
      trackedOrigins: new Set([LOCAL_ORIGIN]),
      captureTimeout: MERGE_UNTIL_CLOSED_MS,
    });
    const notify = () => {
      const history = this.history();
      for (const listener of this.historyListeners) {
        listener(history);
      }
    };
    this.undoManager.on('stack-item-added', notify);
    this.undoManager.on('stack-item-popped', notify);
    this.undoManager.on('stack-cleared', notify);
  }

  /** Whether there is something to undo or redo. */
  history(): UndoHistory {
    return { canUndo: this.undoManager.undoStack.length > 0, canRedo: this.undoManager.redoStack.length > 0 };
  }

  /** Calls the listener when what can be undone or redone changes. Returns a function that stops it. */
  onHistoryChange(listener: (history: UndoHistory) => void): () => void {
    this.historyListeners.add(listener);
    return () => this.historyListeners.delete(listener);
  }

  /**
   * Takes back the user's last step. Others see it like any other change. Returns `false` if
   * there is nothing left to undo.
   */
  undo(): boolean {
    this.stepOpen = false;
    return this.undoManager.undo() !== null;
  }

  /** Brings back the step that was undone last; `false` if there is none. */
  redo(): boolean {
    this.stepOpen = false;
    return this.undoManager.redo() !== null;
  }

  /**
   * Whether the server has filled the document. Its maps for the layout are created then, never by
   * a client: two clients creating them at the same time would lose the positions of one of them.
   */
  isLoaded(): boolean {
    const layout = this.doc.getMap(LAYOUT);
    return layout.get(LAYOUT_META_MODELS) instanceof Y.Map && layout.get(LAYOUT_REACTIONS) instanceof Y.Map;
  }

  read(): ProjectState {
    return readProjectState(this.doc);
  }

  addModel(model: { sourceId: number; name: string; position: Position }): void {
    this.write('add a metamodel', () => {
      const models = this.doc.getMap(MODELS);
      const key = String(model.sourceId);
      const existing = models.get(key);
      if (existing instanceof Y.Map) {
        // Deleted before: it comes back, with the name and position it is added with now.
        setIfChanged(existing, 'name', model.name);
        setIfChanged(existing, 'softDeleted', false);
        setIfChanged(existing, 'softDeletedVia', null);
      } else {
        models.set(key, element<ModelFields>({ name: model.name, ...NOT_DELETED }));
      }
      this.setPosition(key, model.position);
    });
  }

  /** Deletes a metamodel, and with it its relations, which remember that this is why. */
  removeModel(sourceId: number): void {
    this.write('delete a metamodel', () => {
      const key = String(sourceId);
      const existing = this.doc.getMap(MODELS).get(key);
      if (!(existing instanceof Y.Map) || existing.get('softDeleted') === true) {
        return;
      }
      existing.set('softDeleted', true);
      existing.set('softDeletedVia', null);
      for (const [, relation] of this.relationElements()) {
        const isTouched = relation.get('sourceId') === sourceId || relation.get('targetId') === sourceId;
        if (isTouched && relation.get('softDeleted') !== true) {
          relation.set('softDeleted', true);
          relation.set('softDeletedVia', key);
        }
      }
    });
  }

  renameModel(sourceId: number, name: string): void {
    this.write('rename a metamodel', () => {
      const existing = this.doc.getMap(MODELS).get(String(sourceId));
      if (existing instanceof Y.Map) {
        setIfChanged(existing, 'name', name);
      }
    });
  }

  /**
   * Moves metamodels; only positions that differ are written. While `dragging`, the moves are
   * written as the box moves, and the move that follows them, when the box is let go, is part of
   * the same undo step.
   */
  moveModels(positions: ReadonlyMap<number, Position>, { dragging = false }: { dragging?: boolean } = {}): void {
    this.write(
      'move metamodels',
      () => {
        for (const [sourceId, position] of positions) {
          this.setPosition(String(sourceId), position);
        }
      },
      { joinsStep: this.stepOpen, keepsStepOpen: dragging },
    );
  }

  /**
   * Sets the reaction file and mappings of the relation between two metamodels, adding the relation
   * if there is none. A relation that was deleted isn't brought back: the pair gets a new one.
   */
  upsertRelation(input: RelationInput): void {
    this.write('change a relation', () => {
      const existing = this.liveRelation(input.sourceId, input.targetId);
      if (existing === undefined) {
        this.doc.getMap(RELATIONS).set(
          randomUniqueSuffix(),
          element<RelationFields>({
            backendId: null,
            sourceId: input.sourceId,
            targetId: input.targetId,
            reactionFileId: input.reactionFileId,
            fineGranular: input.fineGranular ?? [],
            ...NOT_DELETED,
          }),
        );
        return;
      }
      setIfChanged(existing, 'reactionFileId', input.reactionFileId);
      if (input.fineGranular !== undefined && canonicalJson(existing.get('fineGranular')) !== canonicalJson(input.fineGranular)) {
        existing.set('fineGranular', input.fineGranular);
      }
    });
  }

  /** Deletes the relation between two metamodels. */
  removeRelation(sourceId: number, targetId: number): void {
    this.write('delete a relation', () => {
      for (const [, relation] of this.relationElements()) {
        const isPair = relation.get('sourceId') === sourceId && relation.get('targetId') === targetId;
        if (isPair && relation.get('softDeleted') !== true) {
          relation.set('softDeleted', true);
          relation.set('softDeletedVia', null);
        }
      }
    });
  }

  /** Sets entries of the reaction layout; an entry given as `undefined` is removed. */
  setReactionLayout(entries: Record<string, unknown>): void {
    this.write('change the reaction layout', () => {
      const reactions = this.doc.getMap(LAYOUT).get(LAYOUT_REACTIONS) as Y.Map<unknown>;
      for (const [key, value] of Object.entries(entries)) {
        if (value === undefined) {
          reactions.delete(key);
        } else if (canonicalJson(reactions.get(key)) !== canonicalJson(value)) {
          reactions.set(key, value);
        }
      }
    });
  }

  /**
   * Reports what other users (and the server) change, as what differs from before, together with
   * the whole state it leads to. The user's own changes aren't reported. Returns the state at this
   * moment, which the first changes are relative to, and a function that stops listening.
   */
  onRemoteChange(
    listener: (changes: ProjectChanges, state: ProjectState) => void,
  ): { state: ProjectState; stop: () => void } {
    let previous = this.read();
    const onUpdate = (_update: Uint8Array, origin: unknown) => {
      const next = this.read();
      const changes = diffProjectState(previous, next);
      previous = next;
      if (origin !== LOCAL_ORIGIN && hasChanges(changes)) {
        listener(changes, next);
      }
    };
    this.doc.on('update', onUpdate);
    return { state: previous, stop: () => this.doc.off('update', onUpdate) };
  }

  /**
   * Runs a change as one transaction, unless the document isn't loaded yet. It is a step of its own
   * for undo, unless it continues the drag before it (`joinsStep`).
   */
  private write(
    what: string,
    change: () => void,
    { joinsStep = false, keepsStepOpen = false }: { joinsStep?: boolean; keepsStepOpen?: boolean } = {},
  ): void {
    if (!this.isLoaded()) {
      console.warn(`Not able to ${what}: the project is not loaded into the shared document yet.`);
      return;
    }
    if (!joinsStep) {
      this.undoManager.stopCapturing();
    }
    this.doc.transact(change, LOCAL_ORIGIN);
    this.stepOpen = keepsStepOpen;
  }

  private setPosition(key: string, position: Position): void {
    const positions = this.doc.getMap(LAYOUT).get(LAYOUT_META_MODELS) as Y.Map<unknown>;
    const current = positions.get(key) as Position | undefined;
    if (current?.x !== position.x || current?.y !== position.y) {
      positions.set(key, { x: position.x, y: position.y });
    }
  }

  private relationElements(): [string, Y.Map<unknown>][] {
    return [...this.doc.getMap(RELATIONS).entries()].filter(
      (entry): entry is [string, Y.Map<unknown>] => entry[1] instanceof Y.Map,
    );
  }

  /** The element of the relation the document shows for a pair: the one the canvas shows. */
  private liveRelation(sourceId: number, targetId: number): Y.Map<unknown> | undefined {
    const key = readProjectState(this.doc).relations.get(pairKey(sourceId, targetId))?.key;
    return key === undefined ? undefined : this.relationElements().find(([k]) => k === key)?.[1];
  }
}

function element<T>(fields: T): Y.Map<unknown> {
  return new Y.Map<unknown>(Object.entries(fields as Record<string, unknown>));
}

function setIfChanged(map: Y.Map<unknown>, key: string, value: unknown): void {
  if (map.get(key) !== value) {
    map.set(key, value);
  }
}
