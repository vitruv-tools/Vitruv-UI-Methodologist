import type { Mocked } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { HelpersModal } from '../../../components/helpers/HelpersModal';
import { apiService, type HelperResponse, type HelperTypeResponse } from '../../../services/api';

vi.mock('@monaco-editor/react', () => {
  const mockReact = require('react');
  const MockEditor = ({ value, onChange, onMount, language }: any) => {
    mockReact.useEffect(() => {
      onMount?.(
        { getModel: () => mockEditorModel.current },
        {
          editor: { setModelMarkers: mockSetModelMarkers },
          MarkerSeverity: { Error: 8 },
          languages: {
            registerCompletionItemProvider: mockRegisterCompletion,
            CompletionItemKind: { Function: 1 },
            CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
          },
        },
      );
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return mockReact.createElement('textarea', {
      'data-testid': `monaco-${language}`,
      value: value ?? '',
      readOnly: !onChange,
      onChange: (e: any) => onChange?.(e.target.value),
    });
  };
  return { __esModule: true, default: MockEditor };
});

const mockSetModelMarkers = vi.fn();
const mockEditorModel: { current: any } = { current: null };
const mockRegisterCompletion = vi.fn((..._args: any[]) => ({ dispose: vi.fn() }));

vi.mock('../../../services/api', () => ({
  apiService: {
    getHelpers: vi.fn(),
    getHelperTypes: vi.fn(),
    getHelperClass: vi.fn(),
    createHelper: vi.fn(),
    updateHelper: vi.fn(),
    deleteHelper: vi.fn(),
    previewHelper: vi.fn(),
    checkHelperName: vi.fn(),
  },
}));

const api = apiService as Mocked<typeof apiService>;

const types: HelperTypeResponse[] = [
  { metamodel: 'simulink', name: 'SimulinkModel', qualifiedName: 'simulink::SimulinkModel', kind: 'CLASS', javaName: 'x.SimulinkModel' },
  { metamodel: 'simulink', name: 'SubSystem', qualifiedName: 'simulink::SubSystem', kind: 'CLASS', javaName: 'x.SubSystem' },
];

const subSystems: HelperResponse = {
  id: 1,
  vsumId: 7,
  name: 'getAllSubSystems',
  description: 'All subsystems, including nested ones.',
  returnType: 'Sequence(simulink::SubSystem)',
  parameters: [{ name: 'model', type: 'simulink::SimulinkModel' }],
  imports: ['simulink::*'],
  body: 'model.contains->selectByKind(SubSystem)->closure(s | s.subBlocks->selectByKind(SubSystem))',
  oclDefinition: 'helper def : getAllSubSystems(model : simulink::SimulinkModel) : Sequence(simulink::SubSystem) =\n\tmodel.contains->selectByKind(SubSystem);',
  javaMethod: '  public static List<SubSystem> getAllSubSystems(SimulinkModel model) {\n    return null;\n  }\n',
  problems: [],
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
};

const broken: HelperResponse = {
  ...subSystems,
  id: 2,
  name: 'broken',
  description: null,
  javaMethod: null,
  problems: [{ helperName: 'broken', message: "no feature 'contians'", line: 1, column: 7 }],
};

function renderModal(readOnly = false) {
  const onClose = vi.fn();
  render(<HelpersModal isOpen vsumId={7} readOnly={readOnly} onClose={onClose} />);
  return { onClose };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockEditorModel.current = { getLineContent: () => 'model.contians->size()' };
  api.getHelpers.mockResolvedValue([subSystems, broken]);
  api.getHelperTypes.mockResolvedValue(types);
  api.checkHelperName.mockResolvedValue({ available: true, message: null });
  api.previewHelper.mockResolvedValue({ oclDefinition: 'helper def : x() : Boolean =\n\ttrue;', javaMethod: 'public static boolean x() {}', problems: [] });
});

describe('HelpersModal overview', () => {
  it('lists helpers with signature, OCL definition and translation status', async () => {
    renderModal();

    const card = await screen.findByRole('article', { name: 'Utility method getAllSubSystems' });
    expect(within(card).getByText('(model : simulink::SimulinkModel) : Sequence(simulink::SubSystem)')).toBeInTheDocument();
    expect(within(card).getByLabelText('OCL definition of getAllSubSystems')).toHaveTextContent('model.contains->selectByKind(SubSystem)');
    expect(within(card).getByText('Java generated')).toBeInTheDocument();

    const brokenCard = screen.getByRole('article', { name: 'Utility method broken' });
    expect(within(brokenCard).getByText('Cannot be translated')).toBeInTheDocument();
    expect(within(brokenCard).getByText("Line 1, column 7: no feature 'contians'")).toBeInTheDocument();
    expect(within(brokenCard).getByRole('button', { name: 'View Java' })).toBeDisabled();
    expect(api.getHelpers).toHaveBeenCalledWith(7);
  });

  it('opens the generated Java of a helper read-only', async () => {
    renderModal();
    const card = await screen.findByRole('article', { name: 'Utility method getAllSubSystems' });

    fireEvent.click(within(card).getByRole('button', { name: 'View Java' }));

    const viewer = screen.getByRole('dialog', { name: 'Java for getAllSubSystems' });
    expect(within(viewer).getByTestId('monaco-java'))
      .toHaveValue('public static List<SubSystem> getAllSubSystems(SimulinkModel model) {\n  return null;\n}\n');
    expect(within(viewer).getByTestId('monaco-java')).toHaveAttribute('readonly');
  });

  it('opens the whole generated class', async () => {
    api.getHelperClass.mockResolvedValue({
      qualifiedClassName: 'tools.vitruv.methodologisttemplate.consistency.utils.Utility',
      fileName: 'Utility.java',
      source: 'public final class Utility {}',
      problems: broken.problems,
    });
    renderModal();
    await screen.findByRole('article', { name: 'Utility method broken' });

    fireEvent.click(screen.getByRole('button', { name: 'View Java class' }));

    const viewer = await screen.findByRole('dialog', { name: 'Utility.java' });
    expect(within(viewer).getByTestId('monaco-java')).toHaveValue('public final class Utility {}');
    expect(within(viewer).getByRole('alert')).toHaveTextContent("broken (no feature 'contians')");
  });

  it('deletes a helper after confirmation and reloads the list', async () => {
    api.deleteHelper.mockResolvedValue(undefined);
    renderModal();
    const card = await screen.findByRole('article', { name: 'Utility method broken' });

    fireEvent.click(within(card).getByRole('button', { name: 'Delete' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(api.deleteHelper).toHaveBeenCalledWith(7, 2));
    await waitFor(() => expect(api.getHelpers).toHaveBeenCalledTimes(2));
  });

  it('shows why a helper cannot be deleted', async () => {
    api.deleteHelper.mockRejectedValue(new Error("The utility method 'broken' cannot be deleted because it is used by: other."));
    renderModal();
    const card = await screen.findByRole('article', { name: 'Utility method broken' });

    fireEvent.click(within(card).getByRole('button', { name: 'Delete' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText(/used by: other/)).toBeInTheDocument();
  });

  it('only lets view-only members look at helpers', async () => {
    renderModal(true);
    await screen.findByRole('article', { name: 'Utility method getAllSubSystems' });

    expect(screen.queryByRole('button', { name: '+ New Utility Method' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'View Java' })[0]).toBeEnabled();
  });
});

describe('HelperEditor', () => {
  async function openNewHelper() {
    renderModal();
    await screen.findByRole('article', { name: 'Utility method getAllSubSystems' });
    fireEvent.click(screen.getByRole('button', { name: '+ New Utility Method' }));
  }

  it('warns when the name is already used', async () => {
    api.checkHelperName.mockResolvedValue({ available: false, message: "A utility method named 'getAllSubSystems' already exists in this project." });
    await openNewHelper();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'getAllSubSystems' } });

    expect(await screen.findByText(/already exists in this project/)).toBeInTheDocument();
    expect(api.checkHelperName).toHaveBeenCalledWith(7, 'getAllSubSystems', undefined);
    expect(screen.getByRole('button', { name: 'Save Utility Method' })).toBeDisabled();
  });

  it('creates a helper from the form and returns to the overview', async () => {
    api.createHelper.mockResolvedValue({ ...subSystems, id: 3, name: 'countSubSystems' });
    await openNewHelper();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'countSubSystems' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Add parameter' }));
    fireEvent.change(screen.getByLabelText('Parameter 1 name'), { target: { value: 'model' } });
    fireEvent.change(screen.getByLabelText('Return type element type'), { target: { value: 'Integer' } });
    fireEvent.change(screen.getByLabelText('Add import'), { target: { value: 'simulink::*' } });
    fireEvent.change(screen.getByTestId('monaco-vitruvocl'), { target: { value: 'getAllSubSystems(model)->size()' } });

    await waitFor(() => expect(api.previewHelper).toHaveBeenCalled());
    expect(await screen.findByText('Translates to Java')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Utility Method' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Save Utility Method' }));

    await waitFor(() => expect(api.createHelper).toHaveBeenCalledWith(7, {
      name: 'countSubSystems',
      description: undefined,
      returnType: 'Integer',
      parameters: [{ name: 'model', type: 'simulink::SimulinkModel' }],
      imports: ['simulink::*'],
      body: 'getAllSubSystems(model)->size()',
    }));
    expect(await screen.findByRole('heading', { name: 'Utility Methods' })).toBeInTheDocument();
  });

  it('lists the other helpers and inserts a call of one', async () => {
    renderModal();
    const card = await screen.findByRole('article', { name: 'Utility method broken' });
    fireEvent.click(within(card).getByRole('button', { name: 'Edit' }));

    const list = await screen.findByRole('list', { name: 'Other utility methods' });
    expect(within(list).queryByText(/^broken\(/)).not.toBeInTheDocument();
    fireEvent.click(within(list).getByRole('button', { name: 'Insert call of getAllSubSystems' }));

    expect(screen.getByTestId('monaco-vitruvocl')).toHaveValue(`${broken.body} getAllSubSystems(model)`);
  });

  it('suggests the other helpers while typing the definition', async () => {
    renderModal();
    const card = await screen.findByRole('article', { name: 'Utility method broken' });
    fireEvent.click(within(card).getByRole('button', { name: 'Edit' }));
    await screen.findByRole('list', { name: 'Other utility methods' });

    const provider = (mockRegisterCompletion.mock.calls.at(-1) as any[])[1];
    const model = {
      getValueInRange: () => 'm.',
      getWordUntilPosition: () => ({ startColumn: 3, endColumn: 3 }),
    };
    mockEditorModel.current = model;
    const { suggestions } = provider.provideCompletionItems(model, { lineNumber: 1, column: 3 });

    expect(suggestions).toEqual([expect.objectContaining({ label: 'getAllSubSystems', insertText: 'getAllSubSystems()' })]);
  });

  it('shows translation problems and marks them in the OCL editor', async () => {
    api.previewHelper.mockResolvedValue({
      oclDefinition: 'helper def : broken() : Integer =\n\tmodel.contians->size();',
      javaMethod: null,
      problems: [{ helperName: 'broken', message: "no feature 'contians'", line: 1, column: 7 }],
    });
    renderModal();
    const card = await screen.findByRole('article', { name: 'Utility method broken' });

    fireEvent.click(within(card).getByRole('button', { name: 'Edit' }));

    expect(await screen.findByText("Line 1, column 7: no feature 'contians'")).toBeInTheDocument();
    expect(api.previewHelper).toHaveBeenCalledWith(7, expect.objectContaining({ name: 'broken' }), 2);
    expect(mockSetModelMarkers).toHaveBeenLastCalledWith(
      expect.anything(),
      'helper',
      [expect.objectContaining({ startLineNumber: 1, startColumn: 7, endColumn: 15, message: "no feature 'contians'" })],
    );
  });

  it('shows the server error when saving fails', async () => {
    api.updateHelper.mockRejectedValue(new Error("Saving would break the utility methods that call 'getAllSubSystems': other."));
    renderModal();
    const card = await screen.findByRole('article', { name: 'Utility method getAllSubSystems' });
    fireEvent.click(within(card).getByRole('button', { name: 'Edit' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Utility Method' })).toBeEnabled());

    fireEvent.click(screen.getByRole('button', { name: 'Save Utility Method' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Saving would break the utility methods');
    expect(api.updateHelper).toHaveBeenCalledWith(7, 1, expect.objectContaining({ name: 'getAllSubSystems' }));
  });
});
