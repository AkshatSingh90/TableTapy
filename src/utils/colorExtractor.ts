/**
 * Client-Side Image Palette & Color Harmony Engine
 * 100% in-browser using HTML5 Canvas (0ms latency, zero external APIs)
 */

export interface ColorSwatch {
  hex: string;
  r: number;
  g: number;
  b: number;
  h: number;
  s: number;
  l: number;
  count: number;
}

export interface ExtractedPalette {
  primaryAccent: string;
  secondaryAccent: string;
  ambientLight: string;
  ambientDark: string;
  isDarkImage: boolean;
  hasWhiteBackgroundBox: boolean;
  swatches: string[];
  suggestedLight: {
    name: string;
    primaryColor: string;
    bgColor: string;
    cardStyle: string;
    cardBg: string;
    textColor: string;
    subTextColor: string;
    borderColor: string;
  };
  suggestedDark: {
    name: string;
    primaryColor: string;
    bgColor: string;
    cardStyle: string;
    cardBg: string;
    textColor: string;
    subTextColor: string;
    borderColor: string;
  };
}

// ── Color Utilities ──────────────────────────────────────────────────────────

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (!hex) return null;
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  if (clean.length !== 6) return null;
  const num = parseInt(clean, 16);
  if (isNaN(num)) return null;
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = (v: number) => clamp(v).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100) / 100, l: Math.round(l * 100) / 100 };
}

export function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;

  if (0 <= h && h < 60) { r = c; g = x; b = 0; }
  else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
  else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
  else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
  else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
  else if (300 <= h && h < 360) { r = c; g = 0; b = x; }

  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

/**
 * WCAG 2.1 Standard Relative Luminance (0.0 to 1.0)
 */
export function getRelativeLuminance(colorHex: string): number {
  const rgb = hexToRgb(colorHex);
  if (!rgb) return 1;
  const [r, g, b] = [rgb.r / 255, rgb.g / 255, rgb.b / 255].map(v => 
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function isDarkColor(colorHex: string): boolean {
  if (!colorHex) return false;
  return getRelativeLuminance(colorHex) < 0.35;
}

/**
 * Returns accessible text and surface colors for ANY background
 */
export function getAdaptiveThemeTokens(bgColorHex: string) {
  const dark = isDarkColor(bgColorHex);
  const rgb = hexToRgb(bgColorHex) || { r: 249, g: 250, b: 251 };
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  if (dark) {
    return {
      isDark: true,
      textColor: '#FAFAFA',
      subTextColor: '#A1A1AA',
      mutedText: '#71717A',
      cardBg: hslToHex(hsl.h, Math.min(0.2, hsl.s), 0.12),
      cardBorder: hslToHex(hsl.h, Math.min(0.25, hsl.s), 0.2),
      chipBg: hslToHex(hsl.h, Math.min(0.3, hsl.s), 0.16),
      chipText: '#FAFAFA',
      shadowStyle: 'shadow-lg shadow-black/40'
    };
  }

  // Light background
  return {
    isDark: false,
    textColor: '#111827',
    subTextColor: '#6B7280',
    mutedText: '#9CA3AF',
    cardBg: '#FFFFFF',
    cardBorder: hslToHex(hsl.h, Math.min(0.15, hsl.s), 0.9),
    chipBg: '#F3F4F6',
    chipText: '#111827',
    shadowStyle: 'shadow-xs border border-zinc-200/80'
  };
}

// ── Image Color Extraction Engine ──────────────────────────────────────────

/**
 * Extracts harmonious color palette from any image data URL or image element
 */
export async function extractPaletteFromImage(imageSrc: string): Promise<ExtractedPalette> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('Canvas color extraction only runs in browser'));
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return reject(new Error('Failed to create canvas context'));

        // Sample at 100x100 for instant ~15ms processing
        const width = 100;
        const height = 100;
        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0, width, height);
        const imgData = ctx.getImageData(0, 0, width, height).data;

        // Detect if image is a JPEG logo with white background box (check 4 corners)
        let whiteCornersCount = 0;
        const cornerIndices = [
          0, // top-left
          (width - 1) * 4, // top-right
          ((height - 1) * width) * 4, // bottom-left
          ((height - 1) * width + (width - 1)) * 4 // bottom-right
        ];
        cornerIndices.forEach(idx => {
          const r = imgData[idx];
          const g = imgData[idx + 1];
          const b = imgData[idx + 2];
          const a = imgData[idx + 3];
          if (a > 200 && r > 235 && g > 235 && b > 235) {
            whiteCornersCount++;
          }
        });
        const hasWhiteBackgroundBox = whiteCornersCount >= 3;

        // Quantize colors into buckets (round RGB to nearest multiple of 16)
        const bucketMap = new Map<string, { r: number; g: number; b: number; count: number }>();

        for (let i = 0; i < imgData.length; i += 4) {
          const a = imgData[i + 3];
          if (a < 128) continue; // Skip transparent

          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];

          // Skip near-white if it's a JPEG background box
          if (hasWhiteBackgroundBox && r > 230 && g > 230 && b > 230) continue;
          // Skip extreme pure whites and pitch blacks from dominant accent consideration
          const isNearWhite = r > 245 && g > 245 && b > 245;
          const isNearBlack = r < 18 && g < 18 && b < 18;

          // Bucket rounding step
          const step = 24;
          const qR = Math.round(r / step) * step;
          const qG = Math.round(g / step) * step;
          const qB = Math.round(b / step) * step;
          const key = `${qR},${qG},${qB}`;

          const existing = bucketMap.get(key);
          if (existing) {
            existing.count += 1;
            // Weighted moving average for true centroid
            existing.r = Math.round((existing.r * 3 + r) / 4);
            existing.g = Math.round((existing.g * 3 + g) / 4);
            existing.b = Math.round((existing.b * 3 + b) / 4);
          } else {
            bucketMap.set(key, { r, g, b, count: 1 });
          }
        }

        // Convert buckets to ColorSwatch array
        const swatches: ColorSwatch[] = [];
        bucketMap.forEach(({ r, g, b, count }) => {
          const hsl = rgbToHsl(r, g, b);
          swatches.push({
            hex: rgbToHex(r, g, b),
            r, g, b,
            h: hsl.h,
            s: hsl.s,
            l: hsl.l,
            count
          });
        });

        if (swatches.length === 0) {
          // Fallback if entire image was white/transparent
          return resolve(getDefaultFallbackPalette());
        }

        // Sort candidates
        // Vibrant brand accent score = Saturation * sqrt(Frequency) * penalty for extreme brightness
        const accentCandidates = swatches.filter(s => s.s > 0.15 && s.l > 0.18 && s.l < 0.88);
        accentCandidates.sort((a, b) => {
          const scoreA = a.s * Math.sqrt(a.count) * (1 - Math.abs(a.l - 0.5));
          const scoreB = b.s * Math.sqrt(b.count) * (1 - Math.abs(b.l - 0.5));
          return scoreB - scoreA;
        });

        // Dominant accent color
        const primarySwatch = accentCandidates[0] || swatches.sort((a, b) => b.count - a.count)[0];
        const primaryAccent = primarySwatch ? primarySwatch.hex : '#E46254';

        // Secondary accent: find distinct hue (at least 35 degrees apart)
        const secondaryCandidates = accentCandidates.filter(s => {
          const hueDiff = Math.abs(s.h - primarySwatch.h);
          return hueDiff > 30 && hueDiff < 330;
        });
        const secondaryAccent = secondaryCandidates[0]?.hex || hslToHex((primarySwatch.h + 40) % 360, 0.7, 0.5);

        // Ambient background calculations derived from the primary hue
        // Light Ambient: very high lightness (97%), ultra-low saturation (8%)
        const ambientLight = hslToHex(primarySwatch.h, 0.12, 0.98);
        // Dark Ambient: deep rich obsidian (8% lightness), hint of brand hue (15% saturation)
        const ambientDark = hslToHex(primarySwatch.h, 0.15, 0.08);

        // Distinct top 6 swatches for picker pills
        const topSwatches = swatches
          .filter(s => s.l > 0.1 && s.l < 0.92)
          .sort((a, b) => b.count - a.count)
          .slice(0, 6)
          .map(s => s.hex);

        if (!topSwatches.includes(primaryAccent)) {
          topSwatches.unshift(primaryAccent);
        }

        const avgLuminance = swatches.reduce((sum, s) => sum + s.l * s.count, 0) / swatches.reduce((sum, s) => sum + s.count, 0);

        const result: ExtractedPalette = {
          primaryAccent,
          secondaryAccent,
          ambientLight,
          ambientDark,
          isDarkImage: avgLuminance < 0.45,
          hasWhiteBackgroundBox,
          swatches: topSwatches.slice(0, 6),
          suggestedLight: {
            name: 'Vibrant Light Menu',
            primaryColor: primaryAccent,
            bgColor: ambientLight,
            cardStyle: 'solid',
            cardBg: '#FFFFFF',
            textColor: '#111827',
            subTextColor: '#6B7280',
            borderColor: hslToHex(primarySwatch.h, 0.15, 0.9)
          },
          suggestedDark: {
            name: 'Luxury Bistro Dark',
            primaryColor: primaryAccent,
            bgColor: ambientDark,
            cardStyle: 'solid',
            cardBg: hslToHex(primarySwatch.h, 0.12, 0.14),
            textColor: '#FAFAFA',
            subTextColor: '#A1A1AA',
            borderColor: hslToHex(primarySwatch.h, 0.2, 0.22)
          }
        };

        resolve(result);
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for color extraction'));
    };

    img.src = imageSrc;
  });
}

function getDefaultFallbackPalette(): ExtractedPalette {
  return {
    primaryAccent: '#E46254',
    secondaryAccent: '#F59E0B',
    ambientLight: '#FDFBF7',
    ambientDark: '#121214',
    isDarkImage: false,
    hasWhiteBackgroundBox: false,
    swatches: ['#E46254', '#111827', '#F59E0B', '#10B981', '#6366F1', '#EC4899'],
    suggestedLight: {
      name: 'Vibrant Light Menu',
      primaryColor: '#E46254',
      bgColor: '#FDFBF7',
      cardStyle: 'solid',
      cardBg: '#FFFFFF',
      textColor: '#111827',
      subTextColor: '#6B7280',
      borderColor: '#E5E7EB'
    },
    suggestedDark: {
      name: 'Luxury Bistro Dark',
      primaryColor: '#E46254',
      bgColor: '#121214',
      cardStyle: 'solid',
      cardBg: '#1E1E22',
      textColor: '#FAFAFA',
      subTextColor: '#A1A1AA',
      borderColor: '#2E2E33'
    }
  };
}
