import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MetaModelFileDownloads } from '../../../components/ui/MetaModelFileDownloads';
import { apiService } from '../../../services/api';

jest.mock('../../../services/api', () => ({
  apiService: { getFile: jest.fn() },
}));

describe('MetaModelFileDownloads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiService.getFile as jest.Mock).mockResolvedValue('<ecore/>');
  });

  it('renders download buttons when file ids are present', () => {
    render(
      <MetaModelFileDownloads
        modelName="MyModel"
        ecoreFileId={1}
        genModelFileId={2}
      />,
    );
    expect(screen.getByRole('button', { name: 'Download .ecore' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download .genmodel' })).toBeInTheDocument();
  });

  it('fetches file content when ecore download is clicked', async () => {
    render(<MetaModelFileDownloads modelName="MyModel" ecoreFileId={10} />);
    fireEvent.click(screen.getByRole('button', { name: 'Download .ecore' }));
    await waitFor(() => {
      expect(apiService.getFile).toHaveBeenCalledWith(10);
    });
  });
});
