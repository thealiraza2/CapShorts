import { SubtitlePreset } from '../types';

export function getResolvedPreset(base: SubtitlePreset, overrides: Partial<SubtitlePreset>): SubtitlePreset {
  return {
    ...base,
    ...overrides
  };
}

export function formatCasing(text: string, casing: string): string {
  if (!text) return '';
  const c = casing.toLowerCase();
  if (c.includes('upper')) return text.toUpperCase();
  if (c.includes('lower')) return text.toLowerCase();
  if (c.includes('title')) {
    return text.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
  }
  return text;
}

export function buildSubtitleStyle(preset: SubtitlePreset, isHighlighted: boolean = false): React.CSSProperties {
  const color = isHighlighted ? preset.highlightColor : preset.primaryColor;
  const outline = preset.outlineWidth > 0 
    ? `${preset.outlineWidth}px ${preset.outlineColor}` 
    : 'none';
  const shadow = preset.shadowDepth > 0 
    ? `0px ${preset.shadowDepth}px ${preset.shadowDepth * 2}px ${preset.shadowColor}` 
    : 'none';

  return {
    fontFamily: preset.fontFamily,
    fontSize: `${preset.fontSize}px`,
    fontWeight: preset.fontWeight,
    color: color,
    WebkitTextStroke: outline !== 'none' ? outline : undefined,
    paintOrder: 'stroke fill',
    textShadow: shadow !== 'none' ? shadow : undefined,
    backgroundColor: preset.bgBox ? preset.bgBoxColor : 'transparent',
    padding: preset.bgBox ? '4px 12px' : undefined,
    borderRadius: preset.bgBox ? '6px' : undefined,
  };
}
