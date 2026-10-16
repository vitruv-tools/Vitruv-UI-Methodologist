import {
  useCallback,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

interface UseCanvasProjectRenameOptions {
  projectId?: number;
  projectName: string;
  isViewOnly: boolean;
  renameProject: (projectId: number, name: string) => Promise<unknown>;
  onRenamed: (name: string) => void;
}

interface UseCanvasProjectRenameResult {
  editingName: boolean;
  nameInput: string;
  savingName: boolean;
  setNameInput: Dispatch<SetStateAction<string>>;
  startRename: () => void;
  confirmRename: () => Promise<void>;
  cancelRename: () => void;
}

export function useCanvasProjectRename({
  projectId,
  projectName,
  isViewOnly,
  renameProject,
  onRenamed,
}: UseCanvasProjectRenameOptions): UseCanvasProjectRenameResult {
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);

  const startRename = useCallback(() => {
    setNameInput(projectName);
    setEditingName(true);
  }, [projectName]);

  const confirmRename = useCallback(async () => {
    if (isViewOnly) return;
    const trimmedName = nameInput.trim();
    if (!trimmedName || !projectId || trimmedName === projectName) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      await renameProject(projectId, trimmedName);
      onRenamed(trimmedName);
    } catch (error) {
      console.error('Rename failed:', error);
    } finally {
      setSavingName(false);
      setEditingName(false);
    }
  }, [isViewOnly, nameInput, onRenamed, projectId, projectName, renameProject]);

  const cancelRename = useCallback(() => {
    setEditingName(false);
  }, []);

  return {
    editingName,
    nameInput,
    savingName,
    setNameInput,
    startRename,
    confirmRename,
    cancelRename,
  };
}
