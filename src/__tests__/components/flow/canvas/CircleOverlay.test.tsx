import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { CircleOverlay } from '../../../../components/flow/canvas/CircleOverlay';

const circle = { cx: 400, cy: 300, r: 300 };
const viewport = { x: 0, y: 0, zoom: 1 };
const noop = () => { };
const containerRef = { current: null } as React.RefObject<HTMLDivElement | null>;

it('renders SVG circle elements', () => {
    const { container } = render(
        <CircleOverlay circle={circle} viewport={viewport} selected={false}
            onSelect={noop} onResize={noop} onResizePreview={noop} onResizeEnd={noop} containerRef={containerRef} />
    );
    // Always: 1 hitbox + 1 visible = 2 circles
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBeGreaterThanOrEqual(2);
});

it('does not render when r is 0', () => {
    const { container } = render(
        <CircleOverlay circle={{ cx: 0, cy: 0, r: 0 }} viewport={viewport} selected={false}
            onSelect={noop} onResize={noop} onResizePreview={noop} onResizeEnd={noop} containerRef={containerRef} />
    );
    expect(container.querySelector('circle')).toBeNull();
});

it('shows more circles when selected (resize handle)', () => {
    const { container: c1 } = render(
        <CircleOverlay circle={circle} viewport={viewport} selected={false}
            onSelect={noop} onResize={noop} onResizePreview={noop} onResizeEnd={noop} containerRef={containerRef} />
    );
    const { container: c2 } = render(
        <CircleOverlay circle={circle} viewport={viewport} selected={true}
            onSelect={noop} onResize={noop} onResizePreview={noop} onResizeEnd={noop} containerRef={containerRef} />
    );
    expect(c2.querySelectorAll('circle').length).toBeGreaterThan(c1.querySelectorAll('circle').length);
});

it('calls onSelect when hitbox circle is clicked', () => {
    const onSelect = jest.fn();
    const { container } = render(
        <CircleOverlay circle={circle} viewport={viewport} selected={false}
            onSelect={onSelect} onResize={noop} onResizePreview={noop} onResizeEnd={noop} containerRef={containerRef} />
    );
    // First circle is the hitbox
    const hitbox = container.querySelectorAll('circle')[0];
    fireEvent.click(hitbox);
    expect(onSelect).toHaveBeenCalledTimes(1);
});