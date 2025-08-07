export interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
  nodeType?: string;
  draggable?: boolean;
}

export interface TreeMenuProps {
  nodes: TreeNode[];
  onNodeClick?: (node: TreeNode) => void;
  onDragStart?: (event: React.DragEvent, node: TreeNode) => void;
} 