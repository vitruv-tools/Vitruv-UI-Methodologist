import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToastProvider, useToast } from '../../../components/ui/ToastProvider';

const TestComponent: React.FC = () => {
  const { showSuccess } = useToast();

  return (
    <button
      type="button"
      onClick={() => showSuccess('Success message')}
    >
      Show Toast
    </button>
  );
};

describe('ToastProvider', () => {
  it('shows a success toast when showSuccess is called', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText(/Show Toast/i));

    expect(screen.getByText(/Success message/i)).toBeInTheDocument();
  });
});

