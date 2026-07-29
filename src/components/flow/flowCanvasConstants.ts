import { ECORE_H, ECORE_W } from './flowCanvasLayoutUtils';

/** Footprint of an editable UML class node. */
export const NODE_DIMENSIONS = { width: 280, height: 180 };

/** Footprint of an EcoreFileBox card — kept in step with the layout helpers. */
export const ECORE_FILE_BOX_SIZE = { width: ECORE_W, height: ECORE_H };

/** Palette cycled through when a new metamodel pair first gets an edge. */
export const EDGE_COLOR_LIST = [
  '#ab1c91ff', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
  '#d636a3ff', '#ff9f40', '#4daf4a', '#ff6b6b', '#b388eb',
  '#9c6644', '#f39ed1', '#a9a9a9', '#c9d22f', '#33c7c7',
  '#2a86d6', '#ffb86b', '#63c37a', '#ff4f7a', '#b08fe8',
];
