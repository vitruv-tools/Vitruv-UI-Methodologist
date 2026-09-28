import type { FC } from 'react';
import type { UmlValidationIssue } from '../../utils/umlValidation';
import {
  DIAGRAM_HINT_TOP,
  UML,
  WORKSPACE_DOT_BACKGROUND,
} from './umlDiagramTheme';

function getConnectModeHint(connectSourceId: string | null): string {
  if (connectSourceId) {
    return 'Click the target class to create a connection';
  }
  return 'Click the source class, then the target class';
}

function getValidationBannerInset(
  classPanelOpen: boolean,
  relationshipPanelOpen: boolean,
): { left: number; right: number } {
  return {
    left: classPanelOpen ? 288 : 12,
    right: relationshipPanelOpen ? 320 : 12,
  };
}

function isSaveMessageSuccess(message: string): boolean {
  return message === 'Saved' || message === 'Saved to project';
}

export interface UMLDiagramEmptyStateProps {
  interactive: boolean;
  onAddClass: () => void;
}

export const UMLDiagramEmptyState: FC<UMLDiagramEmptyStateProps> = ({
  interactive,
  onAddClass,
}) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    height: '100%', color: '#9ca3af', fontSize: 13, gap: 12,
    ...WORKSPACE_DOT_BACKGROUND,
  }}>
    <span>No UML content found.</span>
    {interactive && (
      <button
        type="button"
        onClick={onAddClass}
        style={{
          padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: 8,
          background: '#fff', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}
      >
        + Add class
      </button>
    )}
  </div>
);

export interface UMLDiagramConnectBannerProps {
  connectSourceId: string | null;
}

export const UMLDiagramConnectBanner: FC<UMLDiagramConnectBannerProps> = ({
  connectSourceId,
}) => (
  <div
    data-uml-connect-banner
    style={{
      position: 'absolute',
      top: DIAGRAM_HINT_TOP,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 32,
      padding: '6px 14px',
      borderRadius: 10,
      background: UML.surface,
      border: `1px solid ${UML.primaryBorder}`,
      color: UML.ink,
      fontSize: 11,
      fontWeight: 600,
      fontFamily: UML.fontSans,
      boxShadow: `0 4px 14px ${UML.primaryRing}`,
      pointerEvents: 'none',
      maxWidth: 'min(420px, calc(100vw - 320px))',
      textAlign: 'center',
      lineHeight: 1.35,
    }}
  >
    {getConnectModeHint(connectSourceId)}
  </div>
);

export interface UMLDiagramSaveMessageBannerProps {
  message: string;
}

export const UMLDiagramSaveMessageBanner: FC<UMLDiagramSaveMessageBannerProps> = ({
  message,
}) => {
  const success = isSaveMessageSuccess(message);
  return (
    <div style={{
      position: 'absolute',
      top: 14,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 50,
      padding: '8px 16px',
      borderRadius: 8,
      background: success ? '#ecfdf5' : '#fef2f2',
      border: `1px solid ${success ? '#86efac' : '#fecaca'}`,
      color: success ? '#15803d' : '#dc2626',
      fontSize: 13,
      fontWeight: 600,
      boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
      maxWidth: 'min(480px, 90vw)',
      textAlign: 'center',
      pointerEvents: 'none',
    }}>
      {message}
    </div>
  );
};

export interface UMLDiagramValidationBannerProps {
  issues: UmlValidationIssue[];
  classPanelOpen: boolean;
  relationshipPanelOpen: boolean;
}

export const UMLDiagramValidationBanner: FC<UMLDiagramValidationBannerProps> = ({
  issues,
  classPanelOpen,
  relationshipPanelOpen,
}) => {
  const inset = getValidationBannerInset(classPanelOpen, relationshipPanelOpen);
  return (
    <div
      data-uml-validation
      style={{
        position: 'absolute',
        top: DIAGRAM_HINT_TOP,
        left: inset.left,
        right: inset.right,
        zIndex: 31,
        padding: '8px 12px',
        borderRadius: 8,
        background: '#fffbeb',
        border: '1px solid #fcd34d',
        color: '#92400e',
        fontSize: 11,
        fontFamily: UML.fontSans,
        lineHeight: 1.45,
        maxHeight: 72,
        overflowY: 'auto',
      }}
    >
      {issues.slice(0, 4).map((issue, idx) => (
        <div key={`${issue.message}-${idx}`}>
          {issue.severity === 'error' ? '⛔' : '⚠'} {issue.message}
        </div>
      ))}
      {issues.length > 4 && (
        <div style={{ marginTop: 4, fontStyle: 'italic' }}>
          +{issues.length - 4} more issue(s)
        </div>
      )}
    </div>
  );
};
