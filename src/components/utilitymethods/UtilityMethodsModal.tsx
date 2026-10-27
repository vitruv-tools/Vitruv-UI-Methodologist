import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActionButton } from '../ui/ActionButton';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import {
  largeModalPanelStyle,
  modalCloseButtonStyle,
  modalPanelHeaderStyle,
  modalPanelToolbarStyle,
} from '../ui/sharedStyles';
import { MODAL_Z_INDEX, modalBackdropStyle, modalDialogShellStyle, useModalBodyLock } from '../ui/modalUtils';
import {
  apiService,
  type UtilityMethodProblem,
  type UtilityMethodResponse,
  type UtilityMethodTypeResponse,
} from '../../services/api';
import { extractApiErrorMessage } from '../../utils/apiErrorMessage';
import { UtilityMethodEditor } from './UtilityMethodEditor';
import { JavaCodeViewerModal } from './JavaCodeViewerModal';
import { dedent, formatSignature } from './utilityMethodUtils';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const UTILITY_METHOD_CLASS = 'tools.vitruv.methodologisttemplate.consistency.utils.Utility';

interface UtilityMethodsModalProps {
  isOpen: boolean;
  vsumId: number | null;
  /** View-only members can browse utility methods and their Java code but not change them. */
  readOnly?: boolean;
  onClose: () => void;
}

type View = { kind: 'list' } | { kind: 'edit'; utilityMethod: UtilityMethodResponse | null };

interface JavaView {
  title: string;
  subtitle?: string;
  code: string;
  problems?: UtilityMethodProblem[];
}

/**
 * Overview of the project's utility methods: their OCL definitions, the Java they are translated to
 * and the editor to add, change and delete them.
 */
export const UtilityMethodsModal: React.FC<UtilityMethodsModalProps> = ({ isOpen, vsumId, readOnly = false, onClose }) => {
  const [utilityMethods, setUtilityMethods] = useState<UtilityMethodResponse[]>([]);
  const [types, setTypes] = useState<UtilityMethodTypeResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ kind: 'list' });
  const [javaView, setJavaView] = useState<JavaView | null>(null);
  const [filter, setFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<UtilityMethodResponse | null>(null);
  useModalBodyLock(isOpen);

  const load = useCallback(async () => {
    if (vsumId === null) return;
    setLoading(true);
    setError(null);
    try {
      const [loadedUtilityMethods, loadedTypes] = await Promise.all([
        apiService.getUtilityMethods(vsumId),
        apiService.getUtilityMethodTypes(vsumId),
      ]);
      setUtilityMethods(loadedUtilityMethods ?? []);
      setTypes(loadedTypes ?? []);
    } catch (e) {
      setError(extractApiErrorMessage(e, 'The utility methods could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [vsumId]);

  useEffect(() => {
    if (!isOpen) return;
    setView({ kind: 'list' });
    setFilter('');
    load();
  }, [isOpen, load]);

  const visibleUtilityMethods = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return utilityMethods;
    return utilityMethods.filter(h => h.name.toLowerCase().includes(query)
      || (h.description ?? '').toLowerCase().includes(query));
  }, [utilityMethods, filter]);

  if (!isOpen || vsumId === null) return null;

  const showClass = async () => {
    try {
      const generated = await apiService.getUtilityMethodClass(vsumId);
      setJavaView({
        title: generated.fileName,
        subtitle: generated.qualifiedClassName,
        code: generated.source,
        problems: generated.problems,
      });
    } catch (e) {
      setError(extractApiErrorMessage(e, 'The Java class could not be generated.'));
    }
  };

  const confirmDelete = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target) return;
    try {
      await apiService.deleteUtilityMethod(vsumId, target.id);
      await load();
    } catch (e) {
      setError(extractApiErrorMessage(e, `The utility method '${target.name}' could not be deleted.`));
    }
  };

  const handleSaved = async () => {
    setView({ kind: 'list' });
    await load();
  };

  const editing = view.kind === 'edit';

  return (
    <dialog
      open
      aria-labelledby="utility-methods-title"
      style={{ ...modalDialogShellStyle, zIndex: MODAL_Z_INDEX }}
      onCancel={e => {
        e.preventDefault();
        if (!editing) onClose();
      }}
      onKeyDown={e => {
        e.stopPropagation();
        if (e.key === 'Escape' && !editing && !javaView && !deleteTarget) onClose();
      }}
    >
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={editing ? undefined : onClose}
        style={{ ...modalBackdropStyle, position: 'absolute' }}
      />
      <div style={{ ...largeModalPanelStyle, maxWidth: 1280 }}>
        <div style={modalPanelHeaderStyle}>
          <div style={{ minWidth: 0 }}>
            <h3 id="utility-methods-title" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--v-text)' }}>
              {view.kind === 'edit' ? (view.utilityMethod ? `Edit Utility Method ${view.utilityMethod.name}` : 'New Utility Method') : 'Utility Methods'}
            </h3>
            <div style={{ fontSize: 12, color: 'var(--v-text-muted)', marginTop: 2 }}>
              Utility methods for reactions and routines, generated into one Java class.
            </div>
          </div>
          <button type="button" aria-label="Close utility methods" onClick={onClose} style={modalCloseButtonStyle}>×</button>
        </div>

        {error && (
          <div role="alert" style={{ padding: '8px 20px', background: 'var(--v-danger-bg)', color: 'var(--v-danger-text)', fontSize: 12.5, borderBottom: '1px solid var(--v-danger-border)', display: 'flex', gap: 8 }}>
            <span style={{ flex: 1 }}>{error}</span>
            <button type="button" aria-label="Dismiss error" onClick={() => setError(null)} style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer' }}>×</button>
          </div>
        )}

        {view.kind === 'edit' ? (
          <UtilityMethodEditor
            key={view.utilityMethod?.id ?? 'new'}
            vsumId={vsumId}
            utilityMethod={view.utilityMethod}
            types={types}
            utilityMethods={utilityMethods}
            onCancel={() => setView({ kind: 'list' })}
            onSaved={handleSaved}
          />
        ) : (
          <>
            <div style={modalPanelToolbarStyle}>
              {!readOnly && (
                <ActionButton variant="primary" size="sm" onClick={() => setView({ kind: 'edit', utilityMethod: null })}>
                  + New Utility Method
                </ActionButton>
              )}
              <ActionButton variant="secondary" size="sm" onClick={showClass} disabled={utilityMethods.length === 0}>
                View Java class
              </ActionButton>
              <span style={{ flex: 1 }} />
              <input
                aria-label="Filter utility methods"
                placeholder="Filter utility methods…"
                value={filter}
                onChange={e => setFilter(e.target.value)}
                style={{ padding: '6px 10px', border: '1.5px solid var(--v-border)', borderRadius: 8, fontSize: 13, background: 'var(--v-surface-muted)', color: 'var(--v-text)', width: 220 }}
              />
            </div>
            <div style={{ padding: '8px 20px', fontSize: 12, color: 'var(--v-text-secondary)', borderBottom: '1px solid var(--v-border-subtle)', background: 'var(--v-surface-muted)' }}>
              In a reaction, add <code style={{ fontFamily: MONO }}>import {UTILITY_METHOD_CLASS}</code> and call e.g.{' '}
              <code style={{ fontFamily: MONO }}>Utility.{utilityMethods[0]?.name ?? 'myMethod'}(…)</code>.
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
              {loading && utilityMethods.length === 0 && <div style={{ color: 'var(--v-text-muted)', fontSize: 13 }}>Loading utility methods…</div>}
              {!loading && utilityMethods.length === 0 && !error && (
                <EmptyState readOnly={readOnly} onCreate={() => setView({ kind: 'edit', utilityMethod: null })} />
              )}
              {visibleUtilityMethods.map(utilityMethod => (
                <UtilityMethodCard
                  key={utilityMethod.id}
                  utilityMethod={utilityMethod}
                  readOnly={readOnly}
                  onShowJava={() => setJavaView({
                    title: `Java for ${utilityMethod.name}`,
                    subtitle: `${UTILITY_METHOD_CLASS}.${utilityMethod.name}`,
                    code: dedent(utilityMethod.javaMethod ?? ''),
                  })}
                  onEdit={() => setView({ kind: 'edit', utilityMethod })}
                  onDelete={() => setDeleteTarget(utilityMethod)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <JavaCodeViewerModal
        isOpen={javaView !== null}
        title={javaView?.title ?? ''}
        subtitle={javaView?.subtitle}
        code={javaView?.code ?? ''}
        problems={javaView?.problems}
        onClose={() => setJavaView(null)}
      />
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete Utility Method"
        message={`Delete '${deleteTarget?.name}'? Its method is removed from the generated Java class, so reactions calling it will no longer compile.`}
        confirmText="Delete"
        zIndex={MODAL_Z_INDEX + 20}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </dialog>
  );
};

const EmptyState: React.FC<{ readOnly: boolean; onCreate: () => void }> = ({ readOnly, onCreate }) => (
  <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--v-text-secondary)' }}>
    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--v-text)' }}>No utility methods yet</div>
    <p style={{ fontSize: 13, maxWidth: 520, margin: '8px auto 16px' }}>
      Define reusable queries as utility methods with an OCL expression. They are translated into static Java
      methods that every reaction of this project can call.
    </p>
    {!readOnly && <ActionButton variant="primary" size="sm" onClick={onCreate}>+ New Utility Method</ActionButton>}
  </div>
);

interface UtilityMethodCardProps {
  utilityMethod: UtilityMethodResponse;
  readOnly: boolean;
  onShowJava: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const UtilityMethodCard: React.FC<UtilityMethodCardProps> = ({ utilityMethod, readOnly, onShowJava, onEdit, onDelete }) => {
  const translated = utilityMethod.problems.length === 0 && utilityMethod.javaMethod !== null;
  return (
    <article
      aria-label={`Utility method ${utilityMethod.name}`}
      style={{ border: '1px solid var(--v-border)', borderRadius: 10, marginBottom: 12, background: 'var(--v-surface)', overflow: 'hidden' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 14px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: MONO, fontSize: 13, color: 'var(--v-text)', overflowWrap: 'anywhere' }}>
            <strong>{utilityMethod.name}</strong>
            <span style={{ color: 'var(--v-text-muted)' }}>{formatSignature(utilityMethod).slice(utilityMethod.name.length)}</span>
          </div>
          {utilityMethod.description && (
            <div style={{ fontSize: 12.5, color: 'var(--v-text-secondary)', marginTop: 4 }}>{utilityMethod.description}</div>
          )}
          {utilityMethod.imports.length > 0 && (
            <div style={{ fontSize: 11.5, color: 'var(--v-text-muted)', marginTop: 4, fontFamily: MONO }}>
              imports {utilityMethod.imports.join(', ')}
            </div>
          )}
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 999,
            flexShrink: 0,
            background: translated ? 'var(--v-success-bg)' : 'var(--v-danger-bg)',
            color: translated ? 'var(--v-success-text)' : 'var(--v-danger-text)',
          }}
        >
          {translated ? 'Java generated' : 'Cannot be translated'}
        </span>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <ActionButton variant="secondary" size="sm" onClick={onShowJava} disabled={!translated}>View Java</ActionButton>
          {!readOnly && <ActionButton variant="secondary" size="sm" onClick={onEdit}>Edit</ActionButton>}
          {!readOnly && <ActionButton variant="dangerOutline" size="sm" onClick={onDelete}>Delete</ActionButton>}
        </div>
      </div>
      <pre
        aria-label={`OCL definition of ${utilityMethod.name}`}
        style={{ margin: 0, padding: '10px 14px', background: 'var(--v-surface-muted)', borderTop: '1px solid var(--v-border-subtle)', fontFamily: MONO, fontSize: 12, color: 'var(--v-text)', maxHeight: 180, overflow: 'auto', whiteSpace: 'pre-wrap', tabSize: 4 }}
      >
        {utilityMethod.oclDefinition}
      </pre>
      {utilityMethod.problems.map(problem => (
        <div key={`${problem.line}:${problem.column}:${problem.message}`} style={{ padding: '6px 14px', fontSize: 12, color: 'var(--v-danger-text)', borderTop: '1px solid var(--v-border-subtle)' }}>
          {problem.line !== null ? `Line ${problem.line}, column ${problem.column}: ` : ''}{problem.message}
        </div>
      ))}
    </article>
  );
};
