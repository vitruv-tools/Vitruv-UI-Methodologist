import { UMLRelationshipTypes } from "../components/flow/UMLRelationship";
import { useSelectedEdgeStore } from "../store/SelectedEdge";
import { FlowEcoreEdge } from "../types";
import { OnEdgeClickParams } from "../types/EdgeEventHandlers";

/**
 * Handles UML edge click events from the flow canvas.
 * @param {OnEdgeClickParams} params - Edge click parameters.
 * @returns {void}
 */
export function onEdgeClick(params: OnEdgeClickParams) {
  // TODO(Reinbold): Which relationship types should have details shown on click?
  if (params.edge.data?.relationshipType !== UMLRelationshipTypes.INHERITANCE) {
    useSelectedEdgeStore.setState({ selectedEdge: params.edge as FlowEcoreEdge | null });
  }
}