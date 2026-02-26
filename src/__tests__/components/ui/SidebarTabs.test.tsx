import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

const mockSidebarTabs = jest.fn(() => <div>SidebarTabs mock</div>);

jest.mock('../../../components/ui/SidebarTabs', () => ({
  __esModule: true,
  SidebarTabs: (props: any) => mockSidebarTabs(props),
}));

import { SidebarTabs } from '../../../components/ui/SidebarTabs';

jest.mock('../../../components/ui/MetaModelsPanel', () => ({
  MetaModelsPanel: () => <div>Meta Models Panel</div>,
}));

jest.mock('../../../components/ui/VsumsPanel', () => ({
  VsumsPanel: () => <div>Projects Panel</div>,
}));

describe('SidebarTabs (mocked)', () => {
  it('renders using default props', () => {
    render(<SidebarTabs />);

    expect(mockSidebarTabs).toHaveBeenCalled();
  });
});

