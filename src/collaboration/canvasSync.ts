import { computeInitialCircle } from '../hooks/useCircleContainment';
import type { VsumCircle } from './document';
import type { ProjectDocument, UndoHistory } from './projectDocument';
import {
  diffProjectState,
  isSameVsumCircle,
  pairKey,
  type ProjectChanges,
  type ProjectState,
} from './projectState';

/** What {@link CanvasSync} needs from the canvas. */
export interface CanvasPort {
  /**
   * The metamodels and relations the canvas shows. A metamodel that is being dragged has no
   * position (`null`), since the canvas can't say where it ends up.
   */
  read(): ProjectState;
  /** Shows what changed in the project on the canvas; resolves once that is done. */
  apply(changes: ProjectChanges): Promise<void>;
  /**
   * Shows a VSUM circle. It is `confirmed` once it is the one of the shared document; before that
   * the canvas must not move metamodels because of it.
   */
  showVsumCircle(circle: VsumCircle, confirmed: boolean): void;
}

/**
 * How long a circle this client seeded waits for the seed of another client that opened the project
 * at the same time. If the document still has this client's circle afterwards, it counts as shared.
 */
export const SEED_CONFIRM_MS = 2000;

/**
 * Keeps the canvas and a project's shared document in line.
 *
 * **Document to canvas.** When it starts, the canvas is made to show the document, whatever it
 * showed before. Afterwards the changes of other users are applied to the canvas, one after the
 * other.
 *
 * **Canvas to document.** The canvas never replaces the document: a canvas that lacks something
 * another user just added would delete it. Instead, what the user changed on the canvas since it
 * last matched the document is written into the document, and only additions and changes:
 * - New metamodels and relations, renames, moves and new reaction files: {@link pushLocalChanges}.
 * - Fine-granular mappings of relations: {@link pushMappings}, when the user saved them.
 * - Deleting needs an explicit call ({@link removeModel}, {@link removeRelation}) for what the user
 *   deleted. A canvas that is cleared (another project is loaded, a tab is restored) deletes nothing.
 *
 * Nothing is written while changes of other users are still being applied. The canvas doesn't show
 * them completely yet, and writing from it could overwrite their newer values.
 */
export class CanvasSync {
  /** What the canvas and the document agree on: the document, and what was written into it. */
  private known: ProjectState | undefined;
  private stopListening: (() => void) | undefined;
  private queue: Promise<void> = Promise.resolve();
  /** Changes of other users that are queued or being applied. */
  private pending = 0;
  private pushAfter: 'changes' | 'mappings' | undefined;
  private stopped = false;
  private seedTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly project: ProjectDocument,
    private readonly canvas: CanvasPort,
  ) {}

  /**
   * Makes the canvas show the project, and follows the project from now on.
   *
   * @throws Error if the project isn't loaded into the document: it would take the canvas away
   */
  async start(): Promise<void> {
    if (!this.project.isLoaded()) {
      throw new Error('The project is not loaded into the shared document yet');
    }
    const { state, stop } = this.project.onRemoteChange((changes, next) => this.enqueue(changes, next));
    this.stopListening = stop;
    this.enqueue(diffProjectState(this.canvas.read(), state), state);
    await this.whenIdle();
  }

  /** Stops following the project. Changes that are queued are dropped. */
  stop(): void {
    this.stopped = true;
    globalThis.clearTimeout(this.seedTimer);
    this.stopListening?.();
    this.stopListening = undefined;
    this.known = undefined;
  }

  /** Resolves once the changes of other users that arrived are shown on the canvas. */
  async whenIdle(): Promise<void> {
    if (this.pending > 0) {
      await this.queue;
      await this.whenIdle();
    }
  }

  /** Whether there is something to undo or redo. */
  history(): UndoHistory {
    return this.project.history();
  }

  /** Calls the listener when what can be undone or redone changes. Returns a function that stops it. */
  onHistoryChange(listener: (history: UndoHistory) => void): () => void {
    return this.project.onHistoryChange(listener);
  }

  /**
   * Takes back the user's last step: only what this user did, never what others did. The canvas
   * shows it like a change of another user. `false` if there is nothing to undo.
   */
  undo(): boolean {
    return this.step(() => this.project.undo());
  }

  /** Brings back the step that was taken back last; `false` if there is none. */
  redo(): boolean {
    return this.step(() => this.project.redo());
  }

  /** Goes through the history, after writing what the user changed a moment ago. */
  private step(change: () => boolean): boolean {
    if (this.stopped || this.known === undefined) {
      return false;
    }
    this.pushLocalChanges();
    return change();
  }

  /**
   * Writes what the user changed on the canvas into the document: new metamodels and relations,
   * renames, moves and reaction files. Mappings and deletions are not part of it. While a box is
   * `dragging`, the positions it passes are part of one undo step with the one where it is let go.
   */
  pushLocalChanges({ dragging = false }: { dragging?: boolean } = {}): void {
    const known = this.ready('changes');
    if (known === undefined) {
      return;
    }
    const canvas = this.canvas.read();
    const changes = diffProjectState(known, canvas, { compareMappings: false });
    for (const model of changes.addedModels) {
      // Without a position the model is added once the canvas knows it, with the next push.
      if (model.position !== null) {
        this.project.addModel({ sourceId: model.sourceId, name: model.name, position: model.position });
      }
    }
    for (const { sourceId, name } of changes.renamedModels) {
      this.project.renameModel(sourceId, name);
    }
    if (changes.movedModels.length > 0) {
      this.project.moveModels(
        new Map(changes.movedModels.map(({ sourceId, position }) => [sourceId, position])),
        { dragging },
      );
    }
    for (const relation of changes.upsertedRelations) {
      this.project.upsertRelation({
        sourceId: relation.sourceId,
        targetId: relation.targetId,
        reactionFileId: relation.reactionFileId,
      });
    }
    this.learn(
      changes.addedModels.filter((model) => model.position !== null).map((model) => model.sourceId),
      changes.renamedModels.map((model) => model.sourceId),
      changes.movedModels.map((model) => model.sourceId),
      changes.upsertedRelations,
    );
  }

  /**
   * Writes the fine-granular mappings of the relations the canvas shows into the document, for the
   * relations whose mappings differ. Called when the user saved a mapping.
   */
  pushMappings(): void {
    const known = this.ready('mappings');
    if (known === undefined) {
      return;
    }
    const changes = diffProjectState(known, this.canvas.read());
    for (const relation of changes.upsertedRelations) {
      this.project.upsertRelation({
        sourceId: relation.sourceId,
        targetId: relation.targetId,
        reactionFileId: relation.reactionFileId,
        fineGranular: relation.fineGranular,
      });
    }
    this.learn([], [], [], changes.upsertedRelations);
  }

  /** Writes entries of the reaction layout into the document. */
  pushReactionLayout(entries: Record<string, unknown>): void {
    if (this.known === undefined) {
      return;
    }
    this.project.setReactionLayout(entries);
    this.known = { ...this.known, reactionLayout: this.project.read().reactionLayout };
  }

  /** Writes the VSUM circle the user changed (resized, laid out, grown) into the document. */
  pushVsumCircle(circle: VsumCircle): void {
    if (this.stopped || this.known === undefined) {
      return;
    }
    this.project.setVsumCircle(circle);
    this.known = { ...this.known, vsumCircle: this.project.read().vsumCircle };
  }

  /**
   * Gives a document without a VSUM circle one, computed from the positions in the document, and
   * shows it unconfirmed. Clients that seed at the same time compute it from the same positions;
   * whichever write wins is shown everywhere. After {@link SEED_CONFIRM_MS} the circle counts as
   * confirmed if the document still has it; a different one arrives as a change of another user.
   */
  seedVsumCircle(): void {
    if (this.stopped || this.known === undefined || this.seedTimer !== undefined) {
      return;
    }
    const document = this.project.read();
    if (document.vsumCircle !== null) {
      return;
    }
    const circle = computeInitialCircle(
      [...document.models.values()].flatMap((model) => (model.position === null ? [] : [{ position: model.position }])),
    );
    if (!this.project.seedVsumCircle(circle)) {
      return;
    }
    this.known = { ...this.known, vsumCircle: circle };
    this.canvas.showVsumCircle(circle, false);
    this.seedTimer = globalThis.setTimeout(() => {
      if (!this.stopped && isSameVsumCircle(this.project.read().vsumCircle, circle)) {
        this.canvas.showVsumCircle(circle, true);
      }
    }, SEED_CONFIRM_MS);
  }

  /** The user deleted a metamodel from the canvas. */
  removeModel(sourceId: number): void {
    if (this.known === undefined) {
      return;
    }
    this.project.removeModel(sourceId);
    this.known = this.project.read();
  }

  /** The user deleted a relation from the canvas. */
  removeRelation(sourceId: number, targetId: number): void {
    if (this.known === undefined) {
      return;
    }
    this.project.removeRelation(sourceId, targetId);
    this.known = this.project.read();
  }

  /** The known state if writing is allowed now; otherwise remembers to write when it is. */
  private ready(push: 'changes' | 'mappings'): ProjectState | undefined {
    if (this.stopped || this.known === undefined) {
      return undefined;
    }
    if (this.pending > 0) {
      this.pushAfter = this.pushAfter === 'mappings' ? 'mappings' : push;
      return undefined;
    }
    return this.known;
  }

  /** After writing: what was written is now what canvas and document agree on. */
  private learn(
    addedModels: number[],
    renamedModels: number[],
    movedModels: number[],
    relations: { sourceId: number; targetId: number }[],
  ): void {
    const known = this.known;
    if (known === undefined) {
      return;
    }
    const document = this.project.read();
    const models = new Map(known.models);
    for (const id of [...addedModels, ...renamedModels, ...movedModels]) {
      const model = document.models.get(id);
      if (model !== undefined) {
        models.set(id, model);
      }
    }
    const relationStates = new Map(known.relations);
    for (const { sourceId, targetId } of relations) {
      const pair = pairKey(sourceId, targetId);
      const relation = document.relations.get(pair);
      if (relation !== undefined) {
        relationStates.set(pair, relation);
      }
    }
    this.known = { ...known, models, relations: relationStates };
  }

  /**
   * What of the changes the canvas can show. A metamodel can only be shown with the ecore file of
   * the project's copy: the library's file is only readable by its owner. So a metamodel another
   * user added waits until the server saved it and filled in its copy (`copiedModels`). It is then
   * shown as the project has it at that point, with its relations, which the canvas skipped while
   * it waited.
   */
  private showable(changes: ProjectChanges, state: ProjectState): ProjectChanges {
    const shown = this.canvas.read().models;
    const added = new Set(changes.addedModels.map((model) => model.sourceId));
    const arriving = changes.copiedModels.filter((model) => !shown.has(model.sourceId) && !added.has(model.sourceId));
    const arrivingIds = new Set(arriving.map((model) => model.sourceId));
    const upserted = new Set(changes.upsertedRelations.map((relation) => pairKey(relation.sourceId, relation.targetId)));
    const relationsOfArriving = [...state.relations].filter(
      ([pair, relation]) => !upserted.has(pair) && (arrivingIds.has(relation.sourceId) || arrivingIds.has(relation.targetId)),
    );
    return {
      ...changes,
      addedModels: [...changes.addedModels, ...arriving].filter((model) => model.copy !== undefined),
      upsertedRelations: [...changes.upsertedRelations, ...relationsOfArriving.map(([, relation]) => relation)],
    };
  }

  private enqueue(changes: ProjectChanges, state: ProjectState): void {
    this.pending += 1;
    this.queue = this.queue.then(() => this.applyToCanvas(changes, state));
  }

  private async applyToCanvas(changes: ProjectChanges, state: ProjectState): Promise<void> {
    try {
      if (!this.stopped) {
        await this.canvas.apply(this.showable(changes, state));
        this.known = state;
      }
    } catch (error) {
      // The canvas may now differ from the document; the next change of the document is applied anyway.
      console.error('Showing the changes of the shared project on the canvas failed:', error);
      this.known = state;
    } finally {
      this.pending -= 1;
    }
    if (this.pending === 0 && this.pushAfter !== undefined && !this.stopped) {
      const push = this.pushAfter;
      this.pushAfter = undefined;
      if (push === 'mappings') {
        this.pushMappings();
      } else {
        this.pushLocalChanges();
      }
    }
  }
}

/** What the canvas needs from {@link CanvasSync}: to write the user's changes into the project. */
export type CanvasCollaboration = Pick<
  CanvasSync,
  | 'pushLocalChanges'
  | 'pushMappings'
  | 'pushReactionLayout'
  | 'pushVsumCircle'
  | 'seedVsumCircle'
  | 'removeModel'
  | 'removeRelation'
  | 'undo'
  | 'redo'
  | 'history'
  | 'onHistoryChange'
>;
