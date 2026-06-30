/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme');

const SPACING_SCALE = 1.1;
const FONT_SCALE = 1.08;
const RADIUS_SCALE = 1.06;

function scaleLength(value, factor) {
  if (typeof value !== 'string') {
    return value;
  }

  if (value.endsWith('rem') || value.endsWith('px')) {
    const numericValue = Number.parseFloat(value);
    const unit = value.replace(String(numericValue), '');

    return `${Number((numericValue * factor).toFixed(4))}${unit}`;
  }

  return value;
}

function scaleRecord(record, factor) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, scaleLength(value, factor)]),
  );
}

function scaleFontSizes(record, factor) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => {
      if (!Array.isArray(value)) {
        return [key, scaleLength(value, factor)];
      }

      const [fontSize, options] = value;

      return [
        key,
        [
          scaleLength(fontSize, factor),
          options && typeof options === 'object'
            ? {
                ...options,
                lineHeight: options.lineHeight
                  ? scaleLength(options.lineHeight, factor)
                  : options.lineHeight,
              }
            : options,
        ],
      ];
    }),
  );
}

module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'media',
  presets: [require('nativewind/preset')],
  theme: {
    ...defaultTheme,
    borderRadius: scaleRecord(defaultTheme.borderRadius, RADIUS_SCALE),
    fontSize: scaleFontSizes(defaultTheme.fontSize, FONT_SCALE),
    spacing: scaleRecord(defaultTheme.spacing, SPACING_SCALE),
    extend: {},
  },
  plugins: [],
};
