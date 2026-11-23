import type { Position } from '../collaboration/document';

/** The read-only page that shows the latest published version of a project. */
export function publishedVersionPath(projectId: number | string): string {
  return `/canvas/${projectId}/published`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

/**
 * Reads the metamodel box positions from a project's stored layout
 * (`{ metaModels: { <library metamodel id>: { x, y } }, … }`). Entries that are not a finite
 * position under a numeric id are skipped.
 */
export function publishedLayoutPositions(layout: unknown): Map<number, Position> {
  const positions = new Map<number, Position>();
  const metaModels = asRecord(asRecord(layout)?.metaModels);
  if (!metaModels) return positions;
  for (const [key, value] of Object.entries(metaModels)) {
    const id = Number(key);
    const position = asRecord(value);
    if (!Number.isInteger(id) || !position) continue;
    const { x, y } = position;
    if (isFiniteNumber(x) && isFiniteNumber(y)) positions.set(id, { x, y });
  }
  return positions;
}
