/** Small hex color helpers for dashboard theme mode synthesis. */

export function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(clean)) return null;
  return [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
}

export const rgbToHex = ([r, g, b]: [number, number, number]): string =>
  `#${[r, g, b]
    .map((n) =>
      Math.round(Math.min(255, Math.max(0, n)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;

export function mix(a: string, b: string, amount: number): string {
  const ar = hexToRgb(a);
  const br = hexToRgb(b);
  return ar && br
    ? rgbToHex([
        ar[0] + (br[0] - ar[0]) * amount,
        ar[1] + (br[1] - ar[1]) * amount,
        ar[2] + (br[2] - ar[2]) * amount,
      ])
    : a;
}

const linearize = (channel: number): number =>
  channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

/** WCAG relative luminance (gamma-corrected), 0..1. */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => linearize(v / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
