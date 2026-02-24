import React from 'react';
import { render, screen } from '@testing-library/react';
import { UMLRelationship } from '../../../components/flow/UMLRelationship';

jest.mock('reactflow', () => ({
  __esModule: true,
  useStore: (selector: any) =>
    selector({
      nodeInternals: new Map(),
    }),
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
});

