import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Editor, { type Monaco, type OnMount } from '@monaco-editor/react';
import type * as monacoTypes from 'monaco-editor';
import { ActionButton } from '../ui/ActionButton';
import { modalPanelFooterStyle } from '../ui/sharedStyles';
import { vitruvOCLLanguageId } from '../constraints/VitruvOCLMonarchGrammar';
import {
  apiService,
  type HelperPreviewResponse,
  type HelperProblem,
  type HelperResponse,
  type HelperTypeResponse,
} from '../../services/api';
import { extractApiErrorMessage } from '../../utils/apiErrorMessage';
import { OclTypePicker, pickerControlStyle } from './OclTypePicker';
import {
  EMPTY_DRAFT,
  dedent,
  draftFromHelper,
  formatSignature,
  helperCall,
  helperCallContext,
  helperCallSnippet,
  missingField,
  requestFromDraft,
  type HelperDraft,
} from './helperUtils';
import { HELPER_EDITOR_THEME, setUpVitruvOcl } from './monacoSetup';

const NAME_CHECK_DELAY_MS = 350;
const PREVIEW_DELAY_MS = 600;
const MARKER_OWNER = 'helper';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

const sectionLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--v-text-secondary)',
  marginBottom: 6,
};

const hintStyle: React.CSSProperties = { fontSize: 11.5, color: 'var(--v-text-muted)', marginTop: 4 };

const panelTitleStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  background: 'var(--v-surface-muted)',
  borderBottom: '1px solid var(--v-border-subtle)',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--v-text-muted)',
  flexShrink: 0,
};

const SYNTAX_HELP = [
  ['Navigation', 'model.contains, block.name'],
  ['Collections', 'xs->size(), ->isEmpty(), ->includes(x), ->first(), ->asSet(), ->union(ys)'],
  ['Iterators', 'xs->select(x | …), ->reject, ->collect, ->forAll, ->exists, ->any, ->sortedBy'],
  ['Types', 'x.oclIsKindOf(mm::C), x.oclAsType(mm::C), xs->selectByKind(mm::C)'],
  ['Transitive', 'xs->closure(x | x.children)  (includes xs, stops on cycles)'],
  ['Expressions', "let v = … in …, if c then a else b endif, 'text', Sequence{1..n}"],
  ['Other utility methods', 'otherMethod(x) or thisModule.otherMethod(x)'],
] as const;

type NameStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available' }
  | { state: 'unavailable'; message: string };

interface HelperEditorProps {
  vsumId: number;
  /** The helper being edited, or `null` for a new helper. */
  helper: HelperResponse | null;
  types: HelperTypeResponse[];
  /** All helpers of the project, which the definition can call. */
  helpers: HelperResponse[];
  onCancel: () => void;
  onSaved: (helper: HelperResponse) => void;
}

/** Form for defining an helper, with live translation to Java. */
export const HelperEditor: React.FC<HelperEditorProps> = ({ vsumId, helper, types, helpers, onCancel, onSaved }) => {
  const [draft, setDraft] = useState<HelperDraft>(() => (helper ? draftFromHelper(helper) : EMPTY_DRAFT));
  const [nameStatus, setNameStatus] = useState<NameStatus>({ state: 'idle' });
  const [preview, setPreview] = useState<HelperPreviewResponse | null>(null);
  const [previewTab, setPreviewTab] = useState<'ocl' | 'java'>('java');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSyntaxHelp, setShowSyntaxHelp] = useState(false);
  const editorRef = useRef<monacoTypes.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const completionRef = useRef<monacoTypes.IDisposable | null>(null);
  const helperId = helper?.id;

  const callableHelpers = useMemo(
    () => helpers.filter(h => h.id !== helperId).sort((a, b) => a.name.localeCompare(b.name)),
    [helpers, helperId],
  );
  const withParameter = callableHelpers.find(h => h.parameters.length > 0);
  const operationExample = withParameter
    && `${withParameter.parameters[0].name}.${helperCall(withParameter, true)}`;
  const callableHelpersRef = useRef(callableHelpers);
  callableHelpersRef.current = callableHelpers;

  const update = useCallback((changes: Partial<HelperDraft>) => {
    setDraft(current => ({ ...current, ...changes }));
    setSaveError(null);
  }, []);

  // ── live name check ──────────────────────────────────────────────────────
  const trimmedName = draft.name.trim();
  useEffect(() => {
    if (!trimmedName || trimmedName === helper?.name) {
      setNameStatus({ state: 'idle' });
      return undefined;
    }
    setNameStatus({ state: 'checking' });
    let cancelled = false;
    const timer = globalThis.setTimeout(async () => {
      try {
        const result = await apiService.checkHelperName(vsumId, trimmedName, helperId);
        if (cancelled) return;
        setNameStatus(result.available
          ? { state: 'available' }
          : { state: 'unavailable', message: result.message ?? 'This name cannot be used.' });
      } catch {
        if (!cancelled) setNameStatus({ state: 'idle' });
      }
    }, NAME_CHECK_DELAY_MS);
    return () => {
      cancelled = true;
      globalThis.clearTimeout(timer);
    };
  }, [trimmedName, vsumId, helperId, helper?.name]);

  // ── live preview ─────────────────────────────────────────────────────────
  const incomplete = missingField(draft);
  const request = useMemo(() => requestFromDraft(draft), [draft]);
  useEffect(() => {
    if (incomplete) {
      setPreview(null);
      return undefined;
    }
    let cancelled = false;
    const timer = globalThis.setTimeout(async () => {
      try {
        const result = await apiService.previewHelper(vsumId, request, helperId);
        if (!cancelled) setPreview(result);
      } catch (e) {
        if (!cancelled) {
          setPreview({
            oclDefinition: '',
            javaMethod: null,
            problems: [{
              helperName: request.name,
              message: extractApiErrorMessage(e, 'The utility method could not be checked.'),
              line: null,
              column: null,
            }],
          });
        }
      }
    }, PREVIEW_DELAY_MS);
    return () => {
      cancelled = true;
      globalThis.clearTimeout(timer);
    };
  }, [request, incomplete, vsumId, helperId]);

  const problems = useMemo(() => preview?.problems ?? [], [preview]);

  // Mark problems that have a position in the OCL editor.
  useEffect(() => {
    const model = editorRef.current?.getModel?.();
    const monaco = monacoRef.current;
    if (!model || !monaco) return;
    monaco.editor.setModelMarkers(model, MARKER_OWNER, problems
      .filter((p): p is HelperProblem & { line: number; column: number } => p.line !== null && p.column !== null)
      .map(p => ({
        severity: monaco.MarkerSeverity.Error,
        message: p.message,
        startLineNumber: p.line,
        startColumn: p.column,
        endLineNumber: p.line,
        endColumn: p.column + Math.max(1, wordLengthAt(model.getLineContent(p.line), p.column - 1)),
      })));
  }, [problems]);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    completionRef.current?.dispose();
    // Providers apply to every editor of the language, so only answer for this one.
    completionRef.current = monaco.languages.registerCompletionItemProvider(vitruvOCLLanguageId, {
      triggerCharacters: ['.'],
      provideCompletionItems: (model, position) => {
        if (model !== editor.getModel()) return { suggestions: [] };
        const context = helperCallContext(model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        }));
        if (!context) return { suggestions: [] };
        const onFirstArgument = context === 'operation';
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };
        return {
          suggestions: callableHelpersRef.current
            .filter(h => !onFirstArgument || h.parameters.length > 0)
            .map(h => ({
              label: h.name,
              kind: monaco.languages.CompletionItemKind.Function,
              detail: `utility method ${formatSignature(h)}`,
              documentation: h.description ?? undefined,
              insertText: helperCallSnippet(h, onFirstArgument),
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range,
            })),
        };
      },
    });
  };

  useEffect(() => () => completionRef.current?.dispose(), []);

  /** Inserts a call of another helper at the cursor, or appends it if the editor is not ready. */
  const insertHelperCall = (other: HelperResponse) => {
    const editor = editorRef.current;
    const selection = editor?.getSelection?.();
    if (!editor || !selection) {
      update({ body: draft.body ? `${draft.body} ${helperCall(other)}` : helperCall(other) });
      return;
    }
    editor.executeEdits('helper-call', [{ range: selection, text: helperCall(other), forceMoveMarkers: true }]);
    editor.focus();
  };

  // ── parameters & imports ─────────────────────────────────────────────────
  const defaultParameterType = types.find(t => t.kind === 'CLASS')?.qualifiedName ?? 'String';
  const setParameter = (index: number, changes: Partial<{ name: string; type: string }>) => {
    update({ parameters: draft.parameters.map((p, i) => (i === index ? { ...p, ...changes } : p)) });
  };

  const importOptions = useMemo(() => {
    const metamodels = [...new Set(types.map(t => t.metamodel))].sort((a, b) => a.localeCompare(b));
    return [
      ...metamodels.map(mm => ({ value: `${mm}::*`, label: `${mm}::* (all types)` })),
      ...types
        .filter(t => t.kind !== 'DATATYPE')
        .map(t => ({ value: t.qualifiedName, label: t.qualifiedName })),
    ].filter(option => !draft.imports.includes(option.value));
  }, [types, draft.imports]);

  // ── save ─────────────────────────────────────────────────────────────────
  const nameBlocked = nameStatus.state === 'unavailable';
  const canSave = !incomplete && !nameBlocked && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = helperId === undefined
        ? await apiService.createHelper(vsumId, request)
        : await apiService.updateHelper(vsumId, helperId, request);
      onSaved(saved);
    } catch (e) {
      setSaveError(extractApiErrorMessage(e, 'The utility method could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  let saveHint: string | null = incomplete;
  if (!saveHint && nameBlocked) saveHint = 'Choose another name.';
  if (!saveHint && problems.length > 0) saveHint = 'Fix the problems shown in the preview.';

  return (
    <>
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {/* Left: signature form */}
        <div style={{ width: 400, flexShrink: 0, overflowY: 'auto', padding: '16px 20px', borderRight: '1px solid var(--v-border-subtle)' }}>
          <label htmlFor="helper-name" style={sectionLabelStyle}>Name</label>
          <input
            id="helper-name"
            value={draft.name}
            placeholder="getAllSubSystems"
            autoComplete="off"
            onChange={e => update({ name: e.target.value })}
            style={{ ...pickerControlStyle, width: '100%', boxSizing: 'border-box', fontFamily: MONO }}
          />
          <NameStatusLine status={nameStatus} />

          <label htmlFor="helper-description" style={{ ...sectionLabelStyle, marginTop: 14 }}>
            Description <span style={{ fontWeight: 400, color: 'var(--v-text-muted)' }}>(optional)</span>
          </label>
          <textarea
            id="helper-description"
            value={draft.description}
            rows={2}
            placeholder="What the utility method returns, shown as Javadoc"
            onChange={e => update({ description: e.target.value })}
            style={{ ...pickerControlStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
          />

          <div style={{ ...sectionLabelStyle, marginTop: 14 }}>Parameters</div>
          {draft.parameters.length === 0 && (
            <div style={hintStyle}>No parameters. Utility methods have no context object, so pass the model elements they need.</div>
          )}
          {draft.parameters.map((parameter, index) => (
            <div key={index} style={parameterCardStyle}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  aria-label={`Parameter ${index + 1} name`}
                  value={parameter.name}
                  placeholder="name"
                  onChange={e => setParameter(index, { name: e.target.value })}
                  style={{ ...pickerControlStyle, flex: 1, fontFamily: MONO }}
                />
                <button
                  type="button"
                  aria-label={`Remove parameter ${index + 1}`}
                  onClick={() => update({ parameters: draft.parameters.filter((_, i) => i !== index) })}
                  style={iconButtonStyle}
                >
                  ×
                </button>
              </div>
              <div style={{ display: 'flex', marginTop: 6 }}>
                <OclTypePicker
                  label={`Parameter ${index + 1} type`}
                  value={parameter.type}
                  types={types}
                  onChange={type => setParameter(index, { type })}
                />
              </div>
            </div>
          ))}
          <ActionButton
            variant="ghost"
            size="sm"
            style={{ marginTop: 6 }}
            onClick={() => update({ parameters: [...draft.parameters, { name: '', type: defaultParameterType }] })}
          >
            + Add parameter
          </ActionButton>

          <div style={{ ...sectionLabelStyle, marginTop: 14 }}>Return type</div>
          <div style={{ display: 'flex' }}>
            <OclTypePicker label="Return type" value={draft.returnType} types={types} onChange={returnType => update({ returnType })} />
          </div>

          <div style={{ ...sectionLabelStyle, marginTop: 14 }}>Imports</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {draft.imports.map(entry => (
              <span key={entry} style={chipStyle}>
                {entry}
                <button
                  type="button"
                  aria-label={`Remove import ${entry}`}
                  onClick={() => update({ imports: draft.imports.filter(i => i !== entry) })}
                  style={{ ...iconButtonStyle, width: 18, height: 18, fontSize: 13 }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <select
            aria-label="Add import"
            value=""
            onChange={e => e.target.value && update({ imports: [...draft.imports, e.target.value] })}
            style={{ ...pickerControlStyle, width: '100%', marginTop: 6 }}
          >
            <option value="">Add import…</option>
            {importOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <div style={hintStyle}>
            Imported types can be written without their metamodel prefix, e.g. <code>SubSystem</code> instead
            of <code>simulink::SubSystem</code>.
          </div>

          <div style={{ ...sectionLabelStyle, marginTop: 14 }}>Other utility methods</div>
          {callableHelpers.length === 0 ? (
            <div style={hintStyle}>No other utility methods yet. Once saved, utility methods can call each other.</div>
          ) : (
            <>
              <ul aria-label="Other utility methods" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {callableHelpers.map(other => (
                  <li key={other.id}>
                    <button
                      type="button"
                      onClick={() => insertHelperCall(other)}
                      aria-label={`Insert call of ${other.name}`}
                      title={other.description ?? undefined}
                      style={helperButtonStyle}
                    >
                      <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--v-text)', wordBreak: 'break-all' }}>
                        {formatSignature(other)}
                      </span>
                      {other.problems.length > 0 && (
                        <span style={{ fontSize: 11, color: 'var(--v-danger-text)' }}>
                          Has translation problems
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              <div style={hintStyle}>
                Click to insert a call, or start typing its name in the definition.
                {operationExample && (
                  <> A utility method can also be called on its first argument, e.g. <code>{operationExample}</code>.</>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right: OCL definition and preview */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={panelTitleStyle}>
            <span style={{ flex: 1 }}>
              OCL definition
              <span style={{ fontWeight: 400, marginLeft: 8, fontFamily: MONO }}>
                helper def : {formatSignature(draft)} =
              </span>
            </span>
            <button
              type="button"
              onClick={() => setShowSyntaxHelp(v => !v)}
              aria-expanded={showSyntaxHelp}
              style={{ border: 'none', background: 'transparent', color: '#049484', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
            >
              {showSyntaxHelp ? 'Hide syntax help' : 'Syntax help'}
            </button>
          </div>
          {showSyntaxHelp && (
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--v-border-subtle)', fontSize: 11.5, color: 'var(--v-text-secondary)' }}>
              {SYNTAX_HELP.map(([topic, example]) => (
                <div key={topic} style={{ display: 'flex', gap: 8, padding: '1px 0' }}>
                  <span style={{ width: 90, flexShrink: 0, fontWeight: 600 }}>{topic}</span>
                  <code style={{ fontFamily: MONO }}>{example}</code>
                </div>
              ))}
            </div>
          )}
          <div style={{ flex: 1, minHeight: 140 }}>
            <Editor
              value={draft.body}
              onChange={value => update({ body: value ?? '' })}
              beforeMount={setUpVitruvOcl}
              onMount={handleEditorMount}
              language={vitruvOCLLanguageId}
              theme={HELPER_EDITOR_THEME}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                automaticLayout: true,
                padding: { top: 8, bottom: 8 },
                folding: false,
                overviewRulerLanes: 0,
              }}
            />
          </div>

          <div style={{ height: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--v-border)' }}>
            <div role="tablist" style={{ ...panelTitleStyle, gap: 4 }}>
              {(['java', 'ocl'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={previewTab === tab}
                  onClick={() => setPreviewTab(tab)}
                  style={{
                    border: 'none',
                    borderRadius: 6,
                    padding: '3px 10px',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: previewTab === tab ? 'var(--v-surface)' : 'transparent',
                    color: previewTab === tab ? 'var(--v-text)' : 'var(--v-text-muted)',
                  }}
                >
                  {tab === 'java' ? 'Generated Java' : 'OCL definition'}
                </button>
              ))}
              <span style={{ flex: 1 }} />
              <PreviewStatus incomplete={incomplete} preview={preview} />
            </div>
            <div style={{ flex: 1, overflow: 'auto', background: 'var(--v-surface)' }}>
              {problems.length > 0 && (
                <ul aria-label="Problems" style={{ margin: 0, padding: '8px 12px 8px 28px', color: 'var(--v-danger-text)', fontSize: 12.5 }}>
                  {problems.map(p => (
                    <li key={`${p.line}:${p.column}:${p.message}`}>
                      {p.line !== null ? `Line ${p.line}, column ${p.column}: ` : ''}{p.message}
                    </li>
                  ))}
                </ul>
              )}
              <pre style={{ margin: 0, padding: '8px 12px', fontSize: 12, fontFamily: MONO, color: 'var(--v-text)', whiteSpace: 'pre', tabSize: 4 }}>
                {previewTab === 'java' ? dedent(preview?.javaMethod ?? '') : preview?.oclDefinition ?? ''}
              </pre>
            </div>
          </div>
        </div>
      </div>

      <div style={modalPanelFooterStyle}>
        <span role={saveError ? 'alert' : undefined} style={{ fontSize: 12, color: saveError ? 'var(--v-danger-text)' : 'var(--v-text-muted)' }}>
          {saveError ?? saveHint ?? 'Ready to save.'}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <ActionButton variant="secondary" size="sm" onClick={onCancel} disabled={saving}>Cancel</ActionButton>
          <ActionButton variant="primary" size="sm" onClick={handleSave} disabled={!canSave}>
            {saving ? 'Saving…' : 'Save Utility Method'}
          </ActionButton>
        </div>
      </div>
    </>
  );
};

const iconButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'var(--v-text-muted)',
  cursor: 'pointer',
  fontSize: 16,
  width: 26,
  height: 26,
  borderRadius: 6,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
};

const helperButtonStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 2,
  width: '100%',
  marginTop: 4,
  padding: '6px 8px',
  borderRadius: 8,
  border: '1px solid var(--v-border-subtle)',
  background: 'var(--v-surface)',
  cursor: 'pointer',
  textAlign: 'left',
};

const parameterCardStyle: React.CSSProperties = {
  marginTop: 6,
  padding: 8,
  borderRadius: 8,
  border: '1px solid var(--v-border-subtle)',
  background: 'var(--v-surface)',
};

const chipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 2,
  padding: '2px 4px 2px 8px',
  borderRadius: 999,
  background: 'var(--v-surface-muted)',
  border: '1px solid var(--v-border)',
  fontSize: 12,
  fontFamily: MONO,
  color: 'var(--v-text)',
};

const NameStatusLine: React.FC<{ status: NameStatus }> = ({ status }) => {
  if (status.state === 'checking') return <div style={hintStyle}>Checking name…</div>;
  if (status.state === 'available') {
    return <div style={{ ...hintStyle, color: 'var(--v-success-text)' }}>Name is available.</div>;
  }
  if (status.state === 'unavailable') {
    return <div role="alert" style={{ ...hintStyle, color: 'var(--v-danger-text)' }}>{status.message}</div>;
  }
  return <div style={hintStyle}>Becomes the Java method name, so it must be unique in this project.</div>;
};

const PreviewStatus: React.FC<{ incomplete: string | null; preview: HelperPreviewResponse | null }> = ({ incomplete, preview }) => {
  if (incomplete) return <span style={{ fontWeight: 400 }}>{incomplete}</span>;
  if (!preview) return <span style={{ fontWeight: 400 }}>Translating…</span>;
  if (preview.problems.length > 0) {
    return <span style={{ color: 'var(--v-danger-text)' }}>{preview.problems.length} problem(s)</span>;
  }
  return <span style={{ color: 'var(--v-success-text)' }}>Translates to Java</span>;
};

/** Length of the identifier starting at `start`, to underline a whole word. */
function wordLengthAt(line: string, start: number): number {
  const match = /^[\p{L}\p{N}_]+/u.exec(line.slice(start));
  return match ? match[0].length : 1;
}
