#!/usr/bin/env ts-node
/**
 * Script để validate translations
 *
 * Kiểm tra:
 * 1. Tất cả keys trong vi.json đều có trong en.json và ngược lại
 * 2. Không có key trùng lặp
 * 3. Không có value rỗng
 * 4. Format đúng chuẩn
 *
 * Chạy: npx ts-node scripts/validate-translations.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface TranslationObject {
  [key: string]: string | TranslationObject;
}

interface ValidationError {
  type: 'missing_key' | 'empty_value' | 'duplicate_key' | 'format_error';
  language: 'vi' | 'en';
  key: string;
  message: string;
}

const LOCALES_DIR = path.join(__dirname, '../src/locales');
const VI_PATH = path.join(LOCALES_DIR, 'vi.json');
const EN_PATH = path.join(LOCALES_DIR, 'en.json');

/**
 * Đọc và parse file JSON
 */
function loadTranslations(filePath: string): TranslationObject {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`❌ Không thể đọc file: ${filePath}`);
    console.error(error);
    process.exit(1);
  }
}

/**
 * Flatten nested object thành flat keys
 * { auth: { login: { title: "..." } } } => { "auth.login.title": "..." }
 */
function flattenKeys(obj: TranslationObject, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      result[fullKey] = value;
    } else if (typeof value === 'object' && value !== null) {
      Object.assign(result, flattenKeys(value, fullKey));
    }
  }

  return result;
}

/**
 * Kiểm tra keys bị thiếu giữa 2 ngôn ngữ
 */
function findMissingKeys(
  sourceKeys: Set<string>,
  targetKeys: Set<string>,
  sourceLang: 'vi' | 'en',
  targetLang: 'vi' | 'en'
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const key of sourceKeys) {
    if (!targetKeys.has(key)) {
      errors.push({
        type: 'missing_key',
        language: targetLang,
        key,
        message: `Key "${key}" có trong ${sourceLang}.json nhưng thiếu trong ${targetLang}.json`
      });
    }
  }

  return errors;
}

/**
 * Kiểm tra values rỗng
 */
function findEmptyValues(
  translations: Record<string, string>,
  language: 'vi' | 'en'
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [key, value] of Object.entries(translations)) {
    if (!value || value.trim() === '') {
      errors.push({
        type: 'empty_value',
        language,
        key,
        message: `Key "${key}" có giá trị rỗng trong ${language}.json`
      });
    }
  }

  return errors;
}

/**
 * Kiểm tra duplicate keys (keys xuất hiện nhiều lần ở cùng level)
 * Note: Keys giống nhau ở nested level khác nhau là hợp lệ
 */
function findDuplicateKeys(
  filePath: string,
  language: 'vi' | 'en'
): ValidationError[] {
  const errors: ValidationError[] = [];

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);

    // Kiểm tra duplicate ở mỗi level
    function checkLevel(obj: any, path: string = '') {
      if (typeof obj !== 'object' || obj === null) return;

      const keys = Object.keys(obj);
      const seen = new Set<string>();

      for (const key of keys) {
        if (seen.has(key)) {
          const fullPath = path ? `${path}.${key}` : key;
          errors.push({
            type: 'duplicate_key',
            language,
            key: fullPath,
            message: `Duplicate key "${key}" at path "${path}" in ${language}.json`
          });
        }
        seen.add(key);

        // Recursively check nested objects
        const fullPath = path ? `${path}.${key}` : key;
        checkLevel(obj[key], fullPath);
      }
    }

    checkLevel(parsed);
  } catch (error) {
    // JSON parse error will be caught elsewhere
  }

  return errors;
}

/**
 * Kiểm tra interpolation placeholders có khớp không
 */
function findMismatchedPlaceholders(
  viTranslations: Record<string, string>,
  enTranslations: Record<string, string>
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const key of Object.keys(viTranslations)) {
    if (!enTranslations[key]) continue;

    const viPlaceholders = (viTranslations[key].match(/\{\{(\w+)\}\}/g) || [])
      .map(p => p.replace(/[{}]/g, ''))
      .sort();
    const enPlaceholders = (enTranslations[key].match(/\{\{(\w+)\}\}/g) || [])
      .map(p => p.replace(/[{}]/g, ''))
      .sort();

    if (viPlaceholders.join(',') !== enPlaceholders.join(',')) {
      errors.push({
        type: 'format_error',
        language: 'en',
        key,
        message: `Placeholders không khớp:\n  VI: ${viPlaceholders.join(', ') || '(none)'}\n  EN: ${enPlaceholders.join(', ') || '(none)'}`
      });
    }
  }

  return errors;
}

/**
 * In ra kết quả validation
 */
function printResults(errors: ValidationError[]) {
  if (errors.length === 0) {
    console.log('\n✅ Tất cả translations đều hợp lệ!\n');
    return;
  }

  console.log(`\n❌ Tìm thấy ${errors.length} lỗi:\n`);

  // Nhóm errors theo type
  const groupedErrors: Record<string, ValidationError[]> = {};
  for (const error of errors) {
    if (!groupedErrors[error.type]) {
      groupedErrors[error.type] = [];
    }
    groupedErrors[error.type].push(error);
  }

  // In ra từng nhóm
  const typeLabels = {
    missing_key: '🔍 Keys bị thiếu',
    empty_value: '📝 Values rỗng',
    duplicate_key: '🔄 Keys trùng lặp',
    format_error: '⚠️  Lỗi format'
  };

  for (const [type, typeErrors] of Object.entries(groupedErrors)) {
    console.log(`${typeLabels[type as keyof typeof typeLabels]} (${typeErrors.length}):`);
    console.log('─'.repeat(60));

    for (const error of typeErrors.slice(0, 10)) { // Chỉ show 10 đầu tiên
      console.log(`  [${error.language.toUpperCase()}] ${error.key}`);
      console.log(`      ${error.message}`);
      console.log();
    }

    if (typeErrors.length > 10) {
      console.log(`  ... và ${typeErrors.length - 10} lỗi khác\n`);
    }
  }

  console.log('─'.repeat(60));
  console.log(`Tổng cộng: ${errors.length} lỗi cần sửa\n`);
}

/**
 * Main function
 */
function main() {
  console.log('🔍 Đang validate translations...\n');

  // Load translations
  const viTranslations = loadTranslations(VI_PATH);
  const enTranslations = loadTranslations(EN_PATH);

  // Flatten keys
  const viFlat = flattenKeys(viTranslations);
  const enFlat = flattenKeys(enTranslations);

  const viKeys = new Set(Object.keys(viFlat));
  const enKeys = new Set(Object.keys(enFlat));

  console.log(`📊 Thống kê:`);
  console.log(`   VI keys: ${viKeys.size}`);
  console.log(`   EN keys: ${enKeys.size}`);
  console.log();

  // Chạy các validation checks
  const errors: ValidationError[] = [
    ...findMissingKeys(viKeys, enKeys, 'vi', 'en'),
    ...findMissingKeys(enKeys, viKeys, 'en', 'vi'),
    ...findEmptyValues(viFlat, 'vi'),
    ...findEmptyValues(enFlat, 'en'),
    ...findDuplicateKeys(VI_PATH, 'vi'),
    ...findDuplicateKeys(EN_PATH, 'en'),
    ...findMismatchedPlaceholders(viFlat, enFlat)
  ];

  // In kết quả
  printResults(errors);

  // Exit code
  process.exit(errors.length > 0 ? 1 : 0);
}

// Run
main();
