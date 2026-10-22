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

  it('routes a fine-granular reaction around a class sitting between the endpoints', () => {
    mockInternals.set('s1', {
      id: 's1',
      type: 'eobject',
      selected: false,
      position: { x: 0, y: 0 },
      positionAbsolute: { x: 0, y: 0 },
      width: 200,
      height: 56,
      data: { attributes: [{ name: 'name' }] },
    });
    mockInternals.set('wall', {
      id: 'wall',
      type: 'eobject',
      selected: false,
      position: { x: 230, y: -20 },
      positionAbsolute: { x: 230, y: -20 },
      width: 80,
      height: 120,
      data: {},
    });
    mockInternals.set('t1', {
      id: 't1',
      type: 'eobject',
      selected: false,
      position: { x: 400, y: 0 },
      positionAbsolute: { x: 400, y: 0 },
      width: 200,
      height: 56,
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
    expect(path).toHaveAttribute('data-routing', 'orthogonal');
    const d = path?.getAttribute('d') ?? '';
    expect(d.split(' L ').length).toBeGreaterThan(2);
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

  it('stops a straight modeling reaction at the arrow base so the stroke does not overshoot the tip', () => {
    const { container } = render(
      <svg>
        <ReactionRelationship
          id="edge-straight"
          source="s1"
          target="t1"
          sourceX={0}
          sourceY={0}
          targetX={100}
          targetY={0}
          sourcePosition={'right' as any}
          targetPosition={'left' as any}
          data={{ label: 'Reaction' }}
          selected={false}
          style={{ stroke: '#3b82f6', strokeWidth: 2 }}
        />
      </svg>,
    );

    const path = container.querySelector('path#edge-straight');
    expect(path).toHaveAttribute('data-routing', 'straight');
    expect(path?.getAttribute('d')).toBe('M 0,0 L 90,0');
  });

  it('stops an orthogonal modeling reaction on the last segment, not past the arrow tip', () => {
    const { container } = render(
      <svg>
        <ReactionRelationship
          id="edge-ortho"
          source="s1"
          target="t1"
          sourceX={0}
          sourceY={0}
          targetX={100}
          targetY={80}
          sourcePosition={'right' as any}
          targetPosition={'left' as any}
          data={{ routingStyle: 'orthogonal' }}
          selected={false}
          style={{ stroke: '#3b82f6', strokeWidth: 2 }}
        />
      </svg>,
    );

    const path = container.querySelector('path#edge-ortho');
    expect(path).toHaveAttribute('data-routing', 'orthogonal');
    const d = path?.getAttribute('d') ?? '';
    expect(d).toMatch(/L 90,80$/);
    expect(d).not.toMatch(/L 100,80$/);
  });

  it('points the arrow along the last routed segment', () => {
    const { container } = render(
      <svg>
        <ReactionRelationship
          id="edge-arrow"
          source="s1"
          target="t1"
          sourceX={259}
          sourceY={126}
          targetX={59}
          targetY={200}
          sourcePosition={'bottom' as any}
          targetPosition={'top' as any}
          data={{
            routingStyle: 'orthogonal',
            routeWaypoints: [
              { x: 259, y: 126 },
              { x: 259, y: 200 },
              { x: 59, y: 200 },
            ],
          }}
          selected={false}
          style={{ stroke: '#3b82f6', strokeWidth: 2 }}
        />
      </svg>,
    );

    const arrow = container.querySelector('g[transform]');
    expect(arrow?.getAttribute('transform')).toBe('translate(59, 200) rotate(180)');
  });
});

