import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReactionRelationship } from '../../../components/flow/ReactionRelationship';

const mockInternals = new Map<string, any>();

jest.mock('reactflow', () => ({
  __esModule: true,
  useReactFlow: () => ({
    getNode: () => ({ position: { x: 0, y: 0 } }),
    screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x, y }),
  }),
  useStore: (selector: any) =>
    selector({
      nodeInternals: mockInternals,
    }),
  EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Position: {
    Top: 'top',
    Bottom: 'bottom',
    Left: 'left',
    Right: 'right',
  },
}));

describe('ReactionRelationship', () => {
  beforeEach(() => mockInternals.clear());

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

  it('draws a straight chord for a fine-granular reaction, not an orthogonal L-path', () => {
    mockInternals.set('s1', {
      id: 's1',
      selected: false,
      position: { x: 0, y: 0 },
      positionAbsolute: { x: 0, y: 0 },
      width: 200,
      data: { attributes: [{ name: 'name' }] },
    });
    mockInternals.set('t1', {
      id: 't1',
      selected: false,
      position: { x: 400, y: 0 },
      positionAbsolute: { x: 400, y: 0 },
      width: 200,
      data: { attributes: [{ name: 'name' }] },
    });

    const { container } = render(
      <svg>
        <ReactionRelationship
          id="edge-fg"
          source="s1"
          target="t1"
          sourceX={200}
          sourceY={16}
          targetX={400}
          targetY={16}
          sourcePosition={'right' as any}
          targetPosition={'left' as any}
          data={{
            fineGranular: true,
            sourceHandleId: 'reaction-source-http://a#A',
            targetHandleId: 'reaction-target-http://b#B',
            label: 'reacts',
          }}
          selected={false}
          style={{ stroke: '#3b82f6', strokeWidth: 2 }}
        />
      </svg>,
    );

    const path = container.querySelector('path#edge-fg');
    expect(path).toHaveAttribute('data-routing', 'chord');
    expect(path).toHaveAttribute('class', 'reaction-line');
    const d = path?.getAttribute('d') ?? '';
    expect(d).toMatch(/^M /);
    expect(d.split(' L ').length).toBe(2);
    expect(d).not.toMatch(/L [\d.-]+,[\d.-]+ L [\d.-]+,[\d.-]+ L /);
    expect(screen.getByTestId('edge-fg-arrow')).toBeInTheDocument();
  });
});

