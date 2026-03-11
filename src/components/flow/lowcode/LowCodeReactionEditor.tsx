import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
  useCallback,
  type RefObject,
} from "react";
import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  Box,
  Typography,
  CircularProgress,
} from "@mui/material";
import type { EObject } from "ecore-ts";
import type { FlowEcoreEdge } from "../../../types/flow";
import { apiService } from "../../../services/api";
import { LowCodeReactionFieldMetadata } from "../../../types/LowCodeReactionFieldMetadata";
import { LowCodeReactionMetadataResponse } from "../../../types/LowCodeReactionMetadataResponse";
import { LowCodeReactionFieldVariables } from "../../../types/LowCodeReactionFieldVariables";
import { FieldRenderer } from "../FieldRenderer";
import { getFieldDefaultValue } from "../../../utils/FieldUtils";
import { hasLowCodeReactionConfig, temporarilySaveLowCodeReactionConfig } from "../../../utils/LowCodeReactionUtils";
import { splitByEcoreIdentifierSeparators } from "../../../utils/UMLFromEcoreTS";
import type { DragablePanelRef } from "../DragablePanel";
import { ActiveVsumDetails } from "../../../store/ActiveVsumDetails";

/**
 * Configuring reaction mappings inside the React Flow canvas.
 */
interface ReactionEditorProps {
  disabled?: boolean;
  edge: FlowEcoreEdge;
  panelRef?: RefObject<DragablePanelRef | null>;
}

export interface LowCodeReactionEditorRef {
  save: () => void;
  undo: () => void;
}

export const LowCodeReactionEditor = forwardRef<
  LowCodeReactionEditorRef,
  ReactionEditorProps
>(({ disabled = false, edge, panelRef }, ref) => {
  const [loading, setLoading] = useState(true);

  const [lowCodeReactionsMetadata, setLowCodeReactionsMetadata] =
    useState<LowCodeReactionMetadataResponse>({ reactionMetadataMap: {} });

  const [startTemplate, setStartTemplate] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [initialFieldValues, setInitialFieldValues] = useState<Record<string, any> | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const dirtyCheckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const clearDirtyCheckTimeout = useCallback(() => {
    if (dirtyCheckTimeoutRef.current) {
      clearTimeout(dirtyCheckTimeoutRef.current);
      dirtyCheckTimeoutRef.current = null;
    }
  }, []);

  const scheduleDirtyCheck = useCallback(
    (nextFieldValues: Record<string, any>) => {
      clearDirtyCheckTimeout();
      dirtyCheckTimeoutRef.current = setTimeout(() => {
        const baselineValues = initialFieldValues ?? {};
        const dirty =
          JSON.stringify(nextFieldValues) !== JSON.stringify(baselineValues);
        setIsDirty(dirty);
        dirtyCheckTimeoutRef.current = null;
      }, 1000);
    },
    [clearDirtyCheckTimeout, initialFieldValues],
  );

  useEffect(() => {
    panelRef?.current?.setSaveHighlighted(isDirty);
  }, [isDirty, panelRef]);

  useEffect(() => {
    return () => {
      clearDirtyCheckTimeout();
      panelRef?.current?.setSaveHighlighted(false);
    };
  }, [panelRef, clearDirtyCheckTimeout]);

  useEffect(() => {
    // Fetch low-code reactions metadata on mount
    const fetchMetadata = async () => {
      const metadata = await apiService.getLowCodeReactionsMetadata();
      setLowCodeReactionsMetadata(metadata.data);

      // Set first template as default if available
      const firstTemplate = Object.keys(metadata.data.reactionMetadataMap)[0];
      if (firstTemplate) {
        setStartTemplate(firstTemplate);
        setSelectedTemplate(firstTemplate);
        initializeFieldValues(
          metadata.data.reactionMetadataMap[firstTemplate]?.fields || [],
        );
      }

      setLoading(false);
    };

    fetchMetadata();
  }, []);

  const initializeFieldValues = useCallback((fields: LowCodeReactionFieldMetadata[]) => {
    const initialValues: Record<string, any> = {};
    const sourceModelAlias = splitByEcoreIdentifierSeparators(edge.data?.ecore?.fromModel).slice(-1)[0];
    const targetModelAlias = splitByEcoreIdentifierSeparators(edge.data?.ecore?.toModel).slice(-1)[0];
    const sourceAlias = splitByEcoreIdentifierSeparators(edge.data?.ecore?.eObjectSourceId)
      .slice(-1)[0];
    const targetAlias = splitByEcoreIdentifierSeparators(edge.data?.ecore?.eObjectTargetId)
      .slice(-1)[0];
    const variables: Partial<LowCodeReactionFieldVariables> = {
      sourceAlias: sourceAlias,
      targetAlias: targetAlias,
      sourceUri: edge.data?.ecore?.eObjectSourceId,
      targetUri: edge.data?.ecore?.eObjectTargetId,
      sourceModelUri: edge.data?.ecore?.fromModel,
      targetModelUri: edge.data?.ecore?.toModel,
      sourceModelAlias,
      targetModelAlias,
    };
    fields.forEach((field) => {
      initialValues[field.name] = getFieldDefaultValue(field, variables);
    });
    const activeVsumDetails = new ActiveVsumDetails();
    const fgmmr = activeVsumDetails.getFineGranularMetaModelRelation({ sourceId: edge.data?.ecore?.eObjectSourceId!, targetId: edge.data?.ecore?.eObjectTargetId! });
    const nextFieldValues = {
      ...initialValues,
      ...(fgmmr?.lowCodeReactionRequestBase || {}),
    };
    setFieldValues(nextFieldValues);
    setInitialFieldValues(nextFieldValues);
    if (!hasLowCodeReactionConfig(edge)) {
      setIsDirty(true);
    } else {
      setIsDirty(false);
    }
  }, [edge.data?.ecore?.fromModel, edge.data?.ecore?.toModel, edge.data?.ecore?.eObjectSourceId, edge.data?.ecore?.eObjectTargetId]);

  const templateOptions = useMemo(
    () =>
      Array.from(
        Object.entries(lowCodeReactionsMetadata.reactionMetadataMap)
          .filter(([_, v]) => !v.hide)
          .map(([k]) => k),
      ),
    [lowCodeReactionsMetadata],
  );

  const currentFields = useMemo(() => {
    return (
      lowCodeReactionsMetadata.reactionMetadataMap[
        selectedTemplate
      ]?.fields.filter((field) => !field.displayHide) || []
    );
  }, [selectedTemplate, lowCodeReactionsMetadata]);

  const handleTemplateChange = (event: SelectChangeEvent<string>) => {
    const template = event.target.value;
    setSelectedTemplate(template);
    const fields =
      lowCodeReactionsMetadata.reactionMetadataMap[template].fields || [];
    initializeFieldValues(fields);
    setIsDirty(true);
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    const newFieldsValues = {
      ...fieldValues,
      [fieldName]: value,
    };
    setFieldValues(newFieldsValues);
    scheduleDirtyCheck(newFieldsValues);
  };

  const handleSave = useCallback(() => {
    clearDirtyCheckTimeout();
    temporarilySaveLowCodeReactionConfig(
      fieldValues,
      edge,
    );
    setInitialFieldValues(fieldValues);
    setIsDirty(false);
  }, [selectedTemplate, fieldValues, edge, clearDirtyCheckTimeout]);

  const handleUndo = () => {
    clearDirtyCheckTimeout();
    const templateToRestore = startTemplate || selectedTemplate;
    setSelectedTemplate(templateToRestore);
    // Always reset to initial values
    const fields =
      lowCodeReactionsMetadata.reactionMetadataMap[templateToRestore]?.fields || [];
    initializeFieldValues(fields);
  };

  // Expose save and undo methods to parent via ref
  useImperativeHandle(
    ref,
    () => ({
      save: handleSave,
      undo: handleUndo,
    }),
    [selectedTemplate, fieldValues, lowCodeReactionsMetadata],
  );

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      {/* Reaction Template Selection */}
      {templateOptions.length > 0 && (
        <FormControl fullWidth size="small" disabled={disabled}>
          <InputLabel id="reaction-template-label">
            Reaction Template
          </InputLabel>
          <Select
            labelId="reaction-template-label"
            value={selectedTemplate}
            label="Reaction Template"
            onChange={handleTemplateChange}
          >
            {templateOptions.map((template) => (
              <MenuItem key={template} value={template}>
                {template}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {/* Dynamic Fields */}
      {currentFields.length > 0 && (
        <Box
          sx={{
            p: 2,
            border: "1px solid #e0e0e0",
            borderRadius: 1,
            bgcolor: "#fafafa",
            maxHeight: currentFields.length > 6 ? "400px" : "none",
            overflowY: currentFields.length > 6 ? "auto" : "visible",
            "&::-webkit-scrollbar": {
              width: "8px",
            },
            "&::-webkit-scrollbar-track": {
              backgroundColor: "#f1f1f1",
              borderRadius: "4px",
            },
            "&::-webkit-scrollbar-thumb": {
              backgroundColor: "#888",
              borderRadius: "4px",
              "&:hover": {
                backgroundColor: "#555",
              },
            },
          }}
        >
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
            Configuration
          </Typography>
          <Stack spacing={2}>
            {currentFields.map((field) => (
              <FieldRenderer
                key={field.name}
                field={field}
                value={fieldValues[field.name] ?? ""}
                onChange={(value) => handleFieldChange(field.name, value)}
                disabled={disabled}
              />
            ))}
          </Stack>
        </Box>
      )}
    </Stack>
  );
});

LowCodeReactionEditor.displayName = "LowCodeReactionEditor";
