import type { UMLClass, UMLRelationship } from '../../utils/ecoreToUml';
import { sanitizeUmlClassId } from '../../utils/umlLayoutStorage';
import type { UmlClassSnapshot } from '../../store/UmlClassClipboard';
import { UML_CLASS_BOX_WIDTH } from './umlDiagramClassMetrics';
import { getUmlClassBoxHeight } from './umlDiagramLayoutGeometry';

/**
 * Distance (diagram units, both axes) between a duplicated class and its
 * original. Also used to move a paste aside when a class already sits exactly
 * at the pasted position.
 */
export const UML_PASTE_OFFSET = 24;

/** Where a paste puts the middle of the pasted classes (class coordinates). */
export interface UmlPastePosition {
  x: number;
  y: number;
}

/** Stops the search for a free paste position after this many steps. */
const MAX_PASTE_OFFSET_STEPS = 50;

/**
 * Copies the given classes and the relationships between them.
 * Relationships to classes outside the list are dropped.
 * Returns null when none of the ids is a class of the model.
 */
export function createUmlClassSnapshot(
  classes: readonly UMLClass[],
  relationships: readonly UMLRelationship[],
  classIds: readonly string[],
): UmlClassSnapshot | null {
  const copiedIds = new Set(classIds);
  const copiedClasses = classes.filter(classItem => copiedIds.has(classItem.id));
  if (copiedClasses.length === 0) return null;
  const copiedRelationships = relationships.filter(relationship => (
    copiedIds.has(relationship.sourceId) && copiedIds.has(relationship.targetId)
  ));
  return structuredClone({
    classes: copiedClasses,
    relationships: copiedRelationships,
  });
}

/** A class id is the sanitized name, so two names can also clash through their ids. */
function isClassNameTaken(
  name: string,
  takenNames: ReadonlySet<string>,
  takenIds: ReadonlySet<string>,
): boolean {
  return takenNames.has(name.toLowerCase()) || takenIds.has(sanitizeUmlClassId(name));
}

/** Matches the suffix added by {@link nextCopyClassName}: `_copy`, `_copy2`, … */
const COPY_SUFFIX = /_copy\d*$/;

/**
 * Returns `Person_copy`, `Person_copy2`, … (the first one not taken).
 * Copying a copy continues the numbering (`Person_copy` → `Person_copy2`)
 * instead of stacking suffixes (`Person_copy_copy`).
 * Class names are compared case-insensitively, like the diagram validation does.
 */
export function nextCopyClassName(
  name: string,
  takenNames: ReadonlySet<string>,
  takenIds: ReadonlySet<string>,
): string {
  const isTaken = (candidate: string) => isClassNameTaken(candidate, takenNames, takenIds);
  const originalName = name.replace(COPY_SUFFIX, '') || name;
  return nextFreeName(`${originalName}_copy`, isTaken);
}

/** `base`, then `base2`, `base3`, … until one is not taken. */
function nextFreeName(base: string, isTaken: (candidate: string) => boolean): string {
  let candidate = base;
  let suffix = 1;
  while (isTaken(candidate)) {
    suffix += 1;
    candidate = `${base}${suffix}`;
  }
  return candidate;
}

function positionKey(x: number, y: number): string {
  return `${x},${y}`;
}

/**
 * The smallest multiple of {@link UML_PASTE_OFFSET}, starting at `firstStep`,
 * at which no pasted class lands exactly on an existing class, so pasting
 * twice at the same spot does not stack the copies.
 */
export function findPasteOffset(
  snapshotClasses: readonly UMLClass[],
  existingClasses: readonly UMLClass[],
  firstStep = 1,
): number {
  const occupied = new Set(existingClasses.map(classItem => positionKey(classItem.x, classItem.y)));
  const overlaps = (offset: number) => snapshotClasses.some(classItem => (
    occupied.has(positionKey(classItem.x + offset, classItem.y + offset))
  ));
  let step = firstStep;
  while (step < MAX_PASTE_OFFSET_STEPS && overlaps(step * UML_PASTE_OFFSET)) {
    step++;
  }
  return step * UML_PASTE_OFFSET;
}

/**
 * Moves the classes so the middle of the group (the rectangle around all
 * class boxes) is at `position`. The classes keep their relative positions.
 */
function centerGroupOn(
  classes: readonly UMLClass[],
  position: UmlPastePosition,
): UMLClass[] {
  const left = Math.min(...classes.map(classItem => classItem.x));
  const top = Math.min(...classes.map(classItem => classItem.y));
  const right = Math.max(...classes.map(classItem => classItem.x + UML_CLASS_BOX_WIDTH));
  const bottom = Math.max(...classes.map(classItem => classItem.y + getUmlClassBoxHeight(classItem)));
  const deltaX = Math.round(position.x - (left + right) / 2);
  const deltaY = Math.round(position.y - (top + bottom) / 2);
  return classes.map(classItem => ({
    ...classItem,
    x: classItem.x + deltaX,
    y: classItem.y + deltaY,
  }));
}

function copyClass(
  classItem: UMLClass,
  id: string,
  name: string,
  offset: number,
): UMLClass {
  return {
    ...classItem,
    id,
    name,
    attributes: classItem.attributes.map((attribute, index) => ({
      ...attribute,
      id: `${id}-${index}`,
    })),
    operations: classItem.operations.map((operation, index) => ({
      ...operation,
      id: `${id}-op-${index}`,
    })),
    x: classItem.x + offset,
    y: classItem.y + offset,
  };
}

/**
 * Builds the classes and relationships to add when pasting a snapshot into a
 * model. Pasted classes get new ids and are renamed on a name clash;
 * relationships connect the new copies.
 *
 * With a `position`, the pasted classes are centered on it (the spot the user
 * clicked). Without one (duplicate), the copies are placed
 * slightly offset from the originals. Either way the classes keep their
 * positions relative to each other.
 */
export function pasteUmlClassSnapshot(
  snapshot: UmlClassSnapshot,
  existingClasses: readonly UMLClass[],
  existingRelationships: readonly UMLRelationship[],
  position?: UmlPastePosition,
): UmlClassSnapshot {
  const takenNames = new Set(existingClasses.map(classItem => classItem.name.toLowerCase()));
  const takenIds = new Set(existingClasses.map(classItem => classItem.id));
  const placedClasses = position && snapshot.classes.length > 0
    ? centerGroupOn(snapshot.classes, position)
    : snapshot.classes;
  const offset = findPasteOffset(placedClasses, existingClasses, position ? 0 : 1);
  const newIdByCopiedId = new Map<string, string>();

  const classes = placedClasses.map(classItem => {
    const name = isClassNameTaken(classItem.name, takenNames, takenIds)
      ? nextCopyClassName(classItem.name, takenNames, takenIds)
      : classItem.name;
    const id = sanitizeUmlClassId(name);
    takenNames.add(name.toLowerCase());
    takenIds.add(id);
    newIdByCopiedId.set(classItem.id, id);
    return copyClass(classItem, id, name, offset);
  });

  const takenRelationshipIds = new Set(existingRelationships.map(relationship => relationship.id));
  const relationships: UMLRelationship[] = [];
  for (const relationship of snapshot.relationships) {
    const sourceId = newIdByCopiedId.get(relationship.sourceId);
    const targetId = newIdByCopiedId.get(relationship.targetId);
    if (!sourceId || !targetId) continue;
    const id = nextFreeName(`${relationship.id}-copy`, candidate => takenRelationshipIds.has(candidate));
    takenRelationshipIds.add(id);
    relationships.push({ ...relationship, id, sourceId, targetId });
  }

  return { classes, relationships };
}
