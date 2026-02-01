import React, { useEffect, useMemo, useState } from 'react';
import {
	FormControl,
	InputLabel,
	MenuItem,
	Select,
	SelectChangeEvent,
	Stack,
} from '@mui/material';
import type { EObject } from 'ecore-ts';
import type { FlowEdge } from '../../types/flow';

const REACTION_TYPES = ['Direct Mapping', 'Direct Mapping with Offset'] as const;
const REACTION_DIRECTIONS = ['M1 to M2', 'M2 to M1', 'Bidirectional'] as const;

export type ReactionType = (typeof REACTION_TYPES)[number];
export type ReactionDirection = (typeof REACTION_DIRECTIONS)[number];

/**
 * Configuring reaction mappings inside the React Flow canvas.
 */
interface ReactionEditorProps {
	selectedType?: ReactionType;
	selectedDirection?: ReactionDirection;
	onTypeChange?: (type: ReactionType) => void;
	onDirectionChange?: (direction: ReactionDirection) => void;
	disabled?: boolean;
	edge: FlowEdge;
    identifiersToEObject: Map<string, EObject>;
}

export const ReactionEditor: React.FC<ReactionEditorProps> = ({
	selectedType,
	selectedDirection,
	onTypeChange,
	onDirectionChange,
	disabled = false,
	edge,
	identifiersToEObject,
}) => {
	const [localType, setLocalType] = useState<ReactionType>(
		selectedType ?? REACTION_TYPES[0]
	);
	const [localDirection, setLocalDirection] = useState<ReactionDirection>(
		selectedDirection ?? REACTION_DIRECTIONS[0]
	);

	useEffect(() => {
		if (selectedType) setLocalType(selectedType);
	}, [selectedType]);

	useEffect(() => {
		if (selectedDirection) setLocalDirection(selectedDirection);
	}, [selectedDirection]);

	const typeOptions = useMemo(() => REACTION_TYPES, []);
	const directionOptions = useMemo(() => REACTION_DIRECTIONS, []);

	const handleTypeChange = (event: SelectChangeEvent<ReactionType>) => {
		const value = event.target.value as ReactionType;
		setLocalType(value);
		onTypeChange?.(value);
	};

	const handleDirectionChange = (
		event: SelectChangeEvent<ReactionDirection>
	) => {
		const value = event.target.value as ReactionDirection;
		setLocalDirection(value);
		onDirectionChange?.(value);
	};

	return (
		<Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <FormControl fullWidth size="small" disabled={disabled}>
                <InputLabel id="reaction-type-label">Type</InputLabel>
                <Select
                    labelId="reaction-type-label"
                    value={localType}
                    label="Type"
                    onChange={handleTypeChange}
                >
                    {typeOptions.map((type) => (
                        <MenuItem key={type} value={type}>
                            {type}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            <FormControl fullWidth size="small" disabled={disabled}>
                <InputLabel id="reaction-direction-label">Direction</InputLabel>
                <Select
                    labelId="reaction-direction-label"
                    value={localDirection}
                    label="Direction"
                    onChange={handleDirectionChange}
                >
                    {directionOptions.map((direction) => (
                        <MenuItem key={direction} value={direction}>
                            {direction}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
        </Stack>
	);
};

