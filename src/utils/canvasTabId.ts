let tabInstanceSeq = 0;

/**
 * Unique key for an open canvas tab (React state / session maps).
 * Not used for authentication or secrets — sequential suffix avoids Math.random().
 */
export function createCanvasTabInstanceId(projectId: number): string {
  tabInstanceSeq += 1;
  return `${projectId}-${Date.now()}-${tabInstanceSeq}`;
}
