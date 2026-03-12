import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Header } from '../../../components/layout/Header';
import type { User } from '../../../services/auth';

jest.mock('../../../services/api', () => ({
  apiService: {
    getUserInfo: jest.fn().mockResolvedValue({
      data: {
        id: 1,
        email: 'api@example.com',
        firstName: 'Api',
        lastName: 'User',
      },
      message: null,
    }),
    changePassword: jest.fn().mockResolvedValue({
      data: {},
      message: 'Password changed successfully!',
    }),
  },
}));

const { apiService } = require('../../../services/api') as {
  apiService: {
    getUserInfo: jest.Mock;
    changePassword: jest.Mock;
  };
};

const baseUser: User = {
  id: 'u1',
  username: 'john',
  email: 'john@example.com',
  name: 'John Doe',
  emailVerified: true,
};

describe('Header', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title', () => {
    render(<Header title="My Title" user={baseUser} />);

    expect(screen.getByText('My Title')).toBeInTheDocument();
  });
});

