import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Divider,
  FormControlLabel,
  FormGroup,
  Paper,
  Stack,
  Switch,
  Typography,
} from "@mui/material";

export type UMLEdgeDetailsConfig = {
  showReferenceName: boolean;
  showSourceType: boolean;
  showTargetType: boolean;
  showLowerBound: boolean;
  showUpperBound: boolean;
  showDocumentation: boolean;
  showContainment: boolean;
  showBidirectional: boolean;
  showDerived: boolean;
  showTransient: boolean;
  showVolatile: boolean;
  showUnsettable: boolean;
  showUnique: boolean;
  showOrdered: boolean;
};

export const DEFAULT_UMLEdgeDetailsConfig: UMLEdgeDetailsConfig = {
  showReferenceName: true,
  showSourceType: true,
  showTargetType: true,
  showLowerBound: true,
  showUpperBound: true,
  showDocumentation: true,
  showContainment: true,
  showBidirectional: true,
  showDerived: true,
  showTransient: true,
  showVolatile: true,
  showUnsettable: true,
  showUnique: true,
  showOrdered: true,
};

export const DEFAULT_STORAGE_KEY = "umlEdgeDetailsConfig";

/**
 * Returns true when a config flag is enabled or omitted.
 * @param {boolean | undefined} value - Optional boolean value from partial config.
 * @returns {boolean} True when the value is undefined or true.
 */
export function isUndefinedOrTrue(value: boolean | undefined): boolean {
  return value === undefined || value === true;
}

/**
 * Filters unknown entries from a partial config and keeps only boolean fields.
 * @param {Partial<UMLEdgeDetailsConfig> | null | undefined} partial - Partial config input.
 * @returns {Partial<UMLEdgeDetailsConfig>} Sanitized config containing only boolean properties.
 */
export function pickBooleans(
  partial?: Partial<UMLEdgeDetailsConfig> | null,
): Partial<UMLEdgeDetailsConfig> {
  if (!partial) {
    return {};
  }

  const entries = Object.entries(partial).filter(
    ([, value]) => typeof value === "boolean",
  );
  return Object.fromEntries(entries) as Partial<UMLEdgeDetailsConfig>;
};

/**
 * Loads edge detail configuration from local storage.
 * @param {string} storageKey - Local storage key used for persisted config.
 * @returns {Partial<UMLEdgeDetailsConfig>} Parsed and sanitized config values.
 */
export function loadFromStorage(storageKey: string): Partial<UMLEdgeDetailsConfig> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) {
      return {};
    }
    const parsed = JSON.parse(stored) as Partial<UMLEdgeDetailsConfig>;
    return pickBooleans(parsed);
  } catch {
    return {};
  }
};

/**
 * Persists edge detail configuration to local storage.
 * @param {string} storageKey - Local storage key used for persisted config.
 * @param {UMLEdgeDetailsConfig} config - Configuration object to persist.
 * @returns {void}
 */
export function saveToStorage(storageKey: string, config: UMLEdgeDetailsConfig) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(config));
  } catch {
    // Ignore storage errors (e.g., quota exceeded, blocked in private mode)
  }
};

interface UMLEdgeDetailsConfigProps {
  storageKey?: string;
  initialConfig?: Partial<UMLEdgeDetailsConfig>;
  onChange?: (config: UMLEdgeDetailsConfig) => void;
}

const mergeConfig = (
  initialConfig: Partial<UMLEdgeDetailsConfig> | undefined,
  storedConfig: Partial<UMLEdgeDetailsConfig>,
): UMLEdgeDetailsConfig => ({
  ...DEFAULT_UMLEdgeDetailsConfig,
  ...pickBooleans(initialConfig),
  ...storedConfig,
});

/**
 * Renders a settings panel for controlling visible UML edge detail sections.
 * @param {UMLEdgeDetailsConfigProps} props - Storage and callback options for the panel state.
 * @returns {JSX.Element} A grouped switch-based configuration panel.
 */
export const UMLEdgeDetailsConfigPanel: React.FC<UMLEdgeDetailsConfigProps> = ({
  storageKey = DEFAULT_STORAGE_KEY,
  initialConfig,
  onChange,
}) => {
  const storedConfig = useMemo(() => loadFromStorage(storageKey), [storageKey]);
  const [config, setConfig] = useState<UMLEdgeDetailsConfig>(() =>
    mergeConfig(initialConfig, storedConfig),
  );

  useEffect(() => {
    setConfig(mergeConfig(initialConfig, storedConfig));
  }, [initialConfig, storedConfig]);

  useEffect(() => {
    saveToStorage(storageKey, config);
    onChange?.(config);
  }, [config, onChange, storageKey]);

  const handleToggle = useCallback(
    (key: keyof UMLEdgeDetailsConfig) =>
      (event: React.ChangeEvent<HTMLInputElement>) => {
        setConfig((prev) => ({
          ...prev,
          [key]: event.target.checked,
        }));
      },
    [],
  );

  return (
    <Paper elevation={0} sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h6">Edge Details Configuration</Typography>
          <Typography variant="body2" color="text.secondary">
            Toggle what should be displayed in the UML edge details view.
          </Typography>
        </Box>

        <Divider />

        <Box>
          <Typography variant="subtitle2" gutterBottom>
            General
          </Typography>
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={config.showReferenceName}
                  onChange={handleToggle("showReferenceName")}
                />
              }
              label="Reference Name"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={config.showSourceType}
                  onChange={handleToggle("showSourceType")}
                />
              }
              label="Source Type"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={config.showTargetType}
                  onChange={handleToggle("showTargetType")}
                />
              }
              label="Target Type"
            />
          </FormGroup>
        </Box>

        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Bounds
          </Typography>
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={config.showLowerBound}
                  onChange={handleToggle("showLowerBound")}
                />
              }
              label="Lower Bound"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={config.showUpperBound}
                  onChange={handleToggle("showUpperBound")}
                />
              }
              label="Upper Bound"
            />
          </FormGroup>
        </Box>

        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Documentation
          </Typography>
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={config.showDocumentation}
                  onChange={handleToggle("showDocumentation")}
                />
              }
              label="Show Documentation"
            />
          </FormGroup>
        </Box>

        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Properties
          </Typography>
          <FormGroup>
            <Box sx={{ display: "flex" }}>
              <Box sx={{ flex: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.showContainment}
                      onChange={handleToggle("showContainment")}
                    />
                  }
                  label="Containment"
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.showBidirectional}
                      onChange={handleToggle("showBidirectional")}
                    />
                  }
                  label="Bidirectional"
                />
              </Box>
            </Box>
            <Box sx={{ display: "flex" }}>
              <Box sx={{ flex: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.showDerived}
                      onChange={handleToggle("showDerived")}
                    />
                  }
                  label="Derived"
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.showTransient}
                      onChange={handleToggle("showTransient")}
                    />
                  }
                  label="Transient"
                />
              </Box>
            </Box>
            <Box sx={{ display: "flex" }}>
              <Box sx={{ flex: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.showVolatile}
                      onChange={handleToggle("showVolatile")}
                    />
                  }
                  label="Volatile"
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.showUnsettable}
                      onChange={handleToggle("showUnsettable")}
                    />
                  }
                  label="Unsettable"
                />
              </Box>
            </Box>
            <Box sx={{ display: "flex" }}>
              <Box sx={{ flex: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.showUnique}
                      onChange={handleToggle("showUnique")}
                    />
                  }
                  label="Unique"
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.showOrdered}
                      onChange={handleToggle("showOrdered")}
                    />
                  }
                  label="Ordered"
                />
              </Box>
            </Box>
          </FormGroup>
        </Box>
      </Stack>
    </Paper>
  );
};
