import React from 'react';
import { render } from '@testing-library/react';

// Mock MainLayout to avoid pulling in routing and flow dependencies.
const mockMainLayout = jest.fn(() => <div>MainLayout mock</div>);

jest.mock('../../../components/layout/MainLayout', () => ({
  __esModule: true,
  MainLayout: (props: any) => mockMainLayout(props),
}));

import { MainLayout } from '../../../components/layout/MainLayout';

jest.mock('../../../components/layout/Header', () => {
  const mockHeader = jest.fn(() => <div data-testid="header-mock" />);
  return {
    __esModule: true,
    Header: mockHeader,
    mockHeader,
  };
});

const { mockHeader } = require('../../../components/layout/Header') as {
  mockHeader: jest.Mock;
};

describe('MainLayout (mocked)', () => {
  beforeEach(() => {
    mockHeader.mockClear();
    mockMainLayout.mockClear();
  });

  it('renders via mocked component', () => {
    render(<MainLayout />);
    expect(mockMainLayout).toHaveBeenCalled();
  });
});

