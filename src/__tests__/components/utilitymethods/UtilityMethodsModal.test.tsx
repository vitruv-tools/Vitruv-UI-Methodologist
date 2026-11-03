import type { Mocked } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { UtilityMethodsModal } from '../../../components/utilitymethods/UtilityMethodsModal';
import { apiService, type UtilityMethodResponse, type UtilityMethodTypeResponse } from '../../../services/api';

vi.mock('@monaco-editor/react', () => {
  const mockReact = require('react');
  const MockEditor = ({ value, onChange, onMount, language }: any) => {
    mockReact.useEffect(() => {
      onMount?.(
        { getModel: () => mockEditorModel.current },
        {
          editor: { setModelMarkers: mockSetModelMarkers },
          MarkerSeverity: { Error: 8, Warning: 4 },
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
    getUtilityMethods: vi.fn(),
    getUtilityMethodTypes: vi.fn(),
    getUtilityMethodClass: vi.fn(),
    createUtilityMethod: vi.fn(),
    updateUtilityMethod: vi.fn(),
    deleteUtilityMethod: vi.fn(),
    previewUtilityMethod: vi.fn(),
    checkUtilityMethodName: vi.fn(),
  },
}));

const api = apiService as Mocked<typeof apiService>;

const types: UtilityMethodTypeResponse[] = [
  { metamodel: 'simulink', name: 'SimulinkModel', qualifiedName: 'simulink::SimulinkModel', kind: 'CLASS', javaName: 'x.SimulinkModel' },
  { metamodel: 'simulink', name: 'SubSystem', qualifiedName: 'simulink::SubSystem', kind: 'CLASS', javaName: 'x.SubSystem' },
];

const subSystems: UtilityMethodResponse = {
  id: 1,
  vsumId: 7,
  name: 'getAllSubSystems',
  description: 'All subsystems, including nested ones.',
  returnType: 'List<SubSystem>',
  parameters: [{ name: 'model', type: 'SimulinkModel' }],
  imports: ['x.*'],
  body: 'model.eAllContents.filter(SubSystem).toList',
  xtendDefinition: 'def static List<SubSystem> getAllSubSystems(SimulinkModel model) {\n  model.eAllContents.filter(SubSystem).toList\n}',
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
  problems: [{ utilityMethodName: 'broken', message: 'The method contians is undefined', line: 1, column: 7, severity: 'ERROR' }],
};

function renderModal(readOnly = false) {
  const onClose = vi.fn();
  render(<UtilityMethodsModal isOpen vsumId={7} readOnly={readOnly} onClose={onClose} />);
  return { onClose };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockEditorModel.current = { getLineContent: () => 'model.contians.size' };
  api.getUtilityMethods.mockResolvedValue([subSystems, broken]);
  api.getUtilityMethodTypes.mockResolvedValue(types);
  api.checkUtilityMethodName.mockResolvedValue({ available: true, message: null });
  api.previewUtilityMethod.mockResolvedValue({ xtendDefinition: 'def static boolean x() {\n  true\n}', javaMethod: 'public static boolean x() {}', problems: [] });
});

describe('UtilityMethodsModal overview', () => {
  it('lists utility methods with signature, Xtend definition and compile status', async () => {
    renderModal();

    const card = await screen.findByRole('article', { name: 'Utility method getAllSubSystems' });
    expect(within(card).getByText('(SimulinkModel model) : List<SubSystem>')).toBeInTheDocument();
    expect(within(card).getByLabelText('Xtend definition of getAllSubSystems')).toHaveTextContent('model.eAllContents.filter(SubSystem).toList');
    expect(within(card).getByText('Java generated')).toBeInTheDocument();

    const brokenCard = screen.getByRole('article', { name: 'Utility method broken' });
    expect(within(brokenCard).getByText('Does not compile')).toBeInTheDocument();
    expect(within(brokenCard).getByText('Line 1, column 7: The method contians is undefined')).toBeInTheDocument();
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
    expect(within(viewer).getByRole('alert')).toHaveTextContent('broken (The method contians is undefined)');
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

  it('says that reactions import the utility class automatically', async () => {
    renderModal();
    await screen.findByRole('article', { name: 'Utility method getAllSubSystems' });

    const hint = screen.getByText((_, element) => element?.tagName === 'DIV' && /^Reactions import/.test(element.textContent ?? ''));
    expect(hint).toHaveTextContent('Reactions import Utility automatically. Call e.g. Utility.getAllSubSystems(…).');
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
    fireEvent.change(screen.getByLabelText('Return type element type'), { target: { value: 'int' } });
    fireEvent.change(screen.getByLabelText('Add import'), { target: { value: 'java.util.Collection' } });
    fireEvent.change(screen.getByTestId('monaco-xtend-utility'), { target: { value: 'getAllSubSystems(model).size' } });

    await waitFor(() => expect(api.previewUtilityMethod).toHaveBeenCalled());
    expect(await screen.findByText('Compiles to Java')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Utility Method' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Save Utility Method' }));

    await waitFor(() => expect(api.createUtilityMethod).toHaveBeenCalledWith(7, {
      name: 'countSubSystems',
      description: undefined,
      returnType: 'int',
      parameters: [{ name: 'model', type: 'SimulinkModel' }],
      imports: ['x.*', 'java.util.Collection'],
      body: 'getAllSubSystems(model).size',
    }));
    expect(await screen.findByRole('heading', { name: 'Utility Methods' })).toBeInTheDocument();
  });

  it('offers the other utility methods as suggestions and as calls to insert', async () => {
    renderModal();
    const card = await screen.findByRole('article', { name: 'Utility method broken' });
    fireEvent.click(within(card).getByRole('button', { name: 'Edit' }));
    const list = await screen.findByRole('list', { name: 'Other utility methods' });

    const [language, provider] = mockRegisterCompletion.mock.calls.at(-1) as any[];
    expect(language).toBe('xtend-utility');
    let textBefore = 'Utility.';
    const model = {
      getValueInRange: () => textBefore,
      getWordUntilPosition: () => ({ startColumn: 9, endColumn: 9 }),
    };
    mockEditorModel.current = model;
    const { suggestions } = provider.provideCompletionItems(model, { lineNumber: 1, column: 9 });

    // eslint-disable-next-line no-template-curly-in-string -- Monaco snippet syntax
    expect(suggestions).toEqual([expect.objectContaining({ label: 'getAllSubSystems', insertText: 'getAllSubSystems(${1:model})' })]);
    textBefore = 'model.';
    expect(provider.provideCompletionItems(model, { lineNumber: 1, column: 7 }).suggestions).toEqual([]);

    expect(within(list).queryByText(/^broken\(/)).not.toBeInTheDocument();
    fireEvent.click(within(list).getByRole('button', { name: 'Insert call of getAllSubSystems' }));
    expect(screen.getByTestId('monaco-xtend-utility')).toHaveValue(`${broken.body} getAllSubSystems(model)`);
  });

  it('shows compile problems and marks them in the body editor', async () => {
    api.previewUtilityMethod.mockResolvedValue({
      xtendDefinition: 'def static int broken(SimulinkModel model) {\n  model.contians.size\n}',
      javaMethod: null,
      problems: [{ utilityMethodName: 'broken', message: 'The method contians is undefined', line: 1, column: 7, severity: 'ERROR' }],
    });
    renderModal();
    const card = await screen.findByRole('article', { name: 'Utility method broken' });

    fireEvent.click(within(card).getByRole('button', { name: 'Edit' }));

    expect(await screen.findByText('Line 1, column 7: The method contians is undefined')).toBeInTheDocument();
    expect(screen.getByText('Xtend body')).toBeInTheDocument();
    expect(api.previewUtilityMethod).toHaveBeenCalledWith(7, expect.objectContaining({ name: 'broken' }), 2);
    expect(mockSetModelMarkers).toHaveBeenLastCalledWith(
      expect.anything(),
      'utilityMethod',
      [expect.objectContaining({ severity: 8, startLineNumber: 1, startColumn: 7, endColumn: 15, message: 'The method contians is undefined' })],
    );
    expect(screen.getByRole('button', { name: 'Save Utility Method' })).toBeEnabled();
    expect(screen.getByText('Fix the problems shown in the preview.')).toBeInTheDocument();
  });

  it('shows warnings without counting them as problems', async () => {
    api.previewUtilityMethod.mockResolvedValue({
      xtendDefinition: 'def static List<SubSystem> getAllSubSystems(SimulinkModel model) {\n  val unused = 1\n}',
      javaMethod: 'public static List<SubSystem> getAllSubSystems(final SimulinkModel model) {}',
      problems: [{ utilityMethodName: 'getAllSubSystems', message: 'The value of the local variable unused is not used', line: 1, column: 5, severity: 'WARNING' }],
    });
    renderModal();
    const card = await screen.findByRole('article', { name: 'Utility method getAllSubSystems' });

    fireEvent.click(within(card).getByRole('button', { name: 'Edit' }));

    expect(await screen.findByText('Compiles to Java')).toBeInTheDocument();
    expect(screen.getByText(/Warning: Line 1, column 5/)).toBeInTheDocument();
    expect(mockSetModelMarkers).toHaveBeenLastCalledWith(
      expect.anything(),
      'utilityMethod',
      [expect.objectContaining({ severity: 4 })],
    );
    expect(screen.getByText('Ready to save.')).toBeInTheDocument();
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
