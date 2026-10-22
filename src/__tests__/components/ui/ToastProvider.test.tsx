import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast } from '../../../components/ui/ToastProvider';

const TestComponent: React.FC = () => {
  const { showSuccess, showError } = useToast();

  return (
    <>
      <button type="button" onClick={() => showSuccess('Success message')}>
        Show Toast
      </button>
      <button
        type="button"
        onClick={() => showError('org.example.FooException: Could not save the project')}
      >
        Show Error
      </button>
    </>
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

  it('keeps an error toast until it is closed and shows the backend message', () => {
    jest.useFakeTimers();
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText(/Show Error/i));
    expect(screen.getByText('org.example.FooException: Could not save the project')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy error message' })).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(10000);
    });
    expect(screen.getByText('org.example.FooException: Could not save the project')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('org.example.FooException: Could not save the project')).not.toBeInTheDocument();
    jest.useRealTimers();
  });
});
