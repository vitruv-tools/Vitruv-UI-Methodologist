export type ReactionLineStyle = 'dashed' | 'solid';

export const DEFAULT_REACTION_LINE_STYLE: ReactionLineStyle = 'dashed';
export const REACTION_LINE_STYLE_STORAGE_KEY = 'vitruv.reactionLineStyle';

export const isReactionLineStyle = (value: unknown): value is ReactionLineStyle =>
  value === 'dashed' || value === 'solid';

export function readStoredReactionLineStyle(): ReactionLineStyle {
  try {
    const stored = localStorage.getItem(REACTION_LINE_STYLE_STORAGE_KEY);
    return isReactionLineStyle(stored) ? stored : DEFAULT_REACTION_LINE_STYLE;
  } catch {
    return DEFAULT_REACTION_LINE_STYLE;
  }
}

export function writeStoredReactionLineStyle(style: ReactionLineStyle): void {
  try {
    localStorage.setItem(REACTION_LINE_STYLE_STORAGE_KEY, style);
  } catch {
    /* quota / private browsing */
  }
}

export function applyReactionLineStyle(style: ReactionLineStyle): void {
  const root = document.documentElement;
  if (style === 'solid') {
    root.style.setProperty('--reaction-line-dasharray', 'none');
    root.style.setProperty('--reaction-line-animation', 'none');
    return;
  }
  root.style.setProperty('--reaction-line-dasharray', '5');
  root.style.setProperty('--reaction-line-animation', 'dashdraw 0.5s linear infinite');
}
