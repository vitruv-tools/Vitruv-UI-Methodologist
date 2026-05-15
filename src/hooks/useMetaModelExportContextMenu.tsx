import React, { useCallback, useState } from 'react';
import { MetaModelContextMenu } from '../components/ui/MetaModelContextMenu';
import { apiService } from '../services/api';
import {
  downloadMetaModelFile,
  MetaModelExportKind,
  MetaModelWithFileIds,
} from '../utils/metaModelExport';

interface AnchorRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface ContextMenuState {
  x: number;
  y: number;
  model: MetaModelWithFileIds;
  anchorRect: AnchorRect;
}

export function useMetaModelExportContextMenu() {
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [downloading, setDownloading] = useState<MetaModelExportKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, model: MetaModelWithFileIds) => {
      e.preventDefault();
      e.stopPropagation();
      setError(null);
      const target = e.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      setMenu({
        x: e.clientX,
        y: e.clientY,
        model,
        anchorRect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        },
      });
    },
    [],
  );

  const closeMenu = useCallback(() => {
    setMenu(null);
    setDownloading(null);
    setError(null);
  }, []);

  const handleDownload = useCallback(
    async (kind: MetaModelExportKind) => {
      if (!menu) return;
      setDownloading(kind);
      setError(null);
      try {
        await downloadMetaModelFile(menu.model, kind, (id) => apiService.getFile(id));
        closeMenu();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Download failed';
        setError(message);
      } finally {
        setDownloading(null);
      }
    },
    [menu, closeMenu],
  );

  const contextMenu = menu ? (
    <MetaModelContextMenu
      x={menu.x}
      y={menu.y}
      model={menu.model}
      anchorRect={menu.anchorRect}
      onDownload={handleDownload}
      onClose={closeMenu}
      downloading={downloading}
      error={error}
    />
  ) : null;

  return { handleContextMenu, contextMenu };
}
