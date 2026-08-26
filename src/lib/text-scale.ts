import { PixelRatio, type TextStyle } from "react-native";

/**
 * Thang lineHeight dùng chung cho toàn app.
 *
 * Vì sao cần: React Native KHÔNG nhân `lineHeight` số cứng theo font scale của
 * hệ thống, trong khi `fontSize` thì có. Nên khi người dùng phóng cỡ chữ, màn
 * nào đặt lineHeight rộng tay thì vẫn đọc được, còn màn nào đặt sát mép chữ sẽ
 * bị khít và cắt dấu tiếng Việt ("ằ", "ộ", "ữ"). Mọi lineHeight trong app đi qua
 * `lineHeightFor()` để luôn tỉ lệ thuận với fontSize *và* với font scale.
 */

/** Trần phóng chữ app cho phép - khớp `maxFontSizeMultiplier` ở src/app/_layout.tsx. */
export const TEXT_MAX_FONT_SIZE_MULTIPLIER = 1.15;

/** Nhãn, chip, nút, tiêu đề - chữ ngắn, thường gói trong 1 dòng. */
export const LABEL_LINE_HEIGHT_RATIO = 1.15;

/** Đoạn nội dung nhiều dòng - cần thoáng hơn để dễ đọc. */
export const BODY_LINE_HEIGHT_RATIO = 1.45;

function currentFontScale() {
  return Math.min(PixelRatio.getFontScale(), TEXT_MAX_FONT_SIZE_MULTIPLIER);
}

const lineHeightCache = new Map<string, number>();

/**
 * lineHeight của một cỡ chữ, đã tính cả font scale hệ thống. Dùng khi cần chèn
 * lineHeight vào một style object có sẵn.
 */
export function lineHeightFor(
  fontSize: number,
  ratio: number = LABEL_LINE_HEIGHT_RATIO,
) {
  const scale = currentFontScale();
  const key = `${fontSize}:${ratio}:${scale}`;
  const cached = lineHeightCache.get(key);

  if (cached !== undefined) {
    return cached;
  }

  const value = Math.round(fontSize * ratio * scale);

  lineHeightCache.set(key, value);

  return value;
}

/** Như `lineHeightFor` nhưng theo tỉ lệ của đoạn nội dung nhiều dòng. */
export function bodyLineHeightFor(fontSize: number) {
  return lineHeightFor(fontSize, BODY_LINE_HEIGHT_RATIO);
}

const textStyleCache = new Map<string, TextStyle>();

function buildTextStyle(fontSize: number, ratio: number): TextStyle {
  const key = `${fontSize}:${ratio}:${currentFontScale()}`;
  const cached = textStyleCache.get(key);

  if (cached !== undefined) {
    return cached;
  }

  const style: TextStyle = {
    includeFontPadding: false,
    lineHeight: lineHeightFor(fontSize, ratio),
  };

  textStyleCache.set(key, style);

  return style;
}

/** Style cho chữ ngắn 1 dòng (nhãn, chip, nút, tiêu đề). */
export function textStyle(fontSize: number) {
  return buildTextStyle(fontSize, LABEL_LINE_HEIGHT_RATIO);
}

/** Style cho đoạn nội dung nhiều dòng. */
export function bodyTextStyle(fontSize: number) {
  return buildTextStyle(fontSize, BODY_LINE_HEIGHT_RATIO);
}
