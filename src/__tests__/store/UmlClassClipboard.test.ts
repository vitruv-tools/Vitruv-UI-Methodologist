import { isActiveUmlEditor, useUmlClassClipboardStore } from '../../store/UmlClassClipboard';

describe('useUmlClassClipboardStore', () => {
  afterEach(() => {
    useUmlClassClipboardStore.setState({ snapshot: null, editorIds: [] });
  });

  it('stores and clears the copied classes', () => {
    const snapshot = { classes: [], relationships: [] };

    useUmlClassClipboardStore.getState().setSnapshot(snapshot);
    expect(useUmlClassClipboardStore.getState().snapshot).toBe(snapshot);

    useUmlClassClipboardStore.getState().clearSnapshot();
    expect(useUmlClassClipboardStore.getState().snapshot).toBeNull();
  });

  it('treats the editor used last as the active one', () => {
    const { activateEditor } = useUmlClassClipboardStore.getState();

    activateEditor('a');
    activateEditor('b');
    expect(isActiveUmlEditor('b')).toBe(true);

    activateEditor('a');
    expect(isActiveUmlEditor('a')).toBe(true);
    expect(isActiveUmlEditor('b')).toBe(false);
  });

  it('falls back to the previously used editor when the active one is closed', () => {
    const { activateEditor, releaseEditor } = useUmlClassClipboardStore.getState();

    activateEditor('a');
    activateEditor('b');
    releaseEditor('b');

    expect(isActiveUmlEditor('a')).toBe(true);
    expect(useUmlClassClipboardStore.getState().editorIds).toEqual(['a']);
  });
});
