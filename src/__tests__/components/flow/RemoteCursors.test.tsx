import { render, screen } from '@testing-library/react';
import { RemoteCursors } from '../../../components/flow/canvas/RemoteCursors';

const cursor = { clientId: 5, name: 'Ahmed Ibrahim', initials: 'AI', color: '#3cb44b', x: 100, y: 50 };

describe('RemoteCursors', () => {
  it('renders nothing without cursors', () => {
    const { container } = render(<RemoteCursors cursors={[]} viewport={{ x: 0, y: 0, zoom: 1 }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the initials above the cursor', () => {
    render(<RemoteCursors cursors={[cursor]} viewport={{ x: 0, y: 0, zoom: 1 }} />);
    expect(screen.getByTestId('remote-cursor-initials')).toHaveTextContent('AI');
  });

  it('places the cursor by pan and zoom', () => {
    const { rerender } = render(<RemoteCursors cursors={[cursor]} viewport={{ x: 0, y: 0, zoom: 1 }} />);
    expect(screen.getByTestId('remote-cursor').style.transform).toBe('translate(100px, 50px)');

    rerender(<RemoteCursors cursors={[cursor]} viewport={{ x: 30, y: -10, zoom: 2 }} />);
    expect(screen.getByTestId('remote-cursor').style.transform).toBe('translate(230px, 90px)');
  });
});
