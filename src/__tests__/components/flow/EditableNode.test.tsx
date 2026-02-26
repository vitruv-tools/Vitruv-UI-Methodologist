import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Position } from 'reactflow';
import { EditableNode } from '../../../components/flow/EditableNode';

jest.mock('reactflow', () => {
  const actual = jest.requireActual('reactflow');
  return {
    ...actual,
    Handle: ({ id, type, position, isConnectable }: any) => (
      <div data-testid={`handle-${id}`} data-type={type} data-position={position} data-connectable={isConnectable} />
    ),
  };
});

describe('EditableNode', () => {
  it('renders a class node with its name and delete button when selected', () => {
    const onDelete = jest.fn();

    render(
      <EditableNode
        id="node-1"
        data={{ toolType: 'element', toolName: 'class', className: 'MyClass', onDelete }}
        selected
        isConnectable
      />,
    );

    expect(screen.getByText('MyClass')).toBeInTheDocument();

    const deleteButton = screen.getByTitle(/Delete node/i);
    fireEvent.click(deleteButton);
    expect(onDelete).toHaveBeenCalledWith('node-1');
  });

  it('renders all side handles with correct ids', () => {
    render(
      <EditableNode
        id="node-handles"
        data={{ label: 'Test' }}
        selected={false}
        isConnectable
      />,
    );

    const expectedIds = [
      'left-target',
      'left-source',
      'top-target',
      'top-source',
      'right-source',
      'right-target',
      'bottom-source',
      'bottom-target',
    ];

    expectedIds.forEach((id) => {
      expect(screen.getByTestId(`handle-${id}`)).toBeInTheDocument();
    });
  });
});

