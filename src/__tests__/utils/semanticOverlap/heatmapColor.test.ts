import { heatmapColor, heatmapColours, readableTextOn, type Rgb } from '../../../utils/semanticOverlap/heatmapColor';

const scale: [Rgb, Rgb] = [[0, 100, 200], [200, 100, 0]];

describe('heatmapColor', () => {
  it('maps 0 and 1 to the low and high colour and mixes in between', () => {
    expect(heatmapColor(0, scale)).toBe('rgb(0, 100, 200)');
    expect(heatmapColor(1, scale)).toBe('rgb(200, 100, 0)');
    expect(heatmapColor(0.5, scale)).toBe('rgb(100, 100, 100)');
  });

  it('clamps values outside 0..1', () => {
    expect(heatmapColor(-1, scale)).toBe('rgb(0, 100, 200)');
    expect(heatmapColor(2, scale)).toBe('rgb(200, 100, 0)');
  });

  it('reads the theme colours from the CSS variables, with a fallback', () => {
    document.documentElement.style.setProperty('--v-heatmap-low', '#000000');
    document.documentElement.style.setProperty('--v-heatmap-high', '#ffffff');
    expect(heatmapColours()).toEqual([[0, 0, 0], [255, 255, 255]]);
    expect(heatmapColor(1)).toBe('rgb(255, 255, 255)');
    document.documentElement.style.removeProperty('--v-heatmap-low');
    document.documentElement.style.removeProperty('--v-heatmap-high');
    expect(heatmapColours()).toEqual([[241, 245, 249], [4, 148, 132]]);
  });
});

describe('readableTextOn', () => {
  it('uses dark text on light cells and light text on dark cells', () => {
    expect(readableTextOn('rgb(241, 245, 249)')).toBe('#0B1720');
    expect(readableTextOn('rgb(4, 148, 132)')).toBe('#ffffff');
    expect(readableTextOn('rgb(30, 41, 59)')).toBe('#ffffff');
    expect(readableTextOn('not a colour')).toBe('#0B1720');
  });
});
