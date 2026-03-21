import React from 'react';
import { render, screen } from '@testing-library/react';
import { KeycloakRedirect } from '../../../components/auth/KeycloakRedirect';

describe('KeycloakRedirect', () => {
  it('renders redirect message', () => {
    render(<KeycloakRedirect />);

    expect(
      screen.getByText(/Redirecting to Keycloak authentication/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/If you are not redirected automatically/i),
    ).toBeInTheDocument();
  });
});

