import { Handle, NodeProps, Position } from "reactflow";

/**
 * Renders an invisible helper node that exposes reaction handles for edge creation.
 * @param {NodeProps} props - React Flow node props for the ghost node instance.
 * @returns {JSX.Element} A minimal node element with source and target reaction handles.
 */
export function GhostNode({ id }: NodeProps) {
  return (
    <div style={{ width: 5, height: 5 }}>
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={false}
        style={{ background: "transparent", border: "none" }}
      />
      <Handle 
        type="target" 
        position={Position.Left} 
        isConnectable={true}
        id={`reaction-0-left-target-${id}`}
        className="uml reaction-handle"
      />
      <Handle 
        type="source" 
        position={Position.Left} 
        isConnectable={true}
        id={`reaction-1-left-source-${id}`}
        className="uml reaction-handle"
      />
    </div>
  );
}
