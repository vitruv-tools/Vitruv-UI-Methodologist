const SETTING = 'REACT_APP_COLLABORATION_URL';

/**
 * Reads the address of the collaboration server from the value of `REACT_APP_COLLABORATION_URL`.
 *
 * Returns the WebSocket URL without trailing slashes, or `undefined` if the setting is empty or not
 * a valid address. Then there is no collaboration and the canvas works as it did before it existed,
 * so a wrong value is reported in the console instead of stopping the app.
 *
 * An `http(s)` URL is accepted and turned into the matching `ws(s)` URL.
 */
export function parseCollaborationUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return invalid(trimmed);
  }
  const protocols: Record<string, string> = {
    'ws:': 'ws:',
    'wss:': 'wss:',
    'http:': 'ws:',
    'https:': 'wss:',
  };
  const protocol = protocols[url.protocol];
  if (protocol === undefined || url.host === '') {
    return invalid(trimmed);
  }
  const path = url.pathname.replace(/\/+$/, '');
  return `${protocol}//${url.host}${path}`;
}

function invalid(value: string): undefined {
  console.warn(
    `${SETTING} is "${value}", which is not a ws(s) or http(s) URL. Collaboration is turned off.`,
  );
  return undefined;
}
