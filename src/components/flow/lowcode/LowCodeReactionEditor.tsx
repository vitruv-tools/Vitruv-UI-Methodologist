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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from "@mui/material";
import type { FlowEcoreEdge } from "../../../types/flow";
import { apiService } from "../../../services/api";
import { LowCodeReactionFieldMetadata } from "../../../types/LowCodeReactionFieldMetadata";
import { LowCodeReactionMetadataResponse } from "../../../types/LowCodeReactionMetadataResponse";
import { LowCodeReactionFieldVariables } from "../../../types/LowCodeReactionFieldVariables";
import { FieldRenderer } from "../FieldRenderer";
import { getFieldDefaultValue } from "../../../utils/FieldUtils";
import { hasLowCodeReactionConfig, temporarilySaveLowCodeReactionConfig } from "../../../utils/LowCodeReactionUtils";
import { splitByEcoreIdentifierSeparators } from "../../../utils/UMLFromEcoreTS";
import type { DragablePanelOptionalToolbarRef, DragablePanelRef } from "../DragablePanel";
import { ActiveVsumDetails } from "../../../store/ActiveVsumDetails";
import { deleteFineGranularReactionEdgeFromVsumDetails, tryInferReactionFiledIdForFineGranularReactionEdge } from "../../../utils/FineGranularReactionUtils";

/**
 * Configuring reaction mappings inside the React Flow canvas.
 */
interface ReactionEditorProps {
  disabled?: boolean;
  edge: FlowEcoreEdge;
  panelRef?: RefObject<DragablePanelRef | null>;
  onDelete?: (edge: FlowEcoreEdge) => void;
}

/**
 * Provides a configurable low-code reaction editor for a selected fine-granular reaction edge.
 * @param {ReactionEditorProps} props - Component props controlling edge context, callbacks, and disabled state.
 * @returns {JSX.Element} The editor UI with template selection, dynamic fields, and save/undo/delete actions.
 */
export const LowCodeReactionEditor = forwardRef<
  DragablePanelOptionalToolbarRef,
  ReactionEditorProps
>(({ disabled = false, edge, panelRef, onDelete }, ref) => {
  const [loading, setLoading] = useState(true);

  const [lowCodeReactionsMetadata, setLowCodeReactionsMetadata] =
    useState<LowCodeReactionMetadataResponse>({ reactionMetadataMap: {} });

  const [startTemplate, setStartTemplate] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [initialFieldValues, setInitialFieldValues] = useState<Record<string, any> | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
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
          .filter(([_, v]) => !v.hide),
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

  const performSave = useCallback(() => {
    const newFieldsValues = {
      ...fieldValues,
      ["regenerate"]: true
    }
    clearDirtyCheckTimeout();
    temporarilySaveLowCodeReactionConfig(
      newFieldsValues,
      edge,
    );
    setIsSaveDialogOpen(false);
    setInitialFieldValues(newFieldsValues);
    setIsDirty(false);
  }, [fieldValues, edge, clearDirtyCheckTimeout]);

  const handleSave = useCallback(() => {
    if (tryInferReactionFiledIdForFineGranularReactionEdge(edge) != null) {
      setIsSaveDialogOpen(true);
    } else {
      performSave();
    }
  }, [edge, performSave]);

  const handleUndo = () => {
    clearDirtyCheckTimeout();
    const templateToRestore = startTemplate || selectedTemplate;
    setSelectedTemplate(templateToRestore);
    // Always reset to initial values
    const fields =
      lowCodeReactionsMetadata.reactionMetadataMap[templateToRestore]?.fields || [];
    initializeFieldValues(fields);
  };

  const performDelete = useCallback(() => {
    deleteFineGranularReactionEdgeFromVsumDetails(edge);
    onDelete?.(edge);
    setIsDeleteDialogOpen(false);
    panelRef?.current?.close();
  }, [edge, onDelete, panelRef]);

  const handleDelete = useCallback(() => {
    if (tryInferReactionFiledIdForFineGranularReactionEdge(edge) != null) {
      setIsDeleteDialogOpen(true);
    } else {
      performDelete();
    }
  }, [edge, performDelete]);

  // Expose save and undo methods to parent via ref
  useImperativeHandle(
    ref,
    () => ({
      save: handleSave,
      undo: handleUndo,
      delete: handleDelete,
    }),
    [handleDelete, handleSave, handleUndo, lowCodeReactionsMetadata, selectedTemplate, fieldValues],
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
              <MenuItem key={template[0]} value={template[0]}>
                {template[1].name || template[0]}
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

      <Dialog
        open={isSaveDialogOpen}
        onClose={() => setIsSaveDialogOpen(false)}
        aria-labelledby="low-code-reaction-save-dialog-title"
        aria-describedby="low-code-reaction-save-dialog-description"
      >
        <DialogTitle id="low-code-reaction-save-dialog-title">
          Save reaction?
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="low-code-reaction-save-dialog-description">
            The reaction will be regenerated and any custom code will be lost.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsSaveDialogOpen(false)}>
            Cancel
          </Button>
          <Button variant="contained" onClick={performSave}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        aria-labelledby="low-code-reaction-delete-dialog-title"
        aria-describedby="low-code-reaction-delete-dialog-description"
      >
        <DialogTitle id="low-code-reaction-delete-dialog-title">
          Delete reaction?
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="low-code-reaction-delete-dialog-description">
            This reaction also has (generated) code, which will also be deleted.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDeleteDialogOpen(false)}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={performDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
});

LowCodeReactionEditor.displayName = "LowCodeReactionEditor";
