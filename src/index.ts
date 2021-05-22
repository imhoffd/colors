export type ColorType = 'rgb' | 'rgba' | 'hsl' | 'hsla';

export type ColorValues =
  | [r: number, g: number, b: number]
  | [r: number, g: number, b: number, a: number];

export interface ColorObject {
  type: ColorType;
  values: ColorValues;
}

export const isColorType = (input: any): input is ColorType =>
  typeof input === 'string' && ['rgb', 'rgba', 'hsl', 'hsla'].includes(input);

export const isColorObject = (input: any): input is ColorObject =>
  input &&
  typeof input === 'object' &&
  typeof input.type === 'string' &&
  Array.isArray(input.values);

/**
 * Returns a number whose value is limited to the given range.
 *
 * @param value The value to be clamped
 * @param min The lower boundary of the output range
 * @param max The upper boundary of the output range
 * @returns A number in the range [min, max]
 */
const clamp = (value: number, min = 0, max = 1): number =>
  Math.min(Math.max(min, value), max);

/**
 * Converts a color from CSS hex format to CSS rgb format.
 *
 * @param {string} color - Hex color, i.e. #nnn or #nnnnnn
 * @returns {string} A CSS rgb color string
 */
export const hexToRgb = (color: string): string => {
  color = color.substr(1);

  const re = new RegExp(`.{1,${color.length >= 6 ? 2 : 1}}`, 'g');
  let colors = color.match(re);

  if (colors && colors[0].length === 1) {
    colors = colors.map(n => n + n);
  }

  return colors
    ? `rgb${colors.length === 4 ? 'a' : ''}(${colors
        .map((n, index) => {
          return index < 3
            ? parseInt(n, 16)
            : Math.round((parseInt(n, 16) / 255) * 1000) / 1000;
        })
        .join(', ')})`
    : '';
};

const intToHex = (int: number): string => {
  const hex = int.toString(16);
  return hex.length === 1 ? `0${hex}` : hex;
};

/**
 * Converts a color from CSS rgb format to CSS hex format.
 *
 * @param color - RGB color, i.e. rgb(n, n, n)
 * @returns A CSS rgb color string, i.e. #nnnnnn
 */
export const rgbToHex = (color: ColorObject | string): string => {
  if (typeof color === 'string' && color.startsWith('#')) {
    return color;
  }

  const { values } = decomposeColor(color);
  return `#${values.map(n => intToHex(n)).join('')}`;
};

/**
 * Converts a color from hsl format to rgb format.
 *
 * @param color - HSL color values
 * @returns rgb color values
 */
export const hslToRgb = (color: ColorObject | string): string => {
  const c = decomposeColor(color);
  const { values } = c;
  const h = values[0];
  const s = values[1] / 100;
  const l = values[2] / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number, k = (n + h / 30) % 12) =>
    l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);

  let type: ColorType = 'rgb';
  const rgb: ColorValues = [
    Math.round(f(0) * 255),
    Math.round(f(8) * 255),
    Math.round(f(4) * 255),
  ];

  if (c.type === 'hsla' && values[3]) {
    type = 'rgba';
    rgb.push(values[3]);
  }

  return recomposeColor({ type, values: rgb });
};

/**
 * Returns an object with the type and values of a color.
 *
 * Note: Does not support rgb % values.
 *
 * @param color - CSS color, i.e. one of: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla()
 * @returns - A MUI color object: {type: string, values: number[]}
 */
export const decomposeColor = (color: ColorObject | string): ColorObject => {
  if (isColorObject(color)) {
    return color;
  }

  if (color.charAt(0) === '#') {
    return decomposeColor(hexToRgb(color));
  }

  const marker = color.indexOf('(');
  const type = color.substring(0, marker);

  if (!isColorType(type)) {
    throw new Error(
      `Unsupported '${color}' color.\n` +
        `We support the following formats: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla().`,
    );
  }

  const values = color
    .substring(marker + 1, color.length - 1)
    .split(',')
    .map(value => parseFloat(value)) as ColorValues;

  return { type, values };
};

/**
 * Converts a color object with type and values to a string.
 *
 * @param color - Decomposed color
 * @returns A CSS color string
 */
export const recomposeColor = (color: ColorObject): string => {
  const { type, values } = color;
  let entries: (string | number)[] = [...values];

  if (type.startsWith('rgb')) {
    // Only convert the first 3 values to int (i.e. not alpha)
    entries = values.map((n, i) => (i < 3 ? parseInt(n as any, 10) : n));
  } else if (type.startsWith('hsl')) {
    entries[1] = `${values[1]}%`;
    entries[2] = `${values[2]}%`;
  }

  return `${type}(${entries.join(', ')})`;
};

/**
 * Calculates the contrast ratio between two colors.
 *
 * Formula: https://www.w3.org/TR/WCAG20-TECHS/G17.html#G17-tests
 *
 * @param foreground - CSS color, i.e. one of: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla()
 * @param background - CSS color, i.e. one of: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla()
 * @returns A contrast ratio value in the range 0 - 21.
 */
export const getContrastRatio = (
  foreground: string,
  background: string,
): number => {
  const lumA = getLuminance(foreground);
  const lumB = getLuminance(background);
  return (Math.max(lumA, lumB) + 0.05) / (Math.min(lumA, lumB) + 0.05);
};

/**
 * The relative brightness of any point in a color space,
 * normalized to 0 for darkest black and 1 for lightest white.
 *
 * Formula: https://www.w3.org/TR/WCAG20-TECHS/G17.html#G17-tests
 *
 * @param color - CSS color, i.e. one of: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla()
 * @returns The relative brightness of the color in the range 0 - 1
 */
export const getLuminance = (color: ColorObject | string): number => {
  color = decomposeColor(color);

  const rgb = (
    color.type === 'hsl' ? decomposeColor(hslToRgb(color)).values : color.values
  ).map(val => {
    val /= 255; // normalized
    return val <= 0.03928 ? val / 12.92 : ((val + 0.055) / 1.055) ** 2.4;
  });

  // Truncate at 3 digits
  return Number(
    (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]).toFixed(3),
  );
};

/**
 * Darken or lighten a color, depending on its luminance.
 * Light colors are darkened, dark colors are lightened.
 *
 * @param color - CSS color, i.e. one of: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla()
 * @param coefficient=0.15 - multiplier in the range 0 - 1
 * @returns A CSS color string. Hex input values are returned as rgb
 */
export const emphasize = (color: string, coefficient = 0.15): string =>
  getLuminance(color) > 0.5
    ? darken(color, coefficient)
    : lighten(color, coefficient);

/**
 * Set the absolute transparency of a color.
 * Any existing alpha values are overwritten.
 *
 * @param color - CSS color, i.e. one of: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla()
 * @param value - value to set the alpha channel to in the range 0 -1
 * @returns A CSS color string. Hex input values are returned as rgb
 */
export const fade = (color: ColorObject | string, value: number): string => {
  color = decomposeColor(color);
  value = clamp(value);

  if (color.type === 'rgb' || color.type === 'hsl') {
    color.type += 'a';
  }
  color.values[3] = value;

  return recomposeColor(color);
};

/**
 * Darkens a color.
 *
 * @param color - CSS color, i.e. one of: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla()
 * @param coefficient - multiplier in the range 0 - 1
 * @returns A CSS color string. Hex input values are returned as rgb
 */
export const darken = (
  color: ColorObject | string,
  coefficient: number,
): string => {
  color = decomposeColor(color);
  coefficient = clamp(coefficient);

  if (color.type.startsWith('hsl')) {
    color.values[2] *= 1 - coefficient;
  } else if (color.type.startsWith('rgb')) {
    for (let i = 0; i < 3; i += 1) {
      color.values[i] *= 1 - coefficient;
    }
  }
  return recomposeColor(color);
};

/**
 * Lightens a color.
 *
 * @param color - CSS color, i.e. one of: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla()
 * @param coefficient - multiplier in the range 0 - 1
 * @returns A CSS color string. Hex input values are returned as rgb
 */
export const lighten = (
  color: ColorObject | string,
  coefficient: number,
): string => {
  color = decomposeColor(color);
  coefficient = clamp(coefficient);

  if (color.type.startsWith('hsl')) {
    color.values[2] += (100 - color.values[2]) * coefficient;
  } else if (color.type.startsWith('rgb')) {
    for (let i = 0; i < 3; i += 1) {
      color.values[i] += (255 - color.values[i]) * coefficient;
    }
  }

  return recomposeColor(color);
};
