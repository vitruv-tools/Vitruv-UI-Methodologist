import React from 'react';
import { render } from '@testing-library/react';
import type { Edge, Node } from 'reactflow';
import { CanvasMinimap } from '../../../../components/flow/canvas/CanvasMinimap';
import { metaModelDisplayColor } from '../../../../utils/metaModelColors';

const viewport = { x: 0, y: 0, zoom: 1 };

const renderMinimap = (nodes: Node[], edges: Edge[] = []) =>
  render(
    <CanvasMinimap
      nodes={nodes}
      edges={edges}
      viewport={viewport}
      containerW={800}
      containerH={600}
      width={200}
      height={204}
    />,
  );

describe('CanvasMinimap', () => {
  it('renders VSUM ecoreFile cards with the shared meta-model color', () => {
    const { container } = renderMinimap([
      {
        id: 'pcm',
        type: 'ecoreFile',
        position: { x: 100, y: 100 },
        data: { fileName: 'pcm.ecore', domain: 'pcm' },
      } as Node,
    ]);

    const rect = container.querySelector('rect[data-kind="ecoreFile"]');
    expect(rect).toBeInTheDocument();
    expect(rect).toHaveAttribute('fill', metaModelDisplayColor('pcm', 'pcm.ecore'));
  });

  it('renders reaction bounding boxes and EObjects instead of hidden cards', () => {
    const color = metaModelDisplayColor('pcm', 'pcm.ecore');
    const { container } = renderMinimap([
      {
        id: 'pcm',
        type: 'ecoreFile',
        position: { x: 0, y: 0 },
        hidden: true,
        data: { fileName: 'pcm.ecore', domain: 'pcm' },
      } as Node,
      {
        id: 'bbox-http://pcm',
        type: 'boundingBox',
        position: { x: 40, y: 40 },
        data: { label: 'pcm', color, domain: 'pcm', width: 400, height: 280 },
      } as Node,
      {
        id: 'eobj-1',
        type: 'eobject',
        position: { x: 80, y: 100 },
        data: { group: 'bbox-http://pcm', color, attributes: [] },
      } as Node,
    ], [
      { id: 'r1', source: 'eobj-1', target: 'eobj-1' },
    ]);

    expect(container.querySelector('rect[data-kind="ecoreFile"]')).not.toBeInTheDocument();
    const bbox = container.querySelector('rect[data-kind="boundingBox"]');
    expect(bbox).toBeInTheDocument();
    expect(bbox).toHaveAttribute('fill', color);
    expect(container.querySelector('rect[data-kind="eobject"]')).toBeInTheDocument();
  });
});
