import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import type { BuildFailure, BuildProblem } from '../../types/vsumBuild';
import {
  formatBuildFailureAsText,
  formatBuildProblemLocation,
  formatHiddenFollowUpErrors,
  getBuildFailureHeadline,
  getBuildFailureKind,
  groupBuildProblems,
  isNavigableBuildProblem,
  type BuildFailureKind,
} from '../../utils/buildProblems';
import { copyTextToClipboard } from '../../utils/apiErrorMessage';
import { MODAL_Z_INDEX, modalBackdropStyle, useModalBodyLock } from '../ui/modalUtils';
import {
  APP_FONT,
  BRAND_COLOR,
  modalCloseButtonStyle,
  modalPanelFooterStyle,
  modalPanelHeaderStyle,
} from '../ui/sharedStyles';

interface BuildProblemsDialogProps {
  /** The failure to show; the dialog is closed while null. */
  readonly failure: BuildFailure | null;
  /** What failed, e.g. "Runnable JAR export failed". */
  readonly title: string;
  readonly onClose: () => void;
  /**
   * Called for problems that point to a file the canvas can open (see `isNavigableBuildProblem`).
   * Returning false means the file could not be opened; the dialog then says so.
   */
  readonly onOpenProblem?: (problem: BuildProblem) => boolean;
}

const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';
const MONO_FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

const ACCENT_BY_KIND: Record<BuildFailureKind, string> = {
  models: '#dc2626',
  unavailable: '#f59e0b',
  internal: '#64748b',
};

const panelStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  background: 'var(--v-surface)',
  color: 'var(--v-text)',
  borderRadius: 12,
  border: '1px solid var(--v-border)',
  boxShadow: '0 24px 64px rgba(0, 0, 0, 0.22), 0 4px 16px rgba(0, 0, 0, 0.08)',
  width: 760,
  maxWidth: '94vw',
  maxHeight: '85vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  fontFamily: APP_FONT,
};

const groupHeadingStyle: React.CSSProperties = {
  margin: '0 0 8px',
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--v-text)',
  overflowWrap: 'anywhere',
};

const problemItemStyle: React.CSSProperties = {
  border: '1px solid var(--v-border-subtle)',
  borderRadius: 8,
  padding: '10px 12px',
  background: 'var(--v-surface)',
};

const problemButtonStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  background: 'transparent',
  border: 'none',
  padding: 0,
  margin: 0,
  font: 'inherit',
  color: 'inherit',
  cursor: 'pointer',
};

const locationStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--v-text-muted)',
  marginBottom: 2,
};

const messageStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 14,
  lineHeight: 1.45,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
};

const openLinkStyle: React.CSSProperties = {
  display: 'inline-block',
  marginTop: 4,
  fontSize: 12,
  fontWeight: 600,
  color: BRAND_COLOR,
  textDecoration: 'underline',
};

const excerptStyle: React.CSSProperties = {
  margin: '8px 0 0',
  padding: '8px 10px',
  fontFamily: MONO_FONT,
  fontSize: 12,
  lineHeight: 1.4,
  whiteSpace: 'pre',
  overflowX: 'auto',
  background: 'var(--v-surface-muted)',
  border: '1px solid var(--v-border-subtle)',
  borderRadius: 6,
  color: 'var(--v-text)',
};

const hintStyle: React.CSSProperties = {
  margin: '8px 0 0',
  padding: '6px 10px',
  fontSize: 13,
  lineHeight: 1.45,
  background: 'var(--v-info-bg)',
  border: '1px solid var(--v-info-border)',
  borderLeft: '3px solid var(--v-info-text)',
  borderRadius: 6,
  color: 'var(--v-info-text)',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
};

const followUpStyle: React.CSSProperties = {
  margin: '6px 0 0',
  fontSize: 12,
  fontStyle: 'italic',
  color: 'var(--v-text-muted)',
};

const footerButtonStyle: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
  fontFamily: APP_FONT,
};

function countLabel(problemCount: number, fileCount: number): string {
  const problems = problemCount === 1 ? '1 problem' : `${problemCount} problems`;
  if (fileCount === 0) return problems;
  const files = fileCount === 1 ? '1 file' : `${fileCount} files`;
  return `${problems} in ${files}`;
}

interface ProblemItemProps {
  readonly problem: BuildProblem;
  readonly onOpen?: (problem: BuildProblem) => void;
}

const BuildProblemItem: React.FC<ProblemItemProps> = ({ problem, onOpen }) => {
  const location = formatBuildProblemLocation(problem);
  const summary = (
    <>
      {location && <span style={locationStyle}>{location}</span>}
      <span style={messageStyle}>{problem.message}</span>
    </>
  );
  const clickable = Boolean(onOpen) && isNavigableBuildProblem(problem);

  return (
    <li style={problemItemStyle}>
      {clickable ? (
        <button
          type="button"
          style={problemButtonStyle}
          onClick={() => onOpen?.(problem)}
          data-testid="build-problem-open"
        >
          {summary}
          <span style={openLinkStyle}>{location ? `Open at ${location.toLowerCase()}` : 'Open file'}</span>
        </button>
      ) : (
        <div>{summary}</div>
      )}
      {problem.excerpt && (
        <pre style={excerptStyle} data-testid="build-problem-excerpt">
          {problem.excerpt}
        </pre>
      )}
      {problem.hint && (
        <p style={hintStyle} data-testid="build-problem-hint">
          <strong>Hint:</strong>{' '}{problem.hint}
        </p>
      )}
      {problem.hiddenFollowUpErrors ? (
        <p style={followUpStyle}>{formatHiddenFollowUpErrors(problem.hiddenFollowUpErrors)}</p>
      ) : null}
    </li>
  );
};

/**
 * Modal list of the problems of a failed VSUM build or export, grouped by uploaded file.
 * Problems that point to a reaction or metamodel file on the canvas can be opened from here.
 */
export const BuildProblemsDialog: React.FC<BuildProblemsDialogProps> = ({
  failure,
  title,
  onClose,
  onOpenProblem,
}) => {
  const isOpen = failure !== null;
  useModalBodyLock(isOpen);
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const groups = useMemo(() => groupBuildProblems(failure?.problems ?? []), [failure]);

  // Move focus into the dialog when it opens and give it back when it closes.
  useEffect(() => {
    if (!isOpen) return undefined;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    return () => {
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    setCopied(false);
    setNotice(null);
  }, [failure]);

  if (!failure) return null;

  const kind = getBuildFailureKind(failure);
  const fileCount = groups.filter(g => g.isFile).length;

  const handleKeyDown = (event: React.KeyboardEvent) => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !panelRef.current) return;
    const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleOpenProblem = onOpenProblem && ((problem: BuildProblem) => {
    if (!onOpenProblem(problem)) {
      setNotice(`${problem.file ?? 'This file'} is not on the canvas of this project, so it cannot be opened from here.`);
    }
  });

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(formatBuildFailureAsText(failure));
    if (ok) setCopied(true);
  };

  const dialog = (
    <dialog
      open
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      data-testid="build-problems-dialog"
      onKeyDown={handleKeyDown}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        maxWidth: '100%',
        maxHeight: '100%',
        margin: 0,
        padding: 0,
        border: 'none',
        background: 'transparent',
        display: 'grid',
        placeItems: 'center',
        zIndex: MODAL_Z_INDEX,
      }}
    >
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
        style={{ ...modalBackdropStyle, position: 'absolute' }}
      />
      <div ref={panelRef} style={{ ...panelStyle, borderTop: `4px solid ${ACCENT_BY_KIND[kind]}` }}>
        <div style={modalPanelHeaderStyle}>
          <div style={{ minWidth: 0 }}>
            <h2 id={titleId} style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--v-text)' }}>
              {title}
            </h2>
            <p
              id={descriptionId}
              data-testid="build-problems-headline"
              style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--v-text-secondary)' }}
            >
              {getBuildFailureHeadline(kind)}
              {' · '}
              {countLabel(failure.problems.length, fileCount)}
            </p>
            <div role="status" aria-live="polite">
              {notice && (
                <p
                  style={{
                    margin: '8px 0 0',
                    padding: '6px 10px',
                    borderRadius: 8,
                    fontSize: 13,
                    background: 'var(--v-warning-bg)',
                    border: '1px solid var(--v-warning-border)',
                    color: 'var(--v-warning-text)',
                  }}
                >
                  {notice}
                </p>
              )}
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            style={modalCloseButtonStyle}
          >
            ×
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {groups.map(group => (
            <section key={group.key} aria-label={group.label} data-testid="build-problem-group">
              <h3 style={{ ...groupHeadingStyle, fontFamily: group.isFile ? MONO_FONT : APP_FONT }}>
                {group.label}
              </h3>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {group.entries.map(entry => (
                  <BuildProblemItem key={entry.key} problem={entry.problem} onOpen={handleOpenProblem} />
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div style={modalPanelFooterStyle}>
          <button
            type="button"
            onClick={() => { void handleCopy(); }}
            style={{
              ...footerButtonStyle,
              border: '1px solid var(--v-border)',
              background: 'var(--v-surface)',
              color: 'var(--v-text-secondary)',
            }}
          >
            {copied ? 'Copied' : 'Copy details'}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{ ...footerButtonStyle, border: 'none', background: BRAND_COLOR, color: '#fff' }}
          >
            Close
          </button>
        </div>
      </div>
    </dialog>
  );

  return ReactDOM.createPortal(dialog, document.body);
};
