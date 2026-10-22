import type { Mock } from 'vitest';
/* eslint-disable import/first */

vi.mock('../../../utils/ecoreToUml', async () => (await import('../../../testSupport/umlDiagram/mockFactories')).ecoreToUmlMock());
vi.mock('../../../utils/saveMetaModelEcore', async () => (await import('../../../testSupport/umlDiagram/mockFactories')).saveMetaModelEcoreMock());
vi.mock('../../../components/canvas/UMLDiagramMinimap', async () => (await import('../../../testSupport/umlDiagram/mockFactories')).umlDiagramMinimapMock());
vi.mock('../../../utils/umlDiagramGeometry', async () => (await import('../../../testSupport/umlDiagram/mockFactories')).umlDiagramGeometryMock());
vi.mock('../../../utils/umlClassLayout', async () => (await import('../../../testSupport/umlDiagram/mockFactories')).umlClassLayoutMock());
vi.mock('../../../utils/umlLayoutStorage', async () => (await import('../../../testSupport/umlDiagram/mockFactories')).umlLayoutStorageMock());
vi.mock('react-dom', async () => {
  const actual = await vi.importActual<any>('react-dom');
  const mocked = {
    ...actual,
    createPortal: (node: unknown) => node,
  };
  return { ...mocked, default: mocked };
});

import { createRef } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UMLDiagramHandle, UmlDiagramSaveTarget } from '../../../components/canvas/UMLDiagram';
import { FloatingUMLPanel } from '../../../components/canvas/FloatingUMLPanel';
import { useUmlClassClipboardStore } from '../../../store/UmlClassClipboard';
import { saveMetaModelEcore } from '../../../utils/saveMetaModelEcore';
import { EMPTY_ECORE, REF_ECORE, SIMPLE_ECORE } from '../../../testSupport/umlDiagram/fixtures';
import { renderDiagram } from '../../../testSupport/umlDiagram/renderUtils';

const win = globalThis as unknown as Window;
const saveToLibrary = saveMetaModelEcore as Mock;

const CLASS_LABEL = /^UML (?:class|abstract class|interface) ([^,]+)/;

function classBox(className: string, scope: HTMLElement): HTMLElement {
  const label = new RegExp(String.raw`^UML (class|abstract class|interface) ${className}(,|$)`);
  return within(scope).getByRole('group', { name: label });
}

function classNames(scope: HTMLElement): string[] {
  return within(scope)
    .queryAllByRole('group', { name: CLASS_LABEL })
    .map(box => CLASS_LABEL.exec(box.getAttribute('aria-label') ?? '')?.[1] ?? '');
}

/** Clicks the canvas of an editor, which makes it the one that receives Ctrl/Cmd+C and V. */
function switchToEditor(scope: HTMLElement) {
  fireEvent.mouseDown(within(scope).getByRole('region', { name: 'UML diagram canvas' }), { button: 0 });
  fireEvent.mouseUp(win, { button: 0 });
}

function copyClasses(scope: HTMLElement, ...names: string[]) {
  for (const name of names) {
    fireEvent.click(classBox(name, scope), { shiftKey: true });
  }
  fireEvent.keyDown(win, { key: 'c', ctrlKey: true });
}

function paste() {
  fireEvent.keyDown(win, { key: 'v', ctrlKey: true });
}

function undo() {
  fireEvent.keyDown(win, { key: 'z', ctrlKey: true });
}

function openDiagram(props: Parameters<typeof renderDiagram>[0] = {}) {
  const ref = createRef<UMLDiagramHandle>();
  const { container, unmount } = renderDiagram({ ref, ...props });
  const model = () => ref.current!.getModel();
  const classIds = () => model().classes.map(classItem => classItem.id);
  return { container, unmount, ref, model, classIds };
}

/** Copies classes of the Person/Employee model (Employee inherits from Person), then closes that model. */
function copyFromClosedModel(...names: string[]) {
  const source = openDiagram({ ecoreContent: SIMPLE_ECORE });
  copyClasses(source.container, ...names);
  source.unmount();
}

beforeEach(() => {
  useUmlClassClipboardStore.setState({ snapshot: null, editorIds: [] });
  vi.clearAllMocks();
});

describe('pasting copied classes into another model', () => {
  it('pastes classes from a closed model and recreates the relationships between them', () => {
    copyFromClosedModel('Person', 'Employee');

    const target = openDiagram({ ecoreContent: REF_ECORE });
    paste();

    expect(target.classIds()).toEqual(['Order', 'LineItem', 'Person', 'Employee']);
    expect(target.model().classes[2]).toEqual(expect.objectContaining({
      name: 'Person',
      attributes: [expect.objectContaining({ id: 'Person-0', name: 'name', type: 'String' })],
    }));
    expect(target.model().relationships).toEqual([
      expect.objectContaining({ id: 'rel-order-lines', sourceId: 'Order', targetId: 'LineItem' }),
      expect.objectContaining({ sourceId: 'Employee', targetId: 'Person', type: 'inheritance' }),
    ]);
    expect(classBox('Person', target.container)).toHaveAttribute('aria-selected', 'true');
    expect(classBox('Employee', target.container)).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps the copied classes while the user switches between models', () => {
    copyFromClosedModel('Person');
    const otherModel = openDiagram({ ecoreContent: REF_ECORE });
    otherModel.unmount();

    const emptyModel = openDiagram({ ecoreContent: EMPTY_ECORE });
    paste();

    expect(emptyModel.classIds()).toEqual(['Person']);
  });

  it('renames pasted classes whose names already exist in the target model', () => {
    copyFromClosedModel('Person', 'Employee');

    const target = openDiagram({ ecoreContent: SIMPLE_ECORE });
    paste();

    expect(target.classIds()).toEqual(['Person', 'Employee', 'Person_copy', 'Employee_copy']);
    expect(target.model().relationships).toEqual([
      expect.objectContaining({ id: 'rel-inherit', sourceId: 'Employee', targetId: 'Person' }),
      expect.objectContaining({ sourceId: 'Employee_copy', targetId: 'Person_copy', type: 'inheritance' }),
    ]);
  });

  it('leaves the source model unchanged', () => {
    const source = openDiagram({ ecoreContent: SIMPLE_ECORE });
    const target = openDiagram({ ecoreContent: REF_ECORE });
    const sourceBefore = structuredClone(source.model());

    switchToEditor(source.container);
    copyClasses(source.container, 'Person', 'Employee');
    switchToEditor(target.container);
    paste();

    expect(target.classIds()).toEqual(['Order', 'LineItem', 'Person', 'Employee']);
    expect(source.model()).toEqual(sourceBefore);
    expect(source.ref.current!.isDirty()).toBe(false);
  });

  it('removes the pasted classes with one undo and saves nothing until Save is clicked', () => {
    copyFromClosedModel('Person', 'Employee');
    const onSaved = vi.fn();
    const target = openDiagram({
      ecoreContent: REF_ECORE,
      saveContext: {
        metaModelId: '2', ecoreFileId: 20, modelName: 'orders', saveTarget: 'workspace', onSaved,
      },
    });

    paste();
    expect(target.ref.current!.isDirty()).toBe(true);
    expect(onSaved).not.toHaveBeenCalled();
    expect(saveToLibrary).not.toHaveBeenCalled();

    undo();

    expect(target.classIds()).toEqual(['Order', 'LineItem']);
    expect(target.model().relationships.map(relationship => relationship.id)).toEqual(['rel-order-lines']);
  });

  it('is not available when the target editor is read-only', () => {
    const source = openDiagram({ ecoreContent: SIMPLE_ECORE });
    copyClasses(source.container, 'Person');
    const { container: readOnlyEditor } = render(
      <FloatingUMLPanel
        id="read-only"
        title="Read-only model"
        fileName="orders.ecore"
        layoutScopeId="test"
        ecoreContent={REF_ECORE}
        viewOnly
        zIndex={1}
        onFocus={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    switchToEditor(readOnlyEditor);
    paste();

    expect(classNames(readOnlyEditor)).toEqual(['Order', 'LineItem']);
    expect(source.classIds()).toEqual(['Person', 'Employee']);
  });

  it('pastes into the open editor when a read-only preview finishes loading after it', () => {
    copyFromClosedModel('Person');
    const editor = openDiagram({ ecoreContent: REF_ECORE });

    renderDiagram({ ecoreContent: REF_ECORE, interactive: false });
    paste();

    expect(editor.classIds()).toEqual(['Order', 'LineItem', 'Person']);
  });
});

describe('pasting between the Model library and projects', () => {
  interface ModelLocation {
    layoutScopeId: string;
    saveTarget: UmlDiagramSaveTarget;
  }
  const LIBRARY: ModelLocation = { layoutScopeId: 'metamodel-preview', saveTarget: 'library' };
  const PROJECT: ModelLocation = { layoutScopeId: 'project-1', saveTarget: 'workspace' };
  const OTHER_PROJECT: ModelLocation = { layoutScopeId: 'project-2', saveTarget: 'workspace' };

  function openEditor(location: ModelLocation, ecoreContent: string, onSaved = vi.fn()) {
    return render(
      <FloatingUMLPanel
        id={`${location.layoutScopeId}-panel`}
        title="Model"
        fileName={`${location.layoutScopeId}.ecore`}
        layoutScopeId={location.layoutScopeId}
        ecoreContent={ecoreContent}
        saveContext={{
          metaModelId: '7',
          ecoreFileId: 70,
          modelName: 'model',
          saveTarget: location.saveTarget,
          onSaved,
        }}
        zIndex={1}
        onFocus={vi.fn()}
        onClose={vi.fn()}
      />,
    );
  }

  /** Classes the target's save sent on: Model library models go to the library API, project models to the project. */
  async function savedClassNames(location: ModelLocation, onSaved: Mock): Promise<string[]> {
    if (location.saveTarget === 'library') {
      await waitFor(() => expect(saveToLibrary).toHaveBeenCalledTimes(1));
      return saveToLibrary.mock.calls[0][0].model.classes.map((classItem: { name: string }) => classItem.name);
    }
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const { ecoreContent } = onSaved.mock.calls[0][0] as { ecoreContent: string };
    return [...ecoreContent.matchAll(/xsi:type="ecore:EClass" name="([^"]+)"/g)].map(match => match[1]);
  }

  beforeEach(() => {
    saveToLibrary.mockResolvedValue({ ecoreContent: REF_ECORE, ecoreFileId: 71 });
  });

  it.each([
    ['between two models of the same project', PROJECT, PROJECT],
    ['between projects', PROJECT, OTHER_PROJECT],
    ['from the Model library to a project', LIBRARY, PROJECT],
    ['from a project to the Model library', PROJECT, LIBRARY],
  ])('pastes %s and saves the classes into the target model', async (_direction, from, to) => {
    const { container: sourceEditor, unmount: closeSourceEditor } = openEditor(from, SIMPLE_ECORE);
    copyClasses(sourceEditor, 'Person', 'Employee');
    closeSourceEditor();

    const onSaved = vi.fn();
    const { container: targetEditor } = openEditor(to, REF_ECORE, onSaved);
    paste();

    expect(classNames(targetEditor)).toEqual(['Order', 'LineItem', 'Person', 'Employee']);
    expect(saveToLibrary).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTitle(to.saveTarget === 'library' ? 'Save metamodel changes' : 'Save changes to project'));

    expect(await savedClassNames(to, onSaved)).toEqual(['Order', 'LineItem', 'Person', 'Employee']);
  });

  /**
   * Stand-in for a model card on the project canvas (EcoreFileBox): it keeps
   * the focus after a double-click opens the UML editor, and stops every key.
   */
  function ModelCard({ name }: Readonly<{ name: string }>) {
    return <div role="button" tabIndex={0} aria-label={name} onKeyDown={event => event.stopPropagation()} />;
  }

  /** Presses Ctrl+key the way the browser does: on the focused element. */
  function pressOnFocusedElement(key: string) {
    userEvent.keyboard(`{Control>}${key}{/Control}`);
  }

  it('copies and pastes in models opened from their cards on the project canvas', () => {
    render(<><ModelCard name="Model A" /><ModelCard name="Model B" /></>);

    screen.getByRole('button', { name: 'Model A' }).focus();
    const { container: sourceEditor, unmount: closeSourceEditor } = openEditor(PROJECT, SIMPLE_ECORE);
    fireEvent.click(classBox('Person', sourceEditor));
    pressOnFocusedElement('c');
    closeSourceEditor();

    screen.getByRole('button', { name: 'Model B' }).focus();
    const { container: targetEditor } = openEditor(PROJECT, REF_ECORE);
    pressOnFocusedElement('v');

    expect(classNames(targetEditor)).toEqual(['Order', 'LineItem', 'Person']);
  });
});
