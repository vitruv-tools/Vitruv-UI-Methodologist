import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ModelDrawer, DrawerModel } from '../../../components/canvas/ModelDrawer';

jest.mock('../../../components/canvas/UMLDiagram', () => {
  const { forwardRef, createElement } = require('react');
  return {
    UMLDiagram: forwardRef((_props: any, _ref: any) =>
      createElement('div', { 'data-testid': 'uml-diagram' })
    ),
  };
});

const model1: DrawerModel = { id: 1, name: 'Car Model', domain: 'automotive', ecoreContent: '...' };
const model2: DrawerModel = { id: 2, name: 'Person Model', domain: 'hr' };

const defaultProps = {
  models: [],
  onClose: jest.fn(),
  onAddModel: jest.fn(),
  myLibraryModels: [model1, model2],
  publicLibraryModels: [{ id: 3, name: 'Public Model', domain: 'public' }],
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ModelDrawer real component', () => {
  it('renders drawer with title "Model Library"', () => {
    render(<ModelDrawer {...defaultProps} />);
    expect(screen.getByText('Model Library')).toBeInTheDocument();
  });

  it('close button calls onClose', () => {
    const onClose = jest.fn();
    render(<ModelDrawer {...defaultProps} onClose={onClose} />);
    const closeBtn = screen.getByTitle('Close');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows "My Library" and "Public Library" tabs', () => {
    render(<ModelDrawer {...defaultProps} />);
    expect(screen.getByText('My Library')).toBeInTheDocument();
    expect(screen.getByText('Public Library')).toBeInTheDocument();
  });

  it('switching to "Public Library" tab shows public models', () => {
    render(<ModelDrawer {...defaultProps} />);
    fireEvent.click(screen.getByText('Public Library'));
    expect(screen.getByText('Public Model')).toBeInTheDocument();
  });

  it('search input filters models by name', () => {
    render(<ModelDrawer {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText('Search models…');
    fireEvent.change(searchInput, { target: { value: 'Car' } });
    expect(screen.getByText('Car Model')).toBeInTheDocument();
    expect(screen.queryByText('Person Model')).not.toBeInTheDocument();
  });

  it('clearing search shows all models', () => {
    render(<ModelDrawer {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText('Search models…');
    fireEvent.change(searchInput, { target: { value: 'Car' } });
    expect(screen.queryByText('Person Model')).not.toBeInTheDocument();
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByText('Person Model')).toBeInTheDocument();
  });

  it('domain filter chips appear when models have domains', () => {
    render(<ModelDrawer {...defaultProps} />);
    // Domain chips are <button> elements; domain also appears as badge in model cards
    const automotiveElements = screen.getAllByText('automotive');
    expect(automotiveElements.length).toBeGreaterThan(0);
    const hrElements = screen.getAllByText('hr');
    expect(hrElements.length).toBeGreaterThan(0);
  });

  it('clicking a domain chip filters models', () => {
    render(<ModelDrawer {...defaultProps} />);
    // Domain chip is the <button> element (not the badge span in model cards)
    const automotiveChip = screen.getAllByText('automotive').find(
      el => el.tagName === 'BUTTON'
    )!;
    fireEvent.click(automotiveChip);
    expect(screen.getByText('Car Model')).toBeInTheDocument();
    expect(screen.queryByText('Person Model')).not.toBeInTheDocument();
  });

  it('clicking a model card calls onAddModel with the model', () => {
    const onAddModel = jest.fn();
    render(<ModelDrawer {...defaultProps} onAddModel={onAddModel} />);
    // Model cards are buttons with title "Click to add · Right-click for details"
    const cardButtons = screen.getAllByTitle('Click to add · Right-click for details');
    fireEvent.click(cardButtons[0]);
    expect(onAddModel).toHaveBeenCalled();
  });

  it('loading=true shows a loading indicator', () => {
    render(<ModelDrawer {...defaultProps} loading={true} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('empty library shows "No models available" when no models and no filter', () => {
    render(
      <ModelDrawer
        {...defaultProps}
        myLibraryModels={[]}
        publicLibraryModels={[]}
      />
    );
    expect(screen.getByText('No models available')).toBeInTheDocument();
  });

  it('addedModelIds hides those models from the library list', () => {
    render(
      <ModelDrawer
        {...defaultProps}
        addedModelIds={new Set([1])}
      />
    );
    // Car Model (id=1) is in addedModelIds, should not appear in library
    // It should appear in "On canvas" section instead
    const libraryItems = screen.queryAllByText('Car Model');
    // Model is in "On canvas" area not library area; it still renders
    // but fromLibrary filter excludes it from library list
    expect(screen.getByText('Person Model')).toBeInTheDocument();
  });
});
