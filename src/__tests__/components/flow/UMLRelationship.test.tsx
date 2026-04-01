import React from 'react';
import { render, screen } from '@testing-library/react';
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
});

