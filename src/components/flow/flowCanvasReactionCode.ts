import { Node } from 'reactflow';

/**
 * Package name declared inside the .ecore file, falling back to the file name
 * and finally to a generic placeholder.
 */
function getEPackageName(node: Node | undefined): string {
  const match = node?.data?.fileContent?.match(/<ecore:EPackage[^>]+name="([^"]+)"/);
  return match?.[1] ?? node?.data?.fileName?.replace('.ecore', '') ?? 'source';
}

/**
 * Skeleton .reactions file for a freshly drawn edge: imports both metamodels
 * and opens an empty reactions block from source to target.
 */
export function buildInitialReactionCode(
  nodes: Node[],
  sourceNodeId: string,
  targetNodeId: string,
): string {
  const sourceNode = nodes.find(n => n.id === sourceNodeId);
  const targetNode = nodes.find(n => n.id === targetNodeId);

  const sourcePackageName = getEPackageName(sourceNode);
  const targetPackageName = getEPackageName(targetNode);
  const sourceUri = sourceNode?.data?.nsUri ?? `http://vitruv.tools/${sourcePackageName}`;
  const targetUri = targetNode?.data?.nsUri ?? `http://vitruv.tools/${targetPackageName}`;

  return `import "${sourceUri}" as ${sourcePackageName}\nimport "${targetUri}" as ${targetPackageName}\n\nreactions: ${sourcePackageName}To${targetPackageName}\nin reaction to changes in ${sourcePackageName}\nexecute actions in ${targetPackageName}\n\n`;
}
