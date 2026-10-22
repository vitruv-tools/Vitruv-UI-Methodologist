import React from 'react';
import { render } from '@testing-library/react';
import { ConnectionLine } from '../../../components/flow/ConnectionLine';

describe('ConnectionLine', () => {
  it('renders svg line and circle between positions', () => {
    const { container } = render(
      <ConnectionLine
        sourcePosition={{ x: 10, y: 20 }}
        targetPosition={{ x: 30, y: 40 }}
      />,
    );

    const line = container.querySelector('line');
    const circle = container.querySelector('circle');

    expect(line).not.toBeNull();
    expect(circle).not.toBeNull();
  });
});

