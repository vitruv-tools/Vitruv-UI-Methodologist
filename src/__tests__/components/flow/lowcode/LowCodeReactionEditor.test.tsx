import React, { createRef } from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import LowCodeReactionEditor, {
  LowCodeReactionEditorHandle,
} from '../../../../components/flow/lowcode/LowCodeReactionEditor';
import { apiService } from '../../../../services/api';
import { useProjectStore } from '../../../../store/Project';
import {
  createVsumDetailsStore,
  deleteVsumDetailsStore,
  VsumDetailsHelper,
} from '../../../../store/VsumDetails';
import { getLowCodeReactionConfig } from '../../../../utils/LowCodeReactionUtils';
import type { FlowEcoreEdge } from '../../../../types/flow';
import type { LowCodeReactionFieldMetadata } from '../../../../types/LowCodeReactionFieldMetadata';

jest.mock('../../../../services/api', () => ({
  apiService: {
    getLowCodeReactionsMetadata: jest.fn(),
  },
}));

const stringField = (name: string, displayName = name): LowCodeReactionFieldMetadata => ({
  name,
  type: 'String',
  required: false,
  array: false,
  map: false,
  mapKeyType: null,
  mapValueType: null,
  allowableValues: null,
  sizeMin: null,
  sizeMax: null,
  lengthMin: null,
  lengthMax: null,
  min: null,
  max: null,
  decimalMin: null,
  decimalMinInclusive: null,
  decimalMax: null,
  decimalMaxInclusive: null,
  pattern: null,
  patternFlags: null,
  displayName,
  displayDescription: null,
  displayHide: false,
  displayDefaultStringValue: '',
  displayDefaultIntValue: null,
  displayDefaultBooleanValue: null,
  displayDefaultDoubleValue: null,
});

const metadata = {
  reactionMetadataMap: {
    create_corresponding_root_on_insert_root: {
      name: 'Create Corresponding Root',
      description: null,
      hide: false,
      fields: [stringField('reactionName', 'Reaction Name')],
    },
    hidden_template: {
      name: 'Hidden',
      description: null,
      hide: true,
      fields: [],
    },
  },
};

const edge: FlowEcoreEdge = {
  id: 'e1',
  source: 'n1',
  target: 'n2',
  type: 'fine-granular-reaction',
  data: {
    relationshipType: 'fine-granular-reaction',
    ecore: {
      eObjectSourceId: 'http://a#A',
      eObjectTargetId: 'http://b#B',
      fromModel: 'http://a',
      toModel: 'http://b',
    },
  },
} as FlowEcoreEdge;

describe('LowCodeReactionEditor', () => {
  const getMetadata = apiService.getLowCodeReactionsMetadata as jest.Mock;

  beforeEach(() => {
    getMetadata.mockResolvedValue({ data: metadata, message: 'ok' });
    useProjectStore.getState().setActiveId(1);
    createVsumDetailsStore(1, { metaModels: [], metaModelsRelation: [] });
    const helper = new VsumDetailsHelper(1);
    helper.setIdentifiersToBackendMetaModelId(
      new Map([
        ['http://a', 10],
        ['http://b', 20],
      ]),
    );
    helper.saveToStore();
  });

  afterEach(() => {
    deleteVsumDetailsStore(1);
    useProjectStore.getState().setActiveId(null);
    jest.clearAllMocks();
  });

  it('loads templates, reports dirty on edit, saves, then undo restores last saved', async () => {
    const ref = createRef<LowCodeReactionEditorHandle>();
    const onDirtyChange = jest.fn();
    const onSaveComplete = jest.fn();
    const onDeleteRequest = jest.fn();

    render(
      <LowCodeReactionEditor
        ref={ref}
        edge={edge}
        onDirtyChange={onDirtyChange}
        onSaveComplete={onSaveComplete}
        onDeleteRequest={onDeleteRequest}
      />,
    );

    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());
    expect(screen.queryByRole('option', { name: 'Hidden' })).not.toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByRole('option', { name: 'Create Corresponding Root' }));

    const nameField = await screen.findByLabelText('Reaction Name');
    fireEvent.change(nameField, { target: { value: 'updated_name' } });

    await waitFor(() => expect(ref.current?.isDirty()).toBe(true));
    expect(onDirtyChange).toHaveBeenCalledWith(true);

    act(() => {
      ref.current?.save();
    });
    expect(onSaveComplete).toHaveBeenCalled();
    expect(getLowCodeReactionConfig(edge)).toMatchObject({
      name: 'create_corresponding_root_on_insert_root',
      reactionName: 'updated_name',
    });

    fireEvent.change(screen.getByLabelText('Reaction Name'), { target: { value: 'draft' } });
    await waitFor(() => expect(ref.current?.isDirty()).toBe(true));
    act(() => {
      ref.current?.undo();
    });
    await waitFor(() => expect(screen.getByLabelText('Reaction Name')).toHaveValue('updated_name'));

    act(() => {
      ref.current?.delete();
    });
    expect(onDeleteRequest).toHaveBeenCalled();
  });

  it('shows an error when metadata cannot be loaded', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    getMetadata.mockRejectedValueOnce(new Error('down'));
    render(<LowCodeReactionEditor edge={edge} />);
    expect(await screen.findByText('Failed to load reaction templates')).toBeInTheDocument();
    warn.mockRestore();
  });
});
