import React from 'react';

const useNodesState = (initial: any[]) => {
    const [nodes, setNodes] = React.useState<any[]>(initial);
    return [nodes, setNodes, jest.fn()] as const;
};

const useEdgesState = (initial: any[]) => {
    const [edges, setEdges] = React.useState<any[]>(initial);
    return [edges, setEdges, jest.fn()] as const;
};

module.exports = {
    __esModule: true,
    useNodesState,
    useEdgesState,
    default: {},
};