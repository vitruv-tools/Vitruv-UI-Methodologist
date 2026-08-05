/* eslint-disable testing-library/no-container, testing-library/no-node-access */

import { fireEvent, render, screen } from '@testing-library/react';
import {
  UMLDiagramConnectBanner,
  UMLDiagramEmptyState,
  UMLDiagramSaveMessageBanner,
  UMLDiagramValidationBanner,
} from '../../../components/canvas/UMLDiagramStatusOverlays';
import type { UmlValidationIssue } from '../../../utils/umlValidation';

function expectCenteredOverlay(element: HTMLElement): void {
  expect(element).toHaveStyle({
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    textAlign: 'center',
    pointerEvents: 'none',
  });
}

describe('UMLDiagramEmptyState', () => {
  it('preserves empty copy, interactive behavior, background, and layout', () => {
    const onAddClass = jest.fn();
    const { container } = render(
      <UMLDiagramEmptyState interactive onAddClass={onAddClass} />,
    );

    expect(screen.getByText('No UML content found.')).toBeInTheDocument();
    const addButton = screen.getByRole('button', { name: '+ Add class' });
    expect(addButton).toHaveAttribute('type', 'button');

    fireEvent.click(addButton);

    expect(onAddClass).toHaveBeenCalledTimes(1);
    const emptyState = container.firstElementChild as HTMLElement;
    expect(emptyState).toHaveStyle({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      backgroundColor: '#f3f4f6',
      backgroundImage: 'radial-gradient(circle, #d1d5db 0.75px, transparent 0.75px)',
      backgroundSize: '24px 24px',
    });
  });

  it('hides the add-class button in read-only mode', () => {
    render(<UMLDiagramEmptyState interactive={false} onAddClass={jest.fn()} />);

    expect(screen.getByText('No UML content found.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Add class' })).not.toBeInTheDocument();
  });
});

describe('UMLDiagramConnectBanner', () => {
  it('preserves source and target instructions, selector, and overlay styles', () => {
    const { container, rerender } = render(
      <UMLDiagramConnectBanner connectSourceId={null} />,
    );

    let banner = container.querySelector<HTMLElement>('[data-uml-connect-banner]');
    expect(banner).not.toBeNull();
    expect(banner).toHaveTextContent('Click the source class, then the target class');
    expectCenteredOverlay(banner!);
    expect(banner).toHaveStyle({
      top: '64px',
      zIndex: '32',
    });
    expect(banner!.style.maxWidth).toBe('min(420px, calc(100vw - 320px))');

    rerender(<UMLDiagramConnectBanner connectSourceId="Person" />);

    banner = container.querySelector<HTMLElement>('[data-uml-connect-banner]');
    expect(banner).toHaveTextContent('Click the target class to create a connection');
  });
});

describe('UMLDiagramSaveMessageBanner', () => {
  it.each(['Saved', 'Saved to project'])('%s uses the success presentation', message => {
    render(<UMLDiagramSaveMessageBanner message={message} />);

    const banner = screen.getByText(message);
    expect(banner).toHaveStyle({
      background: '#ecfdf5',
      border: '1px solid #86efac',
      color: '#15803d',
      top: '14px',
      zIndex: '50',
    });
    expectCenteredOverlay(banner);
    expect(banner.style.maxWidth).toBe('min(480px, 90vw)');
  });

  it('uses the error presentation for any other message', () => {
    render(<UMLDiagramSaveMessageBanner message="Save failed exactly" />);

    const banner = screen.getByText('Save failed exactly');
    expect(banner).toHaveStyle({
      background: '#fef2f2',
      border: '1px solid #fecaca',
      color: '#dc2626',
      top: '14px',
      zIndex: '50',
    });
    expectCenteredOverlay(banner);
    expect(banner.style.maxWidth).toBe('min(480px, 90vw)');
  });
});

describe('UMLDiagramValidationBanner', () => {
  const sixIssues: UmlValidationIssue[] = [
    { severity: 'warning', message: 'Warning one' },
    { severity: 'error', message: 'Error two' },
    { severity: 'warning', message: 'Warning three' },
    { severity: 'error', message: 'Error four' },
    { severity: 'warning', message: 'Hidden five' },
    { severity: 'error', message: 'Hidden six' },
  ];

  it('preserves icons, the first-four limit, remaining count, selector, and scrolling styles', () => {
    const { container } = render(
      <UMLDiagramValidationBanner
        issues={sixIssues}
        classPanelOpen={false}
        relationshipPanelOpen={false}
      />,
    );

    const banner = container.querySelector<HTMLElement>('[data-uml-validation]');
    expect(banner).not.toBeNull();
    expect(banner).toHaveTextContent('⚠ Warning one');
    expect(banner).toHaveTextContent('⛔ Error two');
    expect(banner).toHaveTextContent('⚠ Warning three');
    expect(banner).toHaveTextContent('⛔ Error four');
    expect(banner).not.toHaveTextContent('Hidden five');
    expect(banner).not.toHaveTextContent('Hidden six');
    expect(banner).toHaveTextContent('+2 more issue(s)');
    expect(banner).toHaveStyle({
      position: 'absolute',
      top: '64px',
      zIndex: '31',
      maxHeight: '72px',
      overflowY: 'auto',
    });
  });

  it('does not show a remaining count for four or fewer issues', () => {
    render(
      <UMLDiagramValidationBanner
        issues={sixIssues.slice(0, 4)}
        classPanelOpen={false}
        relationshipPanelOpen={false}
      />,
    );

    expect(screen.queryByText(/more issue\(s\)/)).not.toBeInTheDocument();
  });

  it('applies independent insets for no panel, each panel, and both panels', () => {
    const { container, rerender } = render(
      <UMLDiagramValidationBanner
        issues={sixIssues}
        classPanelOpen={false}
        relationshipPanelOpen={false}
      />,
    );
    const validationBanner = () => (
      container.querySelector<HTMLElement>('[data-uml-validation]')!
    );

    expect(validationBanner()).toHaveStyle({ left: '12px', right: '12px' });

    rerender(
      <UMLDiagramValidationBanner
        issues={sixIssues}
        classPanelOpen
        relationshipPanelOpen={false}
      />,
    );
    expect(validationBanner()).toHaveStyle({ left: '288px', right: '12px' });

    rerender(
      <UMLDiagramValidationBanner
        issues={sixIssues}
        classPanelOpen={false}
        relationshipPanelOpen
      />,
    );
    expect(validationBanner()).toHaveStyle({ left: '12px', right: '320px' });

    rerender(
      <UMLDiagramValidationBanner
        issues={sixIssues}
        classPanelOpen
        relationshipPanelOpen
      />,
    );
    expect(validationBanner()).toHaveStyle({ left: '288px', right: '320px' });
  });
});
