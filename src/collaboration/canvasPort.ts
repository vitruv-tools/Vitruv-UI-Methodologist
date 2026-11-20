import type { CanvasPort } from './canvasSync';
import { projectCanvasState } from './canvasProjection';
import type { ModelState, ProjectChanges, ProjectState } from './projectState';
import {
  applyRelationToStore,
  removeRelationFromStore,
} from '../components/flow/flowCanvasCollaboration';
import type { FlowCanvasHandle } from '../components/flow/FlowCanvas';
import type { EditableVsumMetaModelRelation } from '../types/EditableVsumDetails';
import { prepareSnapshotForSyncSave } from '../utils/workspaceSnapshotUtils';

/** What the port uses of the canvas. */
export type CanvasHandle = Pick<
  FlowCanvasHandle,
  | 'getNodes'
  | 'getWorkspaceSnapshot'
  | 'addEcoreFile'
  | 'removeEcoreFileBySourceId'
  | 'updateEcoreDisplayName'
  | 'setEcorePositions'
  | 'upsertReactionRelation'
  | 'removeReactionRelation'
>;

/** A metamodel with its ecore file, ready to be put on the canvas. */
export interface ResolvedMetaModel {
  fileName: string;
  fileContent: string;
  /** What `addEcoreFile` takes as `meta`, e.g. the IDs of the metamodel and its files. */
  meta: Record<string, unknown>;
}

export interface CanvasPortDeps {
  /** The canvas, or `null` if it isn't there (anymore). */
  getCanvas: () => CanvasHandle | null;
  /**
   * Finds a metamodel that another user added, by its library ID, and loads its ecore file.
   * Resolves `null` if it can't be found.
   */
  resolveMetaModel: (sourceId: number) => Promise<ResolvedMetaModel | null>;
  /** The reaction layout of the project the canvas keeps. */
  loadReactionLayout: () => Record<string, unknown>;
  /** Keeps the reaction layout the project has, where the canvas looks for it. */
  saveReactionLayout: (layout: Record<string, unknown>) => void;
  /** Changes the relations of the project's Low Code store, which the reaction editor reads. */
  updateRelations: (
    update: (relations: EditableVsumMetaModelRelation[]) => EditableVsumMetaModelRelation[],
  ) => void;
  /** Resolves once the canvas has shown what it was told. Defaults to a short wait. */
  settle?: () => Promise<void>;
}

/** How long the canvas gets to show new metamodels before relations to them are added. */
const SETTLE_MS = 60;
const defaultSettle = () => new Promise<void>((resolve) => globalThis.setTimeout(resolve, SETTLE_MS));

/**
 * Lets the synchronisation of a project read the canvas and show changes of other users on it. The
 * canvas is changed through its handle, like the rest of the page does.
 */
export function createCanvasPort(deps: CanvasPortDeps): CanvasPort {
  const settle = deps.settle ?? defaultSettle;

  return {
    read(): ProjectState {
      const canvas = deps.getCanvas();
      if (canvas === null) {
        return { models: new Map(), relations: new Map(), reactionLayout: {} };
      }
      return projectCanvasState({
        nodes: canvas.getNodes(),
        relationRequests: prepareSnapshotForSyncSave(canvas.getWorkspaceSnapshot()).metaModelRelationRequests,
        reactionLayout: deps.loadReactionLayout(),
      });
    },

    async apply(changes: ProjectChanges): Promise<void> {
      const canvas = deps.getCanvas();
      if (canvas === null) {
        return;
      }

      for (const { sourceId, targetId } of changes.removedRelations) {
        canvas.removeReactionRelation(sourceId, targetId);
        deps.updateRelations((relations) => removeRelationFromStore(relations, sourceId, targetId));
      }
      for (const sourceId of changes.removedModels) {
        canvas.removeEcoreFileBySourceId(sourceId);
      }

      // The files load side by side; the boxes are added in the order of the changes.
      const loaded = await Promise.all(changes.addedModels.map((model) => loadMetaModel(model.sourceId)));
      changes.addedModels.forEach((model, index) => addMetaModel(canvas, model, loaded[index]));

      for (const { sourceId, name } of changes.renamedModels) {
        canvas.updateEcoreDisplayName(sourceId, name);
      }
      if (changes.movedModels.length > 0) {
        canvas.setEcorePositions(new Map(changes.movedModels.map(({ sourceId, position }) => [sourceId, position])));
      }

      // Relations need the boxes of their metamodels, so they wait until new ones are on the canvas.
      if (changes.addedModels.length > 0) {
        await settle();
      }
      for (const relation of changes.upsertedRelations) {
        canvas.upsertReactionRelation({
          sourceId: relation.sourceId,
          targetId: relation.targetId,
          reactionFileId: relation.reactionFileId,
        });
        deps.updateRelations((relations) => applyRelationToStore(relations, relation));
      }

      if (changes.reactionLayout !== undefined) {
        deps.saveReactionLayout(changes.reactionLayout);
      }
    },
  };

  /** Loads a metamodel that another user added; `null` if that fails or it can't be found. */
  async function loadMetaModel(sourceId: number): Promise<ResolvedMetaModel | null> {
    try {
      const resolved = await deps.resolveMetaModel(sourceId);
      if (resolved === null) {
        console.error(`The metamodel ${sourceId} that another user added was not found.`);
      }
      return resolved;
    } catch (error) {
      console.error(`Loading the metamodel ${sourceId} that another user added failed:`, error);
      return null;
    }
  }
}

/** Puts a metamodel another user added on the canvas, where they put it. */
function addMetaModel(canvas: CanvasHandle, model: ModelState, resolved: ResolvedMetaModel | null): void {
  if (resolved === null) {
    return;
  }
  canvas.addEcoreFile(resolved.fileName, resolved.fileContent, {
    ...resolved.meta,
    displayName: model.name,
    // Not a change of this user: it must not be written into the project again.
    fromServerLoad: true,
    keepSelection: true,
    position: model.position ?? undefined,
    exactPosition: model.position !== null,
  });
}
