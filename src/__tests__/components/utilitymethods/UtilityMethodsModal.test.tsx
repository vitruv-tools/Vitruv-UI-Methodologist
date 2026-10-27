import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { UtilityMethodsModal } from '../../../components/utilitymethods/UtilityMethodsModal';
import { apiService, type UtilityMethodResponse, type UtilityMethodTypeResponse } from '../../../services/api';

jest.mock('@monaco-editor/react', () => {
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

const mockSetModelMarkers = jest.fn();
const mockEditorModel: { current: any } = { current: null };
const mockRegisterCompletion = jest.fn((..._args: any[]) => ({ dispose: jest.fn() }));

jest.mock('../../../services/api', () => ({
  apiService: {
    getUtilityMethods: jest.fn(),
    getUtilityMethodTypes: jest.fn(),
    getUtilityMethodClass: jest.fn(),
    createUtilityMethod: jest.fn(),
    updateUtilityMethod: jest.fn(),
    deleteUtilityMethod: jest.fn(),
    previewUtilityMethod: jest.fn(),
    checkUtilityMethodName: jest.fn(),
  },
}));

const api = apiService as jest.Mocked<typeof apiService>;

const types: UtilityMethodTypeResponse[] = [
  { metamodel: 'simulink', name: 'SimulinkModel', qualifiedName: 'simulink::SimulinkModel', kind: 'CLASS', javaName: 'x.SimulinkModel' },
  { metamodel: 'simulink', name: 'SubSystem', qualifiedName: 'simulink::SubSystem', kind: 'CLASS', javaName: 'x.SubSystem' },
];

const subSystems: UtilityMethodResponse = {
  id: 1,
  vsumId: 7,
  name: 'getAllSubSystems',
  description: 'All subsystems, including nested ones.',
  returnType: 'Sequence(simulink::SubSystem)',
  parameters: [{ name: 'model', type: 'simulink::SimulinkModel' }],
  imports: ['simulink::*'],
  body: 'model.contains->selectByKind(SubSystem)->closure(s | s.subBlocks->selectByKind(SubSystem))',
  oclDefinition: 'def : getAllSubSystems(model : simulink::SimulinkModel) : Sequence(simulink::SubSystem) =\n\tmodel.contains->selectByKind(SubSystem);',
  javaMethod: '  public static List<SubSystem> getAllSubSystems(SimulinkModel model) {\n    return null;\n  }\n',
  problems: [],
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
};

const broken: UtilityMethodResponse = {
  ...subSystems,
  id: 2,
  name: 'broken',
  description: null,
  javaMethod: null,
  problems: [{ utilityMethodName: 'broken', message: "no feature 'contians'", line: 1, column: 7 }],
};

function renderModal(readOnly = false) {
  const onClose = jest.fn();
  render(<UtilityMethodsModal isOpen vsumId={7} readOnly={readOnly} onClose={onClose} />);
  return { onClose };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockEditorModel.current = { getLineContent: () => 'model.contians->size()' };
  api.getUtilityMethods.mockResolvedValue([subSystems, broken]);
  api.getUtilityMethodTypes.mockResolvedValue(types);
  api.checkUtilityMethodName.mockResolvedValue({ available: true, message: null });
  api.previewUtilityMethod.mockResolvedValue({ oclDefinition: 'def : x() : Boolean =\n\ttrue;', javaMethod: 'public static boolean x() {}', problems: [] });
});

describe('UtilityMethodsModal overview', () => {
  it('lists utility methods with signature, OCL definition and translation status', async () => {
    renderModal();

    const card = await screen.findByRole('article', { name: 'Utility method getAllSubSystems' });
    expect(within(card).getByText('(model : simulink::SimulinkModel) : Sequence(simulink::SubSystem)')).toBeInTheDocument();
    expect(within(card).getByLabelText('OCL definition of getAllSubSystems')).toHaveTextContent('model.contains->selectByKind(SubSystem)');
    expect(within(card).getByText('Java generated')).toBeInTheDocument();

    const brokenCard = screen.getByRole('article', { name: 'Utility method broken' });
    expect(within(brokenCard).getByText('Cannot be translated')).toBeInTheDocument();
    expect(within(brokenCard).getByText("Line 1, column 7: no feature 'contians'")).toBeInTheDocument();
    expect(within(brokenCard).getByRole('button', { name: 'View Java' })).toBeDisabled();
    expect(api.getUtilityMethods).toHaveBeenCalledWith(7);
  });

  it('opens the generated Java of a utility method read-only', async () => {
    renderModal();
    const card = await screen.findByRole('article', { name: 'Utility method getAllSubSystems' });

    fireEvent.click(within(card).getByRole('button', { name: 'View Java' }));

    const viewer = screen.getByRole('dialog', { name: 'Java for getAllSubSystems' });
    expect(within(viewer).getByTestId('monaco-java'))
      .toHaveValue('public static List<SubSystem> getAllSubSystems(SimulinkModel model) {\n  return null;\n}\n');
    expect(within(viewer).getByTestId('monaco-java')).toHaveAttribute('readonly');
  });

  it('opens the whole generated class', async () => {
    api.getUtilityMethodClass.mockResolvedValue({
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

  it('shows why a utility method cannot be deleted, and deletes it after confirmation', async () => {
    api.deleteUtilityMethod
      .mockRejectedValueOnce(new Error("The utility method 'broken' cannot be deleted because it is used by: other."))
      .mockResolvedValueOnce(undefined);
    renderModal();
    const card = await screen.findByRole('article', { name: 'Utility method broken' });
    const confirmDelete = () => {
      fireEvent.click(within(card).getByRole('button', { name: 'Delete' }));
      fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    };

    confirmDelete();
    expect(await screen.findByText(/used by: other/)).toBeInTheDocument();

    confirmDelete();
    await waitFor(() => expect(api.getUtilityMethods).toHaveBeenCalledTimes(2));
    expect(api.deleteUtilityMethod).toHaveBeenLastCalledWith(7, 2);
  });

  it('only lets view-only members look at utility methods', async () => {
    renderModal(true);
    await screen.findByRole('article', { name: 'Utility method getAllSubSystems' });

    expect(screen.queryByRole('button', { name: '+ New Utility Method' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'View Java' })[0]).toBeEnabled();
  });
});

describe('UtilityMethodEditor', () => {
  async function openNewUtilityMethod() {
    renderModal();
    await screen.findByRole('article', { name: 'Utility method getAllSubSystems' });
    fireEvent.click(screen.getByRole('button', { name: '+ New Utility Method' }));
  }

  it('warns when the name is already used', async () => {
    api.checkUtilityMethodName.mockResolvedValue({ available: false, message: "A utility method named 'getAllSubSystems' already exists in this project." });
    await openNewUtilityMethod();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'getAllSubSystems' } });

    expect(await screen.findByText(/already exists in this project/)).toBeInTheDocument();
    expect(api.checkUtilityMethodName).toHaveBeenCalledWith(7, 'getAllSubSystems', undefined);
    expect(screen.getByRole('button', { name: 'Save Utility Method' })).toBeDisabled();
  });

  it('creates a utility method from the form and returns to the overview', async () => {
    api.createUtilityMethod.mockResolvedValue({ ...subSystems, id: 3, name: 'countSubSystems' });
    await openNewUtilityMethod();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'countSubSystems' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Add parameter' }));
    fireEvent.change(screen.getByLabelText('Parameter 1 name'), { target: { value: 'model' } });
    fireEvent.change(screen.getByLabelText('Return type element type'), { target: { value: 'Integer' } });
    fireEvent.change(screen.getByLabelText('Add import'), { target: { value: 'simulink::*' } });
    fireEvent.change(screen.getByTestId('monaco-vitruvocl'), { target: { value: 'getAllSubSystems(model)->size()' } });

    await waitFor(() => expect(api.previewUtilityMethod).toHaveBeenCalled());
    expect(await screen.findByText('Translates to Java')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Utility Method' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Save Utility Method' }));

    await waitFor(() => expect(api.createUtilityMethod).toHaveBeenCalledWith(7, {
      name: 'countSubSystems',
      description: undefined,
      returnType: 'Integer',
      parameters: [{ name: 'model', type: 'simulink::SimulinkModel' }],
      imports: ['simulink::*'],
      body: 'getAllSubSystems(model)->size()',
    }));
    expect(await screen.findByRole('heading', { name: 'Utility Methods' })).toBeInTheDocument();
  });

  it('offers the other utility methods as suggestions and as calls to insert', async () => {
    renderModal();
    const card = await screen.findByRole('article', { name: 'Utility method broken' });
    fireEvent.click(within(card).getByRole('button', { name: 'Edit' }));
    const list = await screen.findByRole('list', { name: 'Other utility methods' });

    const provider = (mockRegisterCompletion.mock.calls.at(-1) as any[])[1];
    const model = {
      getValueInRange: () => 'm.',
      getWordUntilPosition: () => ({ startColumn: 3, endColumn: 3 }),
    };
    mockEditorModel.current = model;
    const { suggestions } = provider.provideCompletionItems(model, { lineNumber: 1, column: 3 });

    expect(suggestions).toEqual([expect.objectContaining({ label: 'getAllSubSystems', insertText: 'getAllSubSystems()' })]);

    expect(within(list).queryByText(/^broken\(/)).not.toBeInTheDocument();
    fireEvent.click(within(list).getByRole('button', { name: 'Insert call of getAllSubSystems' }));
    expect(screen.getByTestId('monaco-vitruvocl')).toHaveValue(`${broken.body} getAllSubSystems(model)`);
  });

  it('shows translation problems and marks them in the OCL editor', async () => {
    api.previewUtilityMethod.mockResolvedValue({
      oclDefinition: 'def : broken() : Integer =\n\tmodel.contians->size();',
      javaMethod: null,
      problems: [{ utilityMethodName: 'broken', message: "no feature 'contians'", line: 1, column: 7 }],
    });
    renderModal();
    const card = await screen.findByRole('article', { name: 'Utility method broken' });

    fireEvent.click(within(card).getByRole('button', { name: 'Edit' }));

    expect(await screen.findByText("Line 1, column 7: no feature 'contians'")).toBeInTheDocument();
    expect(api.previewUtilityMethod).toHaveBeenCalledWith(7, expect.objectContaining({ name: 'broken' }), 2);
    expect(mockSetModelMarkers).toHaveBeenLastCalledWith(
      expect.anything(),
      'utilityMethod',
      [expect.objectContaining({ startLineNumber: 1, startColumn: 7, endColumn: 15, message: "no feature 'contians'" })],
    );
  });

  it('shows the server error when saving fails', async () => {
    api.updateUtilityMethod.mockRejectedValue(new Error("Saving would break the utility methods that call 'getAllSubSystems': other."));
    renderModal();
    const card = await screen.findByRole('article', { name: 'Utility method getAllSubSystems' });
    fireEvent.click(within(card).getByRole('button', { name: 'Edit' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Utility Method' })).toBeEnabled());

    fireEvent.click(screen.getByRole('button', { name: 'Save Utility Method' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Saving would break the utility methods');
    expect(api.updateUtilityMethod).toHaveBeenCalledWith(7, 1, expect.objectContaining({ name: 'getAllSubSystems' }));
  });
});
