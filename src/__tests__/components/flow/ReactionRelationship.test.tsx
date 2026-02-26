import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReactionRelationship } from '../../../components/flow/ReactionRelationship';

jest.mock('reactflow', () => ({
  __esModule: true,
  useReactFlow: () => ({
    getNode: () => ({ position: { x: 0, y: 0 } }),
    screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x, y }),
  }),
  useStore: (selector: any) =>
    selector({
      nodeInternals: new Map(),
    }),
  Position: {
    Top: 'top',
    Bottom: 'bottom',
    Left: 'left',
    Right: 'right',
  },
}));

describe('ReactionRelationship', () => {
  it('renders label and code indicator and calls onDoubleClick', () => {
    const onDoubleClick = jest.fn();

    render(
      <svg>
        <ReactionRelationship
          id="edge-r1"
          source="s1"
          target="t1"
          sourceX={0}
          sourceY={0}
          targetX={100}
          targetY={0}
          sourcePosition={'right' as any}
          targetPosition={'left' as any}
          data={{ label: 'Reaction', code: 'some code', onDoubleClick }}
          selected={false}
          style={{ stroke: '#3b82f6', strokeWidth: 2 }}
        />
      </svg>,
    );

    expect(screen.getByText('Reaction')).toBeInTheDocument();
    const codeBadge = screen.getByText('</>');

    fireEvent.doubleClick(codeBadge.parentElement!);
    expect(onDoubleClick).toHaveBeenCalledWith('edge-r1');
  });
});

