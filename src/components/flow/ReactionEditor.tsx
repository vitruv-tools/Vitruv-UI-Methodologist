import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Panel } from 'reactflow';
import {
	FormControl,
	IconButton,
	InputLabel,
	MenuItem,
	Paper,
	Select,
	SelectChangeEvent,
	Stack,
	Typography,
} from '@mui/material';
import { DragIndicator, Minimize, Maximize, Close } from '@mui/icons-material';

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
interface ReactionEditorProps {
	selectedType?: ReactionType;
	selectedDirection?: ReactionDirection;
	onTypeChange?: (type: ReactionType) => void;
	onDirectionChange?: (direction: ReactionDirection) => void;
	disabled?: boolean;
}

export const ReactionEditor: React.FC<ReactionEditorProps> = ({
	selectedType,
	selectedDirection,
	onTypeChange,
	onDirectionChange,
	disabled = false,
}) => {
	const [localType, setLocalType] = useState<ReactionType>(
		selectedType ?? REACTION_TYPES[0]
	);
	const [localDirection, setLocalDirection] = useState<ReactionDirection>(
		selectedDirection ?? REACTION_DIRECTIONS[0]
	);
	const [isDragging, setIsDragging] = useState(false);
	const [offset, setOffset] = useState({ dx: 0, dy: 0 });
	const [isMinimized, setIsMinimized] = useState(false);
	const [isVisible, setIsVisible] = useState(true);
	const dragStartRef = useRef({
		// Start mouse x when the current drag started
		startX: 0,
		// Start mouse y when the current drag started
		startY: 0,
		// Start offset x where the current drag started
		startDx: 0,
		// Start offset y where the current drag started
		startDy: 0,
		dxMin: -Infinity,
		dxMax: Infinity,
		dyMin: -Infinity,
		dyMax: Infinity,
	});
	const lastDragOffsetRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
	const panelContentRef = useRef<HTMLDivElement>(null);
	// 48 for the toolbar with "Check build", "Save changes" etc.
	const dragAndDropMargins = { top: 16 + 48, bottom: 16, left: 16, right: 16 };

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

	const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
		if ((e.target as HTMLElement).closest('.drag-handle')) {
			setIsDragging(true);
			const panelEl = panelContentRef.current?.closest('.reaction-wrapper') || undefined; // Panel root element
			const panelRect = panelEl?.getBoundingClientRect();
			const reactFlow = panelEl?.closest('.react-flow') ?? undefined;
			const reactFlowRect = reactFlow?.getBoundingClientRect();

			// Compute horizontal bounds relative to bottom-center base position
			let dxMin = -Infinity;
			let dxMax = Infinity;
			let dyMin = -Infinity;
			let dyMax = Infinity;
			if (panelRect && reactFlowRect) {
				dxMin = reactFlowRect.left - panelRect.left + dragAndDropMargins.left;
				dxMax = reactFlowRect.right - panelRect.right - dragAndDropMargins.right;
				dyMin = reactFlowRect.top - panelRect.top + dragAndDropMargins.top;
				dyMax = reactFlowRect.bottom - panelRect.bottom - dragAndDropMargins.bottom;
			}

			dragStartRef.current = {
				startX: e.clientX,
				startY: e.clientY,
				startDx: offset.dx,
				startDy: offset.dy,
				dxMin,
				dxMax,
				dyMin,
				dyMax,
			};
		}
	};

	useEffect(() => {
		const handleMouseMove = (e: MouseEvent) => {
			if (isDragging) {
				const { startX, startY, startDx, startDy, dxMin, dxMax, dyMin, dyMax } = dragStartRef.current;
				const clampedDx = Math.max(dxMin, Math.min(dxMax, e.clientX - startX));
				const clampedDy = Math.max(dyMin, Math.min(dyMax, e.clientY - startY));
				const clampedOffsetX = startDx + clampedDx;
				const clampedOffsetY = startDy + clampedDy;
				setOffset({ dx: clampedOffsetX, dy: clampedOffsetY });
			}
		};

		const handleMouseUp = () => {
			setIsDragging(false);
		};

		if (isDragging) {
			document.addEventListener('mousemove', handleMouseMove);
			document.addEventListener('mouseup', handleMouseUp);
			return () => {
				document.removeEventListener('mousemove', handleMouseMove);
				document.removeEventListener('mouseup', handleMouseUp);
			};
		}
	}, [isDragging]);

	if (!isVisible) return null;

	return (
		<Panel
			// Base position; override to bottom-center via styles
			position="bottom-left"
			style={{
				left: '50%',
				bottom: 16,
				top: 'auto',
				transform: `translateX(-50%) translate(${offset.dx}px, ${offset.dy}px)`,
				pointerEvents: 'all',
				borderRadius: 12,
				padding: 0,
				width: '30%',
				minWidth: 320,
				zIndex: 1000,
				cursor: isDragging ? 'grabbing' : 'auto',
			}}
			onMouseDown={handleMouseDown}
			className='reaction-wrapper'
		>
			<Paper
				elevation={8}
				sx={{
					width: '100%',
					p: 2,
					borderRadius: 2,
					bgcolor: '#ffffff',
					border: '1px solid #e5e7eb',
				}}
			>
				<Stack spacing={2}>
					<Stack 
						direction="row" 
						alignItems="center" 
						justifyContent="space-between"
						gap={1}
					>
						<Stack 
							direction="row" 
							alignItems="center" 
							gap={0.5}
							className="drag-handle"
							sx={{ 
								cursor: 'grab',
								'&:active': { cursor: 'grabbing' },
								userSelect: 'none',
								flex: 1,
							}}
							ref={panelContentRef}
						>
							<DragIndicator sx={{ fontSize: 18, color: 'text.secondary' }} />
							<Typography variant="subtitle1" fontWeight={700} color="text.primary">
								Reaction
							</Typography>
							<Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
								Configure how mappings behave
							</Typography>
						</Stack>
						<Stack direction="row" gap={0.5}>
							<IconButton 
								size="small" 
								onClick={(e) => {
									e.stopPropagation();
									if (!isMinimized) {
										// Minimizing: snap to starting location
										lastDragOffsetRef.current = { ...offset };
										setOffset({ dx: 0, dy: 0 });
										setIsMinimized(true);
									} else {
										// Maximizing: restore last drag location
										setIsMinimized(false);
										setOffset({ ...lastDragOffsetRef.current });
									}
								}}
								aria-label={isMinimized ? 'maximize' : 'minimize'}
							>
								{isMinimized ? <Maximize sx={{ fontSize: 18 }} /> : <Minimize sx={{ fontSize: 18 }} />}
							</IconButton>
							<IconButton 
								size="small" 
								onClick={(e) => {
									e.stopPropagation();
									setIsVisible(false);
								}}
								aria-label="close"
							>
								<Close sx={{ fontSize: 18 }} />
							</IconButton>
						</Stack>
					</Stack>

					{!isMinimized && (
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
					)}
				</Stack>
			</Paper>
		</Panel>
	);
};

