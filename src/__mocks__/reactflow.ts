import React from 'react';

const useNodesState = (initial: any[]) => {
    const [nodes, setNodes] = React.useState<any[]>(initial);
    return [nodes, setNodes, vi.fn()] as const;
};

const useEdgesState = (initial: any[]) => {
    const [edges, setEdges] = React.useState<any[]>(initial);
    return [edges, setEdges, vi.fn()] as const;
};

export { useNodesState, useEdgesState };
export default {};
