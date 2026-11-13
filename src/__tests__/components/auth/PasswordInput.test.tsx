import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordInput } from '../../../components/auth/PasswordInput';

function PasswordField({
  id = 'password',
  disabled = false,
  onSubmit = jest.fn(),
}: {
  id?: string;
  disabled?: boolean;
  onSubmit?: () => void;
}) {
  const [value, setValue] = useState('Example1!');
  return (
    <form onSubmit={event => { event.preventDefault(); onSubmit(); }}>
      <label htmlFor={id}>{id}</label>
      <PasswordInput
        id={id}
        name={id}
        value={value}
        onChange={event => setValue(event.target.value)}
        disabled={disabled}
      />
    </form>
  );
}

describe('PasswordInput visibility', () => {
  it('toggles on every click without changing the value or submitting the form', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(<PasswordField onSubmit={onSubmit} />);
    const input = screen.getByLabelText('password');
    const toggle = screen.getByRole('button', { name: 'Show password' });

    for (let click = 0; click < 6; click++) {
      await user.click(toggle);
      const visible = click % 2 === 0;
      expect(input).toHaveAttribute('type', visible ? 'text' : 'password');
      expect(input).toHaveValue('Example1!');
      expect(toggle).toHaveAccessibleName(visible ? 'Hide password' : 'Show password');
      expect(toggle).toHaveAttribute('aria-pressed', String(visible));
    }
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('supports Tab, Space, and Enter without submitting the form', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(<PasswordField onSubmit={onSubmit} />);
    const input = screen.getByLabelText('password');
    const toggle = screen.getByRole('button', { name: 'Show password' });

    await user.click(input);
    await user.tab();
    expect(toggle).toHaveFocus();
    await user.keyboard(' ');
    expect(input).toHaveAttribute('type', 'text');
    await user.keyboard('{Enter}');
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveValue('Example1!');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps password and confirmation visibility independent', async () => {
    const user = userEvent.setup();
    render(<><PasswordField /><PasswordField id="confirmation" /></>);

    await user.click(screen.getAllByRole('button', { name: 'Show password' })[0]);
    expect(screen.getByLabelText('password')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('confirmation')).toHaveAttribute('type', 'password');
  });

  it('does not reveal a disabled password field', async () => {
    const user = userEvent.setup();
    render(<PasswordField disabled />);
    const toggle = screen.getByRole('button', { name: 'Show password' });

    expect(toggle).toBeDisabled();
    await user.click(toggle);
    expect(screen.getByLabelText('password')).toHaveAttribute('type', 'password');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });
});
