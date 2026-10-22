import { Edge, Node } from 'reactflow';

/**
 * Duplicate edge ids make ReactFlow drop edges silently, so they get repaired
 * at three separate points, each with its own id scheme so the three passes
 * cannot fight over the same name:
 *
 * - {@link uniquifyLoadedEdgeIds} on load (`id-1`, `id-2`, …)
 * - {@link dedupeEdgeIds} as a state-level repair (`id__1`)
 * - {@link withUniqueEdgeIds} as a last resort at render time (`id-dup-1`)
 */

/** Drops edges whose source or target node no longer exists. */
export function removeOrphanEdges(nodes: Node[], edges: Edge[]): Edge[] {
  const nodeIds = new Set(nodes.map(n => n.id));
  return edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
}

/** Renames later occurrences of a repeated id. Returns `null` when nothing changed. */
export function dedupeEdgeIds(edges: Edge[]): Edge[] | null {
  const seen = new Map<string, number>();
  let changed = false;

  const fixedEdges = edges.map(edge => {
    const count = seen.get(edge.id) ?? 0;

    if (count === 0) {
      seen.set(edge.id, 1);
      return edge;
    }

    seen.set(edge.id, count + 1);
    changed = true;
    return { ...edge, id: `${edge.id}__${count}` };
  });

  return changed ? fixedEdges : null;
}

/** Render-time guard; also fills in an id for edges that arrived without one. */
export function withUniqueEdgeIds(edges: Edge[]): Edge[] {
  const idCount = new Map<string, number>();

  return edges.map((e, index) => {
    const baseId = e.id || `edge-${index}`;
    const count = idCount.get(baseId) ?? 0;
    idCount.set(baseId, count + 1);

    return count === 0 ? { ...e, id: baseId } : { ...e, id: `${baseId}-dup-${count}` };
  });
}

/** Assigns ids to loaded nodes that lack one. */
export function uniquifyLoadedNodeIds(newNodes: any[]): Node[] {
  return newNodes.map((n, idx) => ({
    ...n,
    id: n.id ?? `loaded-node-${idx}-${Date.now()}`,
  }));
}

/** Assigns collision-free ids to loaded edges, probing upward on a clash. */
export function uniquifyLoadedEdgeIds(newEdges: any[]): Edge[] {
  const seen = new Set<string>();

  return newEdges.map((e, idx) => {
    let baseId = e.id ?? `loaded-edge-${idx}`;

    if (seen.has(baseId)) {
      let k = 1;
      let newId = `${baseId}-${k}`;
      while (seen.has(newId)) {
        k += 1;
        newId = `${baseId}-${k}`;
      }
      baseId = newId;
    }

    seen.add(baseId);
    return { ...e, id: baseId };
  });
}
