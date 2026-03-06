import { UMLRelationshipTypes } from "../components/flow/UMLRelationship";
import { useSelectedEdgeStore } from "../store/SelectedEdge";
import { FlowEcoreEdge } from "../types";
import { OnEdgeClickParams } from "../types/EdgeEventHandlers";

/**
 * Edgle click handler that is called from the FlowCanvas when an uml type edge is clicked.
 *
 *  @param params The edge click parameters.
 */
export function onEdgeClick(params: OnEdgeClickParams) {
  // TODO(Reinbold): Which relationship types should have details shown on click?
  if (params.edge.data?.relationshipType !== UMLRelationshipTypes.INHERITANCE) {
    useSelectedEdgeStore.setState({ selectedEdge: params.edge as FlowEcoreEdge | null });
  }
}