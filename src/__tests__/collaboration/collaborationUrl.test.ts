import { parseCollaborationUrl } from '../../collaboration/collaborationUrl';

describe('parseCollaborationUrl', () => {
  it.each([undefined, '', '   '])('is disabled when the setting is %j', (value) => {
    expect(parseCollaborationUrl(value)).toBeUndefined();
  });

  it.each([
    ['ws://localhost:1234', 'ws://localhost:1234'],
    ['wss://example.org/collaboration', 'wss://example.org/collaboration'],
    ['  wss://example.org/collaboration  ', 'wss://example.org/collaboration'],
  ])('keeps the WebSocket URL %j', (value, expected) => {
    expect(parseCollaborationUrl(value)).toBe(expected);
  });

  it('removes trailing slashes, since the room name is appended with one', () => {
    expect(parseCollaborationUrl('wss://example.org/collaboration///')).toBe('wss://example.org/collaboration');
  });

  it('turns an http(s) URL into the matching WebSocket URL', () => {
    expect(parseCollaborationUrl('http://localhost:1234')).toBe('ws://localhost:1234');
    expect(parseCollaborationUrl('https://example.org/collaboration/')).toBe('wss://example.org/collaboration');
  });

  it.each(['not a url', 'localhost:1234', 'ftp://example.org', 'wss://'])(
    'is disabled, without throwing, for the invalid value %j',
    (value) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(parseCollaborationUrl(value)).toBeUndefined();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('REACT_APP_COLLABORATION_URL'));
      warn.mockRestore();
    },
  );
});
