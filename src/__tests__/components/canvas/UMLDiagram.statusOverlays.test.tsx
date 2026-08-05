/* eslint-disable import/first, testing-library/no-container, testing-library/no-node-access */

jest.mock('../../../utils/ecoreToUml', () => require('../../../testSupport/umlDiagram/mockFactories').ecoreToUmlMock());
jest.mock('../../../utils/saveMetaModelEcore', () => ({
  __esModule: true,
  saveMetaModelEcore: jest.fn(),
}));
jest.mock('../../../utils/umlValidation', () => {
  const actual = jest.requireActual('../../../utils/umlValidation');
  return {
    ...actual,
    validateUmlModel: jest.fn(() => []),
  };
});
jest.mock('../../../components/canvas/UMLDiagramMinimap', () => require('../../../testSupport/umlDiagram/mockFactories').umlDiagramMinimapMock());
jest.mock('../../../utils/umlDiagramGeometry', () => require('../../../testSupport/umlDiagram/mockFactories').umlDiagramGeometryMock());
jest.mock('../../../utils/umlClassLayout', () => require('../../../testSupport/umlDiagram/mockFactories').umlClassLayoutMock());
jest.mock('../../../utils/umlLayoutStorage', () => require('../../../testSupport/umlDiagram/mockFactories').umlLayoutStorageMock());

import React, { createRef } from 'react';
import { act, fireEvent, screen } from '@testing-library/react';
import type { UMLDiagramHandle, UmlDiagramSaveTarget } from '../../../components/canvas/UMLDiagram';
import { saveMetaModelEcore } from '../../../utils/saveMetaModelEcore';
import {
  validateUmlModel,
  type UmlValidationIssue,
} from '../../../utils/umlValidation';
import { EMPTY_ECORE, SIMPLE_ECORE } from '../../../testSupport/umlDiagram/fixtures';
import { renderDiagram } from '../../../testSupport/umlDiagram/renderUtils';

const validateUmlModelMock = validateUmlModel as jest.MockedFunction<typeof validateUmlModel>;
const saveMetaModelEcoreMock = saveMetaModelEcore as jest.MockedFunction<typeof saveMetaModelEcore>;

function expectBefore(earlier: Element, later: Element): void {
  expect(
    earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
}

function getConnectBanner(container: HTMLElement): HTMLElement {
  const banner = container.querySelector<HTMLElement>('[data-uml-connect-banner]');
  expect(banner).not.toBeNull();
  return banner!;
}

function getValidationBanner(container: HTMLElement): HTMLElement {
  const banner = container.querySelector<HTMLElement>('[data-uml-validation]');
  expect(banner).not.toBeNull();
  return banner!;
}

function renderSavableDiagram(saveTarget: UmlDiagramSaveTarget) {
  const ref = createRef<UMLDiagramHandle>();
  const view = renderDiagram({
    ref,
    saveContext: {
      metaModelId: 'model-1',
      ecoreFileId: 42,
      modelName: 'simple',
      saveTarget,
    },
  });
  return { ...view, ref };
}

async function saveThroughHandle(ref: React.RefObject<UMLDiagramHandle | null>): Promise<void> {
  await act(async () => {
    await ref.current?.save();
  });
}

describe('UMLDiagram status overlays characterization', () => {
  beforeEach(() => {
    validateUmlModelMock.mockReset();
    validateUmlModelMock.mockReturnValue([]);
    saveMetaModelEcoreMock.mockReset();
    saveMetaModelEcoreMock.mockResolvedValue({
      ecoreContent: SIMPLE_ECORE,
      ecoreFileId: 42,
    });
  });

  describe('empty state', () => {
    it('shows the exact empty copy and lets an interactive user add the first class', () => {
      const { container } = renderDiagram({ ecoreContent: EMPTY_ECORE });

      expect(screen.getAllByText('No UML content found.')).toHaveLength(1);
      const addButton = screen.getByRole('button', { name: '+ Add class' });

      fireEvent.click(addButton);

      expect(screen.queryByText('No UML content found.')).not.toBeInTheDocument();
      expect(container.querySelectorAll('[data-classbox]')).toHaveLength(1);
    });

    it('does not offer add-class behavior in read-only mode', () => {
      renderDiagram({ ecoreContent: EMPTY_ECORE, interactive: false });

      expect(screen.getByText('No UML content found.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '+ Add class' })).not.toBeInTheDocument();
    });
  });

  describe('connect banner', () => {
    it('tracks source and target selection while preserving placement and DOM order', () => {
      const { container } = renderDiagram();

      fireEvent.click(screen.getByTitle('Connect two classes'));

      let banner = getConnectBanner(container);
      const toolbar = container.querySelector<HTMLElement>('[data-uml-toolbar]');
      expect(toolbar).not.toBeNull();
      expect(banner).toHaveTextContent('Click the source class, then the target class');
      expect(banner).toHaveStyle({
        position: 'absolute',
        top: '64px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: '32',
        pointerEvents: 'none',
      });
      expectBefore(banner, toolbar!);

      const classBoxes = container.querySelectorAll<HTMLElement>('[data-classbox]');
      fireEvent.click(classBoxes[0]);

      banner = getConnectBanner(container);
      expect(banner).toHaveTextContent('Click the target class to create a connection');

      fireEvent.click(classBoxes[1]);

      expect(container.querySelector('[data-uml-connect-banner]')).not.toBeInTheDocument();
    });
  });

  describe('save-message banner', () => {
    it('shows the workspace success variant after the toolbar and keeps the four-second timer', async () => {
      validateUmlModelMock.mockReturnValue([
        { severity: 'warning', message: 'Keep validation visible' },
      ]);
      const timeoutSpy = jest.spyOn(globalThis, 'setTimeout');
      const { container, ref } = renderSavableDiagram('workspace');

      await saveThroughHandle(ref);

      const toolbar = container.querySelector<HTMLElement>('[data-uml-toolbar]');
      const saveBanner = screen.getByText('Saved to project');
      const validationBanner = getValidationBanner(container);
      expect(saveBanner).toHaveStyle({
        background: '#ecfdf5',
        border: '1px solid #86efac',
        color: '#15803d',
      });
      expectBefore(toolbar!, saveBanner);
      expectBefore(saveBanner, validationBanner);
      expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 4000);

      timeoutSpy.mockRestore();
    });

    it('shows the library success copy with the current success variant', async () => {
      const { ref } = renderSavableDiagram('library');

      await saveThroughHandle(ref);

      expect(screen.getByText('Saved')).toHaveStyle({
        background: '#ecfdf5',
        border: '1px solid #86efac',
        color: '#15803d',
      });
    });

    it('propagates a rejected save message with the current error variant', async () => {
      saveMetaModelEcoreMock.mockRejectedValueOnce(new Error('Storage service unavailable'));
      const { ref } = renderSavableDiagram('library');

      await saveThroughHandle(ref);

      expect(screen.getByText('Storage service unavailable')).toHaveStyle({
        background: '#fef2f2',
        border: '1px solid #fecaca',
        color: '#dc2626',
      });
    });
  });

  describe('validation banner', () => {
    it('stays hidden with no issues and whenever the diagram is read-only', () => {
      const { container, unmount } = renderDiagram();
      expect(container.querySelector('[data-uml-validation]')).not.toBeInTheDocument();
      unmount();

      validateUmlModelMock.mockReturnValue([
        { severity: 'error', message: 'Read-only issue' },
      ]);
      const { container: readOnlyContainer } = renderDiagram({ interactive: false });
      expect(readOnlyContainer.querySelector('[data-uml-validation]')).not.toBeInTheDocument();
    });

    it('renders icons, limits output to four issues, and preserves overlay styles', () => {
      const issues: UmlValidationIssue[] = [
        { severity: 'error', message: 'Error one' },
        { severity: 'warning', message: 'Warning two' },
        { severity: 'error', message: 'Error three' },
        { severity: 'warning', message: 'Warning four' },
        { severity: 'error', message: 'Hidden five' },
        { severity: 'warning', message: 'Hidden six' },
      ];
      validateUmlModelMock.mockReturnValue(issues);

      const { container } = renderDiagram();
      const banner = getValidationBanner(container);

      expect(banner).toHaveTextContent('⛔ Error one');
      expect(banner).toHaveTextContent('⚠ Warning two');
      expect(banner).toHaveTextContent('⛔ Error three');
      expect(banner).toHaveTextContent('⚠ Warning four');
      expect(banner).not.toHaveTextContent('Hidden five');
      expect(banner).not.toHaveTextContent('Hidden six');
      expect(banner).toHaveTextContent('+2 more issue(s)');
      expect(banner).toHaveStyle({
        position: 'absolute',
        top: '64px',
        left: '12px',
        right: '12px',
        zIndex: '31',
        maxHeight: '72px',
        overflowY: 'auto',
      });
    });

    it('keeps class and relationship panel insets independent', () => {
      validateUmlModelMock.mockReturnValue([
        { severity: 'warning', message: 'Inset issue' },
      ]);
      const { container } = renderDiagram();

      let banner = getValidationBanner(container);
      expect(banner).toHaveStyle({ left: '12px', right: '12px' });

      const firstClass = container.querySelector<HTMLElement>('[data-classbox]');
      expect(firstClass).not.toBeNull();
      fireEvent.click(firstClass!);
      banner = getValidationBanner(container);
      expect(banner).toHaveStyle({ left: '288px', right: '12px' });

      const relationship = container.querySelector<HTMLElement>('[data-rel-hit-line]');
      expect(relationship).not.toBeNull();
      fireEvent.click(relationship!);
      banner = getValidationBanner(container);
      expect(banner).toHaveStyle({ left: '288px', right: '320px' });

      const closeClassPanel = container.querySelector<HTMLElement>(
        '[data-class-edit-panel] button[title="Close panel"]',
      );
      expect(closeClassPanel).not.toBeNull();
      fireEvent.click(closeClassPanel!);
      banner = getValidationBanner(container);
      expect(banner).toHaveStyle({ left: '12px', right: '320px' });
    });
  });
});
