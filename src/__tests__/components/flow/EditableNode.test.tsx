import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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

const baseNodeProps = {
  id: 'node-test',
  type: 'editable',
  selected: false as const,
  isConnectable: true,
  zIndex: 0,
  xPos: 0,
  yPos: 0,
  dragging: false,
  dragHandle: undefined,
};

function renderNode(
  toolType: string,
  toolName: string,
  extra: Record<string, any> = {},
) {
  return render(
    <EditableNode
      {...baseNodeProps}
      data={{ label: '', toolType, toolName, ...extra }}
    />,
  );
}

describe('EditableNode', () => {
  it('renders a class node with its name and delete button when selected', () => {
    const onDelete = jest.fn();

    render(
      <EditableNode
        {...baseNodeProps}
        id="node-1"
        data={{ label: '', toolType: 'element', toolName: 'class', className: 'MyClass', onDelete }}
        selected
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
        {...baseNodeProps}
        id="node-handles"
        data={{ label: 'Test', toolType: '', toolName: '' }}
        selected={false}
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


describe('EditableNode – renderer selection', () => {
  it('renders Class header for element/class', () => {
    renderNode('element', 'class');
    expect(screen.getByText(/Class:/i)).toBeInTheDocument();
  });

  it('renders Abstract Class header for element/abstract-class', () => {
    renderNode('element', 'abstract-class');
    expect(screen.getByText(/Abstract Class:/i)).toBeInTheDocument();
  });

  it('renders Interface header for element/interface', () => {
    renderNode('element', 'interface');
    expect(screen.getByText(/Interface:/i)).toBeInTheDocument();
  });

  it('renders Enumeration header for element/enumeration', () => {
    renderNode('element', 'enumeration');
    expect(screen.getByText(/Enumeration:/i)).toBeInTheDocument();
  });

  it('renders Package header for element/package', () => {
    renderNode('element', 'package');
    expect(screen.getByText(/Contents/i)).toBeInTheDocument();
  });

  it('renders simple node for member type', () => {
    renderNode('member', 'attribute');
    expect(screen.getByText(/\+ member: Type/i)).toBeInTheDocument();
  });

  it('renders simple node for multiplicity type', () => {
    renderNode('multiplicity', 'one');
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders attributes list when attributes prop is provided', () => {
    renderNode('element', 'class', {
      className: 'MyClass',
      attributes: ['+ name: EString'],
    });
    expect(document.body.innerHTML).toContain('name');
  });

  it('renders methods list when methods prop is provided', () => {
    renderNode('element', 'class', {
      className: 'MyClass',
      methods: ['+ doSomething(): void'],
    });
    expect(screen.getByText(/doSomething/i)).toBeInTheDocument();
  });

  it('renders enum values for enumeration type', () => {
    renderNode('element', 'enumeration', {
      className: 'Color',
      values: ['RED', 'GREEN', 'BLUE'],
    });
    expect(screen.getByText('RED')).toBeInTheDocument();
    expect(screen.getByText('GREEN')).toBeInTheDocument();
  });

  it('renders delete button when selected', () => {
    render(
      <EditableNode
        {...baseNodeProps}
        selected={true}
        data={{ label: '', toolType: 'element', toolName: 'class' }}
      />,
    );
    const deleteButtons = screen.getAllByRole('button', { name: /×/i });
    expect(deleteButtons.length).toBeGreaterThan(0);
  });

  it('does not render delete button when not selected', () => {
    renderNode('element', 'class');
    expect(screen.queryByRole('button', { name: /×/i })).not.toBeInTheDocument();
  });

  it('renders 8 ReactFlow handles', () => {
    renderNode('element', 'class');
    expect(screen.getAllByTestId(/handle-/).length).toBe(8);
  });
});

describe('EditableNode – EditableField interactions', () => {
  it('shows edit input when field is double-clicked', () => {
    renderNode('element', 'class', { className: 'MyClass' });
    const field = screen.getByRole('button', { name: /MyClass/i });
    fireEvent.doubleClick(field);
    expect(screen.getByDisplayValue('MyClass')).toBeInTheDocument();
  });

  it('shows visibility options when "+ member: Type" field is clicked', () => {
    renderNode('member', 'attribute');
    const field = screen.getByRole('button', { name: /\+ member: Type/i });
    fireEvent.click(field);
    expect(screen.getByRole('button', { name: /\+ member: Type/i })).toBeInTheDocument();
  });
});