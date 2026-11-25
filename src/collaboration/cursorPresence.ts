import type { Awareness } from 'y-protocols/awareness';

/**
 * Live cursors of the users in a project. They travel as Yjs awareness: state that exists only
 * while a user is connected, is relayed to the others and is never saved into the project.
 *
 * A user's awareness state is `{ user: { name, color }, cursor: { x, y } | null }`, with the cursor
 * in canvas coordinates, so it lands in the right place however the viewer has panned or zoomed.
 */

/** Cursor colors. Chosen so that they can be told apart and read on the light canvas. */
export const CURSOR_COLORS = [
  '#e6194b',
  '#3cb44b',
  '#4363d8',
  '#f58231',
  '#911eb4',
  '#0097a7',
  '#d81b9b',
  '#8a6d00',
  '#5d4037',
  '#00897b',
] as const;

/** The least time between two cursor positions that are sent. */
export const CURSOR_THROTTLE_MS = 50;

export interface CursorPoint {
  x: number;
  y: number;
}

/** A cursor of another user, ready to be drawn. */
export interface RemoteCursor extends CursorPoint {
  clientId: number;
  name: string;
  initials: string;
  color: string;
}

/**
 * The letters shown for a user: the first letter of the first and of the last name
 * ("Ahmed Ibrahim" → "AI"), or the first two letters of a single name ("Ahmed" → "Ah").
 */
export function cursorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  const letters = (part: string) => Array.from(part);
  if (parts.length === 1) {
    const [first = '', second = ''] = letters(parts[0]);
    return first.toLocaleUpperCase() + second.toLocaleLowerCase();
  }
  const first = letters(parts[0])[0] ?? '';
  const last = letters(parts.at(-1) ?? '')[0] ?? '';
  return (first + last).toLocaleUpperCase();
}

/** The name of the signed-in user: given and family name, or the username if there is none. */
export function cursorDisplayName(user: {
  givenName?: string | null;
  familyName?: string | null;
  username?: string | null;
}): string {
  const full = [user.givenName, user.familyName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
  return full || user.username?.trim() || 'User';
}

/**
 * Picks a color that no other user at the moment has. The seed (the client's ID) decides where in
 * the palette it starts looking, so users who join at once don't all take the same one. If every
 * color is taken, the seed's own color is used: two users may then look alike.
 */
export function pickCursorColor(taken: readonly string[], seed: number): string {
  const start = Math.abs(Math.trunc(seed)) % CURSOR_COLORS.length;
  for (let offset = 0; offset < CURSOR_COLORS.length; offset++) {
    const color = CURSOR_COLORS[(start + offset) % CURSOR_COLORS.length];
    if (!taken.includes(color)) {
      return color;
    }
  }
  return CURSOR_COLORS[start];
}

const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function isCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * The cursors of the other users. Awareness is sent by the clients, so whatever it holds is
 * checked: a state without a name or position is skipped, and a color that isn't a plain hex color
 * (it ends up in a style) is replaced.
 */
export function readRemoteCursors(awareness: Awareness): RemoteCursor[] {
  const cursors: RemoteCursor[] = [];
  for (const [clientId, state] of awareness.getStates()) {
    if (clientId === awareness.clientID || typeof state !== 'object' || state === null) {
      continue;
    }
    const { user, cursor } = state as { user?: Record<string, unknown>; cursor?: Record<string, unknown> | null };
    if (!cursor || !isCoordinate(cursor.x) || !isCoordinate(cursor.y)) {
      continue;
    }
    const name = typeof user?.name === 'string' && user.name.trim() !== '' ? user.name : 'User';
    const color =
      typeof user?.color === 'string' && COLOR_PATTERN.test(user.color)
        ? user.color
        : pickCursorColor([], clientId);
    cursors.push({ clientId, name, initials: cursorInitials(name), color, x: cursor.x, y: cursor.y });
  }
  return cursors;
}

/** The colors the other users have chosen. */
function takenColors(awareness: Awareness): string[] {
  const colors: string[] = [];
  for (const [clientId, state] of awareness.getStates()) {
    const color = (state as { user?: { color?: unknown } } | null)?.user?.color;
    if (clientId !== awareness.clientID && typeof color === 'string') {
      colors.push(color);
    }
  }
  return colors;
}

export interface CursorPresenceOptions {
  /** The name shown with the cursor. */
  name: string;
  /** Defaults to {@link CURSOR_THROTTLE_MS}. */
  throttleMs?: number;
}

/**
 * Publishes the local user's cursor. Positions are throttled: the first one is sent at once, and
 * while the mouse keeps moving at most one per interval, always ending with the latest.
 */
export class CursorPresence {
  private pending: CursorPoint | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private lastSent = Number.NEGATIVE_INFINITY;
  private readonly throttleMs: number;

  constructor(
    private readonly awareness: Awareness,
    options: CursorPresenceOptions,
  ) {
    this.throttleMs = options.throttleMs ?? CURSOR_THROTTLE_MS;
    const existing = awareness.getLocalState() as { user?: { color?: unknown } } | null;
    const color =
      typeof existing?.user?.color === 'string'
        ? existing.user.color
        : pickCursorColor(takenColors(awareness), awareness.clientID);
    awareness.setLocalStateField('user', { name: options.name, color });
    awareness.setLocalStateField('cursor', null);
  }

  /** The cursor is at this place of the canvas (canvas coordinates). */
  move(point: CursorPoint): void {
    if (!isCoordinate(point.x) || !isCoordinate(point.y)) {
      return;
    }
    this.pending = { x: point.x, y: point.y };
    const wait = this.lastSent + this.throttleMs - Date.now();
    if (wait <= 0) {
      this.flush();
    } else {
      this.timer ??= setTimeout(() => this.flush(), wait);
    }
  }

  /** The cursor left the canvas: the others stop seeing it at once. */
  leave(): void {
    this.cancel();
    this.awareness.setLocalStateField('cursor', null);
  }

  /** Stops publishing and takes the cursor away. */
  destroy(): void {
    this.leave();
  }

  private flush(): void {
    const point = this.pending;
    this.cancel();
    if (point === null) {
      return;
    }
    this.lastSent = Date.now();
    this.awareness.setLocalStateField('cursor', point);
  }

  private cancel(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.pending = null;
  }
}
