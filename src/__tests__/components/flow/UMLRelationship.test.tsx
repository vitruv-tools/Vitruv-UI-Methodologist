import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { UMLRelationship } from '../../../components/flow/UMLRelationship';

jest.mock('reactflow', () => ({
  __esModule: true,
  useStore: (selector: any) =>
    selector({
      nodeInternals: new Map(),
    }),
  // EdgeLabelRenderer renders multiplicity badges in an HTML overlay layer.
  // In tests we just render its children inline so badge content is accessible.
  EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('UMLRelationship', () => {
  it('renders edge path and label', () => {
    const { container } = render(
      <svg>
        <UMLRelationship
          id="edge-1"
          source="s1"
          target="t1"
          sourceX={0}
          sourceY={0}
          targetX={100}
          targetY={0}
          data={{ label: 'association', relationshipType: 'association' }}
          selected={false}
          style={{}}
        />
      </svg>,
    );

    const path = container.querySelector('path#edge-1');
    expect(path).not.toBeNull();
    expect(screen.getByText('association')).toBeInTheDocument();
  });

  it('renders source and target multiplicity badges via EdgeLabelRenderer', () => {
    render(
      <svg>
        <UMLRelationship
          id="edge-mult"
          source="s1"
          target="t1"
          sourceX={0}
          sourceY={0}
          targetX={200}
          targetY={0}
          data={{
            label: '',
            relationshipType: 'composition',
            sourceMultiplicity: '1',
            targetMultiplicity: '1..*',
          }}
          selected={false}
          style={{}}
        />
      </svg>,
    );

    // Badges are rendered by EdgeLabelRenderer (HTML overlay, mocked as a fragment).
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('1..*')).toBeInTheDocument();
  });

  it('does not render multiplicity badges when not provided', () => {
    render(
      <svg>
        <UMLRelationship
          id="edge-no-mult"
          source="s1"
          target="t1"
          sourceX={0}
          sourceY={0}
          targetX={200}
          targetY={0}
          data={{ label: '', relationshipType: 'inheritance' }}
          selected={false}
          style={{}}
        />
      </svg>,
    );

    // No badge text should appear
    expect(screen.queryByText('1')).toBeNull();
    expect(screen.queryByText('1..*')).toBeNull();
  });

  it('renders a direction marker by default for association edges', () => {
    render(
      <svg>
        <UMLRelationship
          id="edge-arrow"
          source="s1"
          target="t1"
          sourceX={0}
          sourceY={0}
          targetX={200}
          targetY={0}
          data={{ relationshipType: 'association' }}
          selected={false}
          style={{}}
        />
      </svg>,
    );

    const marker = screen.getByTestId('edge-arrow-direction-marker');
    expect(marker).toBeInTheDocument();
    const path = marker.querySelector('path');
    expect(path).not.toBeNull();
    expect(path?.getAttribute('fill')).toBe('#0c436e');
  });

  it('renders a direction marker by default for composition edges', () => {
    render(
      <svg>
        <UMLRelationship
          id="edge-compose"
          source="s1"
          target="t1"
          sourceX={0}
          sourceY={0}
          targetX={200}
          targetY={0}
          data={{ relationshipType: 'composition' }}
          selected={false}
          style={{}}
        />
      </svg>,
    );

    expect(screen.getByTestId('edge-compose-direction-marker')).toBeInTheDocument();
  });

  it('highlights edge when hovering a multiplicity badge', () => {
    const { container } = render(
      <svg>
        <UMLRelationship
          id="edge-hover-mult"
          source="s1"
          target="t1"
          sourceX={0}
          sourceY={0}
          targetX={200}
          targetY={0}
          data={{
            relationshipType: 'association',
            sourceMultiplicity: '1',
            targetMultiplicity: '0..*',
          }}
          selected={false}
          style={{}}
        />
      </svg>,
    );

    const path = container.querySelector('path#edge-hover-mult') as SVGPathElement;
    expect(path?.style.stroke).toBe('#0c436e');

    fireEvent.mouseEnter(screen.getByText('1'));
    expect(path?.style.stroke).toBe('#ef4444');

    fireEvent.mouseLeave(screen.getByText('1'));
    expect(path?.style.stroke).toBe('#0c436e');
  });

  it('uses red stroke when selected', () => {
    const { container } = render(
      <svg>
        <UMLRelationship
          id="edge-sel"
          source="s1"
          target="t1"
          sourceX={0}
          sourceY={0}
          targetX={120}
          targetY={0}
          data={{ relationshipType: 'association' }}
          selected
          style={{}}
        />
      </svg>,
    );

    const path = container.querySelector('path#edge-sel') as SVGPathElement;
    expect(path?.style.stroke).toBe('#ef4444');
  });

  it('dispatches edge-clicked when the edge is clicked', () => {
    const dispatchSpy = jest.spyOn(globalThis, 'dispatchEvent');
    const { container } = render(
      <svg>
        <UMLRelationship
          id="edge-click"
          source="s1"
          target="t1"
          sourceX={10}
          sourceY={10}
          targetX={110}
          targetY={10}
          data={{ relationshipType: 'association' }}
          selected={false}
          style={{}}
        />
      </svg>,
    );

    const clickArea = container.querySelector('path#edge-click-clickarea');
    fireEvent.click(clickArea!);

    expect(dispatchSpy).toHaveBeenCalled();
    const event = dispatchSpy.mock.calls.find(
      c => c[0] instanceof CustomEvent && (c[0] as CustomEvent).type === 'edge-clicked',
    )?.[0] as CustomEvent;
    expect(event.detail).toEqual({ edgeId: 'edge-click', currentlySelected: false });
    dispatchSpy.mockRestore();
  });

  it('offsets parallel edges so paths differ', () => {
    const base = {
      source: 's1',
      target: 't1',
      sourceX: 0,
      sourceY: 0,
      targetX: 200,
      targetY: 0,
      selected: false,
      style: {},
      data: { relationshipType: 'association' as const },
    };

    const { container: c0 } = render(
      <svg>
        <UMLRelationship {...base} id="p0" data={{ ...base.data, parallelIndex: 0, parallelCount: 2 }} />
      </svg>,
    );
    const { container: c1 } = render(
      <svg>
        <UMLRelationship {...base} id="p1" data={{ ...base.data, parallelIndex: 1, parallelCount: 2 }} />
      </svg>,
    );

    const d0 = c0.querySelector('path#p0')?.getAttribute('d');
    const d1 = c1.querySelector('path#p1')?.getAttribute('d');
    expect(d0).toBeTruthy();
    expect(d1).toBeTruthy();
    expect(d0).not.toBe(d1);
  });
});

