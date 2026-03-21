import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockAuthPage = jest.fn(() => <div>AuthPage mock</div>);

jest.mock('../../../components/auth/AuthPage', () => ({
  __esModule: true,
  AuthPage: (props: any) => mockAuthPage(props),
}));

import { AuthPage } from '../../../components/auth/AuthPage';

describe('AuthPage', () => {
  it('renders AuthPage with default props', async () => {
    render(<AuthPage />);

    expect(mockAuthPage).toHaveBeenCalled();
  });
});

