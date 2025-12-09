// @ts-ignore
class ResizeObserver {
    observe() { /* noop */ }
    unobserve() { /* noop */ }
    disconnect() { /* noop */ }
}

Object.defineProperty(globalThis, 'ResizeObserver', {
    writable: true,
    configurable: true,
    value: ResizeObserver,
});