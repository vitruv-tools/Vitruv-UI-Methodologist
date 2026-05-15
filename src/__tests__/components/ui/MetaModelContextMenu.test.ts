import { computeMenuPosition } from '../../../components/ui/MetaModelContextMenu';

describe('computeMenuPosition', () => {
  const originalInnerWidth = globalThis.innerWidth;
  const originalInnerHeight = globalThis.innerHeight;

  beforeEach(() => {
    Object.defineProperty(globalThis, 'innerWidth', { value: 1200, configurable: true });
    Object.defineProperty(globalThis, 'innerHeight', { value: 800, configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'innerWidth', { value: originalInnerWidth, configurable: true });
    Object.defineProperty(globalThis, 'innerHeight', { value: originalInnerHeight, configurable: true });
  });

  it('places menu to the right of the card without overlapping', () => {
    const anchorRect = { left: 100, top: 200, width: 320, height: 120 };
    const menuWidth = 260;
    const menuHeight = 200;

    const pos = computeMenuPosition(anchorRect, menuWidth, menuHeight);

    const separatedHorizontally =
      pos.left >= anchorRect.left + anchorRect.width + 12 ||
      pos.left + menuWidth + 12 <= anchorRect.left;
    const separatedVertically =
      pos.top >= anchorRect.top + anchorRect.height + 12 ||
      pos.top + menuHeight + 12 <= anchorRect.top;

    expect(separatedHorizontally || separatedVertically).toBe(true);
  });

  it('places menu to the left when there is no room on the right', () => {
    const anchorRect = { left: 900, top: 200, width: 250, height: 100 };
    const menuWidth = 260;
    const menuHeight = 200;

    const pos = computeMenuPosition(anchorRect, menuWidth, menuHeight);

    expect(pos.left + menuWidth + 12).toBeLessThanOrEqual(anchorRect.left);
  });
});
