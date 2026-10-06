const CARD_COLORS: Record<string, string> = {
  default:  '#bfdbfe',
  computer: '#93c5fd',
  target:   '#86efac',
  modell:   '#d8b4fe',
  model:    '#d8b4fe',
  pcm:      '#fca5a5',
  source:   '#fca5a5',
};

const FALLBACK_PALETTE = ['#fca5a5', '#fde68a', '#6ee7b7', '#a5b4fc', '#f9a8d4', '#67e8f9', '#fb923c', '#c4b5fd'];

export function cardColor(domain?: string): string {
  const key = domain?.toLowerCase().trim() || 'default';
  if (CARD_COLORS[key]) return CARD_COLORS[key];
  let h = 0;
  for (const char of key) h = (char.codePointAt(0) ?? 0) + ((h << 5) - h);
  return FALLBACK_PALETTE[Math.abs(h) % FALLBACK_PALETTE.length];
}

/** Same color on VSUM cards, reaction bounding boxes, and the canvas minimap. */
export function metaModelDisplayColor(domain?: string, fileName?: string): string {
  return cardColor(domain || fileName);
}

export function darken(hex: string, amount = 30): string {
  try {
    const r = Math.max(0, Number.parseInt(hex.slice(1, 3), 16) - amount);
    const g = Math.max(0, Number.parseInt(hex.slice(3, 5), 16) - amount);
    const b = Math.max(0, Number.parseInt(hex.slice(5, 7), 16) - amount);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  } catch { return hex; }
}
