import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FlowCanvas, type FlowCanvasHandle } from '../components/flow/FlowCanvas';
import { formatVersionLabel } from '../components/canvas/CanvasProjectControls';
import { apiService } from '../services/api';
import { useProjectStore } from '../store/Project';
import type { VsumVersionContentResponse } from '../types/vsumBuild';
import { waitForMetaModelsOnCanvas } from '../utils/canvasLoadUtils';
import { dispatchMetaModelRelations, dispatchWorkspaceMetaModels } from '../utils/canvasWorkspaceLoad';
import { publishedLayoutPositions } from '../utils/publishedVersion';
import { relationsFromVsumDetails } from '../utils/workspaceSnapshotUtils';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; content: VsumVersionContentResponse }
  | { status: 'missing' }
  | { status: 'failed' };

/**
 * The latest published version of a project, read-only: its metamodels and relations at the
 * positions they had when it was published. Nothing here talks to the live project; there is no
 * collaboration, validation, saving or publishing.
 */
export const PublishedVersionPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const canvasRef = useRef<FlowCanvasHandle>(null);

  // The canvas keeps box positions per active project; the published version must neither show
  // nor change those of the live project.
  useEffect(() => {
    useProjectStore.getState().setActiveId(null);
  }, []);

  useEffect(() => {
    if (!Number.isInteger(projectId)) {
      setState({ status: 'missing' });
      return undefined;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    apiService
      .getLatestVsumVersionContent(projectId)
      .then(content => {
        if (!cancelled) setState(content ? { status: 'ready', content } : { status: 'missing' });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'failed' });
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // The boxes arrive as workspace events, like on the project page.
  useEffect(() => {
    const handleAddFile = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail?.fileName || !detail.fileContent) return;
      canvasRef.current?.addEcoreFile?.(detail.fileName, detail.fileContent, detail);
    };
    globalThis.addEventListener('vitruv.addFileToWorkspace', handleAddFile as EventListener);
    return () => globalThis.removeEventListener('vitruv.addFileToWorkspace', handleAddFile as EventListener);
  }, []);

  useEffect(() => {
    if (state.status !== 'ready') return undefined;
    const { project } = state.content;
    const metaModels = project.metaModels ?? [];
    let cancelled = false;
    void (async () => {
      await dispatchWorkspaceMetaModels(metaModels);
      if (cancelled) return;
      await waitForMetaModelsOnCanvas(() => canvasRef.current?.getNodes?.() ?? [], metaModels);
      if (cancelled) return;
      await dispatchMetaModelRelations(relationsFromVsumDetails(project));
      if (cancelled) return;
      canvasRef.current?.setEcorePositions?.(publishedLayoutPositions(project.layout));
      canvasRef.current?.establishBaseline?.();
      globalThis.dispatchEvent(new CustomEvent('vitruv.fitEcoreWorkspace'));
    })();
    return () => {
      cancelled = true;
    };
  }, [state]);

  return (
    <div style={pageStyle}>
      <div data-testid="published-version-banner" style={bannerStyle}>
        <span style={{ fontWeight: 700 }}>{bannerTitle(state)}</span>
        {state.status === 'ready' && (
          <span style={mutedStyle}>
            {state.content.createdBy ? `Published by ${state.content.createdBy} · ` : ''}Read-only
          </span>
        )}
        <Link to={`/canvas/${id}`} style={linkStyle}>
          Open the project
        </Link>
      </div>
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {state.status === 'ready' ? (
          <FlowCanvas ref={canvasRef} readOnly vsumId={String(projectId)} />
        ) : (
          <p style={messageStyle}>{message(state)}</p>
        )}
      </div>
    </div>
  );
};

function bannerTitle(state: LoadState): string {
  if (state.status !== 'ready') return 'Published version';
  const label = formatVersionLabel(state.content) ?? `v${state.content.number}`;
  return `Published version ${label} · ${state.content.project.name}`;
}

function message(state: LoadState): string {
  switch (state.status) {
    case 'loading':
      return 'Loading the published version…';
    case 'missing':
      return 'There is no published version to show. Versions published before they could be viewed cannot be opened; publish the project again to view it.';
    default:
      return 'The published version could not be loaded. Please try again later.';
  }
}

const pageStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  background: 'var(--v-surface-muted)',
  color: 'var(--v-text)',
};

// Theme colours, so the banner reads in light and dark mode.
const bannerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '8px 16px',
  borderBottom: '1px solid var(--v-warning-border)',
  background: 'var(--v-warning-bg)',
  color: 'var(--v-warning-text)',
  fontSize: 13,
};

const mutedStyle: React.CSSProperties = { opacity: 0.8 };

const linkStyle: React.CSSProperties = { marginLeft: 'auto', color: '#049484', fontWeight: 600 };

const messageStyle: React.CSSProperties = { padding: 24, color: 'var(--v-text-muted)' };

export default PublishedVersionPage;
