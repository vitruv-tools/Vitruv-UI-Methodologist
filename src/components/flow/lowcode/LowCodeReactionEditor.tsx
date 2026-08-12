import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import type { FlowEcoreEdge } from '../../../types/flow';
import type { LowCodeReactionMetadata } from '../../../types/LowCodeReactionMetadata';
import type { LowCodeReactionMetadataResponse } from '../../../types/LowCodeReactionMetadataResponse';
import type { LowCodeReactionFieldVariables } from '../../../types/LowCodeReactionFieldVariables';
import { apiService } from '../../../services/api';
import {
  buildInitialFieldValues,
  isHidden,
} from '../../../utils/FieldUtils';
import {
  temporarilySaveLowCodeReactionConfig,
  getLowCodeReactionConfig,
  hasLowCodeReactionConfig,
} from '../../../utils/LowCodeReactionUtils';
import {
  extractModelFromEObjectId,
  extractElementFromEObjectId,
  deriveModelAlias,
  deriveElementAlias,
} from '../../../utils/EcoreIdentifiers';
import FieldRenderer from '../FieldRenderer';

// ── Public imperative API ───────────────────────────────────────────────

export interface LowCodeReactionEditorHandle {
  save: () => void;
  undo: () => void;
  delete: () => void;
  isDirty: () => boolean;
}

interface LowCodeReactionEditorProps {
  edge: FlowEcoreEdge;
  onSaveComplete?: () => void;
  onDeleteRequest?: () => void;
}

/**
 * Metadata-driven form editor for fine-granular reactions.
 *
 * Fetches reaction templates from `/api/lowcode-metadata` on mount,
 * renders a template selector and dynamic fields via FieldRenderer,
 * and exposes imperative `save` / `undo` / `delete` via ref.
 */
const LowCodeReactionEditor = forwardRef<
  LowCodeReactionEditorHandle,
  LowCodeReactionEditorProps
>(({ edge, onSaveComplete, onDeleteRequest }, ref) => {
  const [metadata, setMetadata] = useState<LowCodeReactionMetadataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({});
  const [lastSaved, setLastSaved] = useState<Record<string, unknown>>({});

  const variables = useMemo<LowCodeReactionFieldVariables | undefined>(() => {
    const ecore = edge.data?.ecore;
    if (!ecore) return undefined;
    return {
      sourceModelUri: ecore.fromModel,
      sourceModelAlias: deriveModelAlias(ecore.fromModel),
      sourceUri: ecore.eObjectSourceId,
      sourceAlias: deriveElementAlias(ecore.eObjectSourceId),
      targetModelUri: ecore.toModel,
      targetModelAlias: deriveModelAlias(ecore.toModel),
      targetUri: ecore.eObjectTargetId,
      targetAlias: deriveElementAlias(ecore.eObjectTargetId),
    };
  }, [edge]);

  // Fetch metadata on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiService
      .getLowCodeReactionsMetadata()
      .then((response) => {
        if (cancelled) return;
        setMetadata(response.data);

        // Restore saved values if they exist
        const saved = getLowCodeReactionConfig(edge);
        if (saved) {
          setFieldValues(saved);
          setLastSaved(saved);
          const savedTemplate = saved._reactionTemplate as string | undefined;
          if (savedTemplate) setSelectedTemplate(savedTemplate);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('[LowCodeReactionEditor] Failed to fetch metadata:', err);
        setError('Failed to load reaction templates');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [edge]);

  const currentTemplate: LowCodeReactionMetadata | null = useMemo(() => {
    if (!metadata || !selectedTemplate) return null;
    return metadata.reactionMetadataMap[selectedTemplate] ?? null;
  }, [metadata, selectedTemplate]);

  const visibleFields = useMemo(() => {
    if (!currentTemplate) return [];
    return currentTemplate.fields.filter((f) => !isHidden(f));
  }, [currentTemplate]);

  const templateNames = useMemo(() => {
    if (!metadata) return [];
    return Object.entries(metadata.reactionMetadataMap)
      .filter(([, meta]) => meta.hide !== true)
      .map(([name]) => name);
  }, [metadata]);

  // When template changes, initialize field values
  const handleTemplateChange = useCallback(
    (name: string) => {
      setSelectedTemplate(name);
      const template = metadata?.reactionMetadataMap[name];
      if (!template) return;

      const initial = buildInitialFieldValues(template.fields, variables);
      initial._reactionTemplate = name;
      setFieldValues(initial);
    },
    [metadata, variables],
  );

  const handleFieldChange = useCallback((name: string, value: unknown) => {
    setFieldValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const isDirty = useCallback(() => {
    return JSON.stringify(fieldValues) !== JSON.stringify(lastSaved);
  }, [fieldValues, lastSaved]);

  // ── Imperative API ──────────────────────────────────────────────────

  useImperativeHandle(ref, () => ({
    save: () => {
      temporarilySaveLowCodeReactionConfig(fieldValues, edge);
      setLastSaved({ ...fieldValues });
      onSaveComplete?.();
    },
    undo: () => {
      setFieldValues({ ...lastSaved });
      const savedTemplate = lastSaved._reactionTemplate as string | undefined;
      if (savedTemplate) setSelectedTemplate(savedTemplate);
    },
    delete: () => {
      onDeleteRequest?.();
    },
    isDirty,
  }));

  // ── Render ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (error) {
    return (
      <Typography color="error" variant="body2" sx={{ p: 2 }}>
        {error}
      </Typography>
    );
  }

  const ecore = edge.data?.ecore;

  return (
    <div>
      {/* Connection info */}
      {ecore && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          {deriveModelAlias(ecore.fromModel)}.{extractElementFromEObjectId(ecore.eObjectSourceId)}
          {' → '}
          {deriveModelAlias(ecore.toModel)}.{extractElementFromEObjectId(ecore.eObjectTargetId)}
        </Typography>
      )}

      {/* Template selector */}
      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
        <InputLabel>Reaction Template</InputLabel>
        <Select
          value={selectedTemplate}
          label="Reaction Template"
          onChange={(e) => handleTemplateChange(e.target.value)}
        >
          {templateNames.map((name) => (
            <MenuItem key={name} value={name}>
              {metadata!.reactionMetadataMap[name].name ?? name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Dynamic fields */}
      {visibleFields.map((field) => (
        <FieldRenderer
          key={field.name}
          field={field}
          value={fieldValues[field.name]}
          onChange={handleFieldChange}
        />
      ))}

      {selectedTemplate && visibleFields.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No configurable fields for this template.
        </Typography>
      )}
    </div>
  );
});

LowCodeReactionEditor.displayName = 'LowCodeReactionEditor';

export default LowCodeReactionEditor;
