import React, { useEffect, useMemo, useState } from 'react';
import {
	FormControl,
	InputLabel,
	MenuItem,
	Select,
	SelectChangeEvent,
	Stack,
	TextField,
	Typography,
	Box,
	Paper,
	Divider,
	Chip,
} from '@mui/material';
import type { FlowEdge } from '../../types/flow';
import { EObject } from 'ecore-ts';

const REACTION_TYPES = ['Direct Mapping', 'Direct Mapping with Offset'] as const;
const REACTION_DIRECTIONS = ['M1 to M2', 'M2 to M1', 'Bidirectional'] as const;

export type ReactionType = (typeof REACTION_TYPES)[number];
export type ReactionDirection = (typeof REACTION_DIRECTIONS)[number];

/**
 * Floating panel for configuring reaction mappings inside the React Flow canvas.
 *
 * Key behaviors:
 * - Anchors bottom-center via React Flow Panel and applies a drag offset on top.
 * - Dragging is bounded to the React Flow viewport with small margins to avoid clipping.
 * - Minimize snaps back to the starting anchor; maximize restores the last dragged position.
 * - Type and direction selections are locally controlled but propagate via callbacks.
 */
interface UmlEdgeDetailsProps {
    edge: FlowEdge;
    identifiersToEObject: Map<string, EObject>;
}

export const UmlEdgeDetails: React.FC<UmlEdgeDetailsProps> = ({
    edge,
    identifiersToEObject,
}) => {
    const eObject = identifiersToEObject.get(edge.data?.ecore?.eReferenceId ?? '');
    if (!eObject) {
        return <div>No EReference found for this edge.</div>;
    }

    const name = eObject.get<string>('name');
    // We dont display the target type directly, only its name
    const eType = eObject.get<EObject>('eType');
    const eTypeName = eType ? eType.get<string>('name') : null;
    const eContainment = eObject.get<boolean>('containment');
    const lowerBound = eObject.get<string>('lowerBound');
    const upperBound = eObject.get<string>('upperBound');
    const derived = eObject.get<boolean>('derived');
    const transient = eObject.get<boolean>('transient');
    const volatile = eObject.get<boolean>('volatile');
    const unsettable = eObject.get<boolean>('unsettable');
    const unique = eObject.get<boolean>('unique');
    const ordered = eObject.get<boolean>('ordered');
    // We dont display the opposite directly, only the bidirectionality flag
    const eOpposite = eObject.get<EObject>('eOpposite');
    const bidirectional = eOpposite != null;
    // This is a little buggy, so we get a proper array
    const eAnnotations: EObject[] = eObject.get<any | null>("eAnnotations")?.array();
    const documentations: string[] = [];
    for (const eAnnotation of eAnnotations || []) {
        const eContents: EObject[] = eAnnotation.eContents() || [];
        for (const eContent of eContents) {
            if (eContent.get("key") === "documentation") {
                const value = eContent.get<string>("value");
                if (value) {
                    documentations.push(value);
                }
            }
        }
    }
    const documentation = documentations.join('\n');

    // We dont display the source type directly, only its name
    const eTypeSource = identifiersToEObject.get(edge.data?.ecore?.eObjectSourceId ?? '');
    const eTypeSourceName = eTypeSource ? eTypeSource.get<string>('name') : null;

	return (
		<div>		
			<Stack spacing={2}>
				<TextField
					label="Reference Name"
					value={name || 'Not provided'}
					InputProps={{ readOnly: true }}
					fullWidth
					size="small"
				/>
				
                <TextField
					label="Source Type"
					value={eTypeSourceName || 'Not provided'}
					InputProps={{ readOnly: true }}
					fullWidth
					size="small"
				/>

				<TextField
					label="Target Type"
					value={eTypeName || 'Not provided'}
					InputProps={{ readOnly: true }}
					fullWidth
					size="small"
				/>
				
				<Stack direction="row" spacing={2}>
					<TextField
						label="Lower Bound"
						value={lowerBound ?? 'Not provided'}
						InputProps={{ readOnly: true }}
						fullWidth
						size="small"
					/>
					
					<TextField
						label="Upper Bound"
						value={upperBound ?? 'Not provided'}
						InputProps={{ readOnly: true }}
						fullWidth
						size="small"
					/>
				</Stack>

                {documentation !== '' && <TextField
					label="Documentation"
					value={documentation}
					InputProps={{ readOnly: true }}
					fullWidth
					size="small"
                    multiline={true}
                    maxRows={4}
				/>}
				
				<Box>
					<Typography variant="body2" color="text.secondary" gutterBottom>
						Properties
					</Typography>
					<Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
						{eContainment && (
							<Chip label="Containment" color="primary" size="small" />
						)}
						{bidirectional && (
							<Chip label="Bidirectional" color="secondary" size="small" />
						)}
						{derived && (
							<Chip label="Derived" size="small" />
						)}
						{transient && (
							<Chip label="Transient" size="small" />
						)}
						{volatile && (
							<Chip label="Volatile" size="small" />
						)}
						{unsettable && (
							<Chip label="Unsettable" size="small" />
						)}
						{unique && (
							<Chip label="Unique" size="small" />
						)}
						{ordered && (
							<Chip label="Ordered" size="small" />
						)}
					</Stack>
				</Box>
			</Stack>
		</div>
	);
};

