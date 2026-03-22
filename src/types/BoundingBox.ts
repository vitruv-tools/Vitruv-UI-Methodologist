/**
 * Axis-aligned rectangle used for node grouping and overlap calculations.
 */
export type BoundingBox = {
  rearrangeKey: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
};
