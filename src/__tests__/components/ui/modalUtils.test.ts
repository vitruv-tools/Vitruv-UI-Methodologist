import { renderHook } from '@testing-library/react';
import { useModalBodyLock } from '../../../components/ui/modalUtils';

describe('useModalBodyLock', () => {
  afterEach(() => {
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
  });

  it('locks body scroll while active', () => {
    const { unmount } = renderHook(() => useModalBodyLock(true));
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('does not change body styles when inactive', () => {
    document.body.style.overflow = 'auto';
    renderHook(() => useModalBodyLock(false));
    expect(document.body.style.overflow).toBe('auto');
  });
});
