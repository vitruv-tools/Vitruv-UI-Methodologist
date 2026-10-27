import { useEffect } from 'react';
import { useStore, useStoreApi } from 'reactflow';

/**
 * After a selection box, React Flow lays a draggable rectangle over the selected nodes. It
 * would catch clicks meant for the models (e.g. Shift+click or double-click to open UML),
 * and dragging any selected model already moves the whole selection, so it is switched off.
 * Must be rendered inside <ReactFlow>.
 */
export function NoNodesSelectionRect(): null {
  const nodesSelectionActive = useStore(state => state.nodesSelectionActive);
  const store = useStoreApi();

  useEffect(() => {
    if (nodesSelectionActive) store.setState({ nodesSelectionActive: false });
  }, [nodesSelectionActive, store]);

  return null;
}
