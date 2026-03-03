import React, { useEffect, useMemo, useState } from "react";
import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  Box,
  Typography,
  Slider,
  Checkbox,
  TextField,
  FormControlLabel,
  CircularProgress,
} from "@mui/material";
import type { EObject } from "ecore-ts";
import type { FlowEdge } from "../../types/flow";
import {
  apiService,
} from "../../services/api";
import {
  LowCodeReactionFieldMetadata} from "../../types/LowCodeReactionFieldMetadata";
import { LowCodeReactionMetadataResponse } from "../../types/LowCodeReactionMetadataResponse";
import { LowCodeReactionFieldVariables } from "../../types/LowCodeReactionFieldVariables";
import { FieldRenderer } from "./FieldRenderer";
import { getFieldDefaultValue } from "../../utils/FieldUtils";

const REACTION_TYPES = [
  "Direct Mapping",
  "Direct Mapping with Offset",
] as const;
const REACTION_DIRECTIONS = ["M1 to M2", "M2 to M1", "Bidirectional"] as const;

export type ReactionType = (typeof REACTION_TYPES)[number];
export type ReactionDirection = (typeof REACTION_DIRECTIONS)[number];

/**
 * Configuring reaction mappings inside the React Flow canvas.
 */
interface ReactionEditorProps {
  disabled?: boolean;
  edge: FlowEdge;
  identifiersToEObject: Map<string, EObject>;
}

export const ReactionEditor: React.FC<ReactionEditorProps> = ({
  disabled = false,
  edge,
  identifiersToEObject,
}) => {
  const [loading, setLoading] = useState(true);

  const [lowCodeReactionsMetadata, setLowCodeReactionsMetadata] =
    useState<LowCodeReactionMetadataResponse>({ reactionMetadataMap: {} });

  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});

  useEffect(() => {
    // Fetch low-code reactions metadata on mount
    const fetchMetadata = async () => {
      const metadata = await apiService.getLowCodeReactionsMetadata();
      setLowCodeReactionsMetadata(metadata.data);

      // Set first template as default if available
      const firstTemplate = Object.keys(metadata.data.reactionMetadataMap)[0];
      if (firstTemplate) {
        setSelectedTemplate(firstTemplate);
        initializeFieldValues(metadata.data.reactionMetadataMap[firstTemplate]?.fields || []);
      }

      setLoading(false);
    };

    fetchMetadata();
  }, []);

  const initializeFieldValues = (fields: LowCodeReactionFieldMetadata[]) => {
    const initialValues: Record<string, any> = {};
    const eSourceObj = identifiersToEObject.get(edge.data!.ecore!.eObjectSourceId)!;
    const eTargetObj = identifiersToEObject.get(edge.data!.ecore!.eObjectTargetId)!;
    const variables: Partial<LowCodeReactionFieldVariables> = { sourceAlias: edge.data?.ecore?.fromModel, targetAlias: edge.data?.ecore?.toModel, sourceUri: edge.data?.ecore?.eObjectSourceId, targetUri: edge.data?.ecore?.eObjectTargetId };
    fields.forEach((field) => {
      initialValues[field.name] = getFieldDefaultValue(field, variables);
    });
    setFieldValues(initialValues);
  };

  const templateOptions = useMemo(
    () => Array.from(Object.entries(lowCodeReactionsMetadata.reactionMetadataMap).filter(([_, v]) => !v.hide).map(([k]) => k)),
    [lowCodeReactionsMetadata],
  );

  const currentFields = useMemo(() => {
    return lowCodeReactionsMetadata.reactionMetadataMap[selectedTemplate]?.fields.filter(field => !field.displayHide) || [];
  }, [selectedTemplate, lowCodeReactionsMetadata]);

  const handleTemplateChange = (event: SelectChangeEvent<string>) => {
    const template = event.target.value;
    setSelectedTemplate(template);
    const fields = lowCodeReactionsMetadata.reactionMetadataMap[template].fields || [];
    initializeFieldValues(fields);
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    setFieldValues((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

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
};
