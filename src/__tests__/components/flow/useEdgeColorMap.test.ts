import { renderHook } from '@testing-library/react';
import {
  getEdgeColorStorageKey,
  pairKey,
  resolveNextColorIndex,
  useEdgeColorMap,
} from '../../../components/flow/useEdgeColorMap';
import { EDGE_COLOR_LIST } from '../../../components/flow/flowCanvasConstants';

describe('pairKey', () => {
  it('is independent of argument order', () => {
    expect(pairKey('b', 'a')).toBe(pairKey('a', 'b'));
  });

  it('separates the two ids', () => {
    expect(pairKey('a', 'b')).toBe('a::b');
  });
});

describe('getEdgeColorStorageKey', () => {
  it('scopes the key to user and project when both are known', () => {
    expect(getEdgeColorStorageKey('u1', 'v2')).toBe('flow_edge_color_map_v1_user_u1_vsum_v2');
  });

  it('falls back to a shared key when either is missing', () => {
    expect(getEdgeColorStorageKey(undefined, 'v2')).toBe('flow_edge_color_map_v1');
    expect(getEdgeColorStorageKey('u1', undefined)).toBe('flow_edge_color_map_v1');
  });
});

describe('resolveNextColorIndex', () => {
  it('starts at zero when nothing is in use', () => {
    expect(resolveNextColorIndex([])).toBe(0);
  });

  it('resumes after the highest-numbered colour in use', () => {
    expect(resolveNextColorIndex([EDGE_COLOR_LIST[2]])).toBe(3);
  });

  it('wraps back to the start once the palette is exhausted', () => {
    expect(resolveNextColorIndex([EDGE_COLOR_LIST[EDGE_COLOR_LIST.length - 1]])).toBe(0);
  });

  it('ignores colours outside the palette', () => {
    expect(resolveNextColorIndex(['#not-a-palette-colour'])).toBe(0);
  });
});

describe('useEdgeColorMap', () => {
  beforeEach(() => localStorage.clear());

  it('returns a stable colour for a pair regardless of order', () => {
    const { result } = renderHook(() => useEdgeColorMap('u', 'v'));

    const first = result.current.getColorForPair('a', 'b');
    expect(result.current.getColorForPair('b', 'a')).toBe(first);
  });

  it('hands out a different colour to a different pair', () => {
    const { result } = renderHook(() => useEdgeColorMap('u', 'v'));

    expect(result.current.getColorForPair('a', 'b'))
      .not.toBe(result.current.getColorForPair('a', 'c'));
  });

  it('persists assignments under the scoped storage key', () => {
    const { result } = renderHook(() => useEdgeColorMap('u', 'v'));
    const color = result.current.getColorForPair('a', 'b');

    const stored = JSON.parse(localStorage.getItem(getEdgeColorStorageKey('u', 'v'))!);
    expect(stored['a::b']).toBe(color);
  });

  it('restores colours assigned in an earlier session', () => {
    localStorage.setItem(
      getEdgeColorStorageKey('u', 'v'),
      JSON.stringify({ 'a::b': EDGE_COLOR_LIST[4] }),
    );

    const { result } = renderHook(() => useEdgeColorMap('u', 'v'));

    expect(result.current.getColorForPair('a', 'b')).toBe(EDGE_COLOR_LIST[4]);
  });

  it('continues the palette after restored colours instead of repeating', () => {
    localStorage.setItem(
      getEdgeColorStorageKey('u', 'v'),
      JSON.stringify({ 'a::b': EDGE_COLOR_LIST[0] }),
    );

    const { result } = renderHook(() => useEdgeColorMap('u', 'v'));

    expect(result.current.getColorForPair('x', 'y')).toBe(EDGE_COLOR_LIST[1]);
  });

  it('survives corrupt stored data', () => {
    localStorage.setItem(getEdgeColorStorageKey('u', 'v'), 'not json');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => useEdgeColorMap('u', 'v'));

    expect(result.current.getColorForPair('a', 'b')).toBe(EDGE_COLOR_LIST[0]);
    warn.mockRestore();
  });
});
