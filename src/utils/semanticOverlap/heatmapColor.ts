export type Rgb = [number, number, number];

const FALLBACK_LOW: Rgb = [241, 245, 249];
const FALLBACK_HIGH: Rgb = [4, 148, 132];

function parseHex(color: string): Rgb | null {
  const match = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Resolves the theme's heatmap colours (CSS variables) to RGB; call it at draw time. */
export function heatmapColours(): [Rgb, Rgb] {
  const style = getComputedStyle(document.documentElement);
  return [
    parseHex(style.getPropertyValue('--v-heatmap-low')) ?? FALLBACK_LOW,
    parseHex(style.getPropertyValue('--v-heatmap-high')) ?? FALLBACK_HIGH,
  ];
}

/** `rgb(…)` between the low (0) and high (1) heatmap colour; values outside 0..1 are clamped. */
export function heatmapColor(value01: number, [low, high]: [Rgb, Rgb] = heatmapColours()): string {
  const value = Math.min(1, Math.max(0, value01));
  const mix = (k: number) => Math.round(low[k] + (high[k] - low[k]) * value);
  return `rgb(${mix(0)}, ${mix(1)}, ${mix(2)})`;
}

const DARK_TEXT = '#0B1720';
const LIGHT_TEXT = '#ffffff';

/** Dark or light text, whichever is readable on an `rgb(r, g, b)` background. */
export function readableTextOn(rgb: string): string {
  const channels = /rgb\((\d+), (\d+), (\d+)\)/.exec(rgb);
  if (!channels) return DARK_TEXT;
  const [r, g, b] = channels.slice(1).map(Number);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? DARK_TEXT : LIGHT_TEXT;
}
