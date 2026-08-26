#!/usr/bin/env ts-node
/**
 * Script để tìm và convert hardcoded Vietnamese text sang i18n keys
 *
 * Tìm trong:
 * - Text components: <Text>Hardcoded text</Text>
 * - Text props: placeholder="...", label="...", title="..."
 * - Alert/Toast messages
 *
 * Chạy: npx ts-node scripts/find-hardcoded-text.ts
 * Chạy với auto-fix: npx ts-node scripts/find-hardcoded-text.ts --fix
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface HardcodedText {
  file: string;
  line: number;
  column: number;
  text: string;
  context: string;
  suggestedKey?: string;
}

const SRC_DIR = path.join(__dirname, '../src');
const AUTO_FIX = process.argv.includes('--fix');

// Patterns để detect Vietnamese text
const VIETNAMESE_CHARS = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i;

// Patterns để bỏ qua
const IGNORE_PATTERNS = [
  /^[0-9\s\-_.,!?:;()[\]{}]+$/, // Chỉ có số và ký tự đặc biệt
  /^[a-zA-Z0-9\s\-_.,!?:;()[\]{}]+$/, // Chỉ có chữ Latin (không phải tiếng Việt)
  /^https?:\/\//, // URLs
  /^\/api\//, // API endpoints
  /^\w+\.\w+$/, // Property access (e.g., user.name)
  /^console\./, // Console logs
  /^import\s/, // Import statements
  /^from\s/, // From statements
];

// Patterns để detect text trong code
const TEXT_PATTERNS = [
  // <Text>Vietnamese text</Text>
  {
    regex: /<Text[^>]*>([^<]+)<\/Text>/g,
    type: 'jsx-text'
  },
  // placeholder="Vietnamese text"
  {
    regex: /placeholder=["']([^"']+)["']/g,
    type: 'prop'
  },
  // label="Vietnamese text"
  {
    regex: /label=["']([^"']+)["']/g,
    type: 'prop'
  },
  // title="Vietnamese text"
  {
    regex: /title=["']([^"']+)["']/g,
    type: 'prop'
  },
  // Alert.alert("Vietnamese text", ...)
  {
    regex: /Alert\.alert\(["']([^"']+)["']/g,
    type: 'alert'
  },
  // accessibilityLabel="Vietnamese text"
  {
    regex: /accessibilityLabel=["']([^"']+)["']/g,
    type: 'prop'
  },
];

/**
 * Kiểm tra xem text có phải tiếng Việt không
 */
function isVietnameseText(text: string): boolean {
  // Bỏ qua nếu text quá ngắn
  if (text.trim().length < 2) return false;

  // Bỏ qua nếu match ignore patterns
  for (const pattern of IGNORE_PATTERNS) {
    if (pattern.test(text)) return false;
  }

  // Check có chứa ký tự tiếng Việt
  return VIETNAMESE_CHARS.test(text);
}

/**
 * Suggest translation key dựa vào text
 */
function suggestKey(text: string, filePath: string): string {
  // Lấy feature name từ path
  const pathParts = filePath.split(path.sep);
  const featureIndex = pathParts.indexOf('features');
  const feature = featureIndex >= 0 ? pathParts[featureIndex + 1] : 'common';

  // Convert text to camelCase key
  const normalized = text
    .toLowerCase()
    .replace(/[àáảãạăắằẳẵặâấầẩẫậ]/g, 'a')
    .replace(/[èéẻẽẹêếềểễệ]/g, 'e')
    .replace(/[ìíỉĩị]/g, 'i')
    .replace(/[òóỏõọôốồổỗộơớờởỡợ]/g, 'o')
    .replace(/[ùúủũụưứừửữự]/g, 'u')
    .replace(/[ỳýỷỹỵ]/g, 'y')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  const shortKey = normalized.split('_').slice(0, 3).join('_');

  return `${feature}.${shortKey}`;
}

/**
 * Tìm hardcoded text trong file
 */
function findHardcodedTextInFile(filePath: string): HardcodedText[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const results: HardcodedText[] = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];

    // Bỏ qua comments
    if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) {
      continue;
    }

    // Bỏ qua nếu đã dùng t() hoặc i18n
    if (line.includes('t(') || line.includes('i18n.t(') || line.includes('useTranslation')) {
      continue;
    }

    // Check từng pattern
    for (const pattern of TEXT_PATTERNS) {
      let match;
      while ((match = pattern.regex.exec(line)) !== null) {
        const text = match[1];

        if (isVietnameseText(text)) {
          const column = match.index;
          const context = line.trim();
          const suggestedKey = suggestKey(text, filePath);

          results.push({
            file: path.relative(SRC_DIR, filePath),
            line: lineIndex + 1,
            column,
            text,
            context,
            suggestedKey
          });
        }
      }
    }
  }

  return results;
}

/**
 * Scan tất cả files
 */
async function scanFiles(): Promise<HardcodedText[]> {
  const patterns = [
    'src/**/*.tsx',
    'src/**/*.ts',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}',
    '!src/locales/**',
  ];

  const files = await glob(patterns, { cwd: path.join(__dirname, '..') });
  const allResults: HardcodedText[] = [];

  console.log(`🔍 Đang quét ${files.length} files...\n`);

  for (const file of files) {
    const fullPath = path.join(__dirname, '..', file);
    const results = findHardcodedTextInFile(fullPath);
    allResults.push(...results);
  }

  return allResults;
}

/**
 * Group results theo file
 */
function groupByFile(results: HardcodedText[]): Map<string, HardcodedText[]> {
  const grouped = new Map<string, HardcodedText[]>();

  for (const result of results) {
    if (!grouped.has(result.file)) {
      grouped.set(result.file, []);
    }
    grouped.get(result.file)!.push(result);
  }

  return grouped;
}

/**
 * In ra kết quả
 */
function printResults(results: HardcodedText[]) {
  if (results.length === 0) {
    console.log('\n✅ Không tìm thấy hardcoded Vietnamese text!\n');
    return;
  }

  console.log(`\n📊 Tìm thấy ${results.length} hardcoded texts:\n`);

  const grouped = groupByFile(results);

  for (const [file, fileResults] of grouped) {
    console.log(`📄 ${file} (${fileResults.length} texts)`);
    console.log('─'.repeat(80));

    for (const result of fileResults.slice(0, 5)) { // Show 5 đầu tiên mỗi file
      console.log(`  Line ${result.line}:`);
      console.log(`    Text: "${result.text}"`);
      console.log(`    Context: ${result.context.substring(0, 70)}...`);
      console.log(`    Suggested key: ${result.suggestedKey}`);
      console.log();
    }

    if (fileResults.length > 5) {
      console.log(`  ... và ${fileResults.length - 5} texts khác\n`);
    }
  }

  console.log('─'.repeat(80));
  console.log(`\n💡 Gợi ý: Chạy với --fix để tự động tạo migration script\n`);
}

/**
 * Tạo migration suggestions
 */
function generateMigrationSuggestions(results: HardcodedText[]): string {
  const grouped = groupByFile(results);
  let output = '# Migration Suggestions\n\n';
  output += 'Dưới đây là các bước để migrate hardcoded text sang i18n:\n\n';

  for (const [file, fileResults] of grouped) {
    output += `## ${file}\n\n`;

    // Step 1: Add to translation files
    output += '### Bước 1: Thêm vào vi.json và en.json\n\n';
    output += '```json\n';
    for (const result of fileResults.slice(0, 10)) {
      output += `"${result.suggestedKey}": "${result.text}",\n`;
    }
    output += '```\n\n';

    // Step 2: Update component
    output += '### Bước 2: Update component\n\n';
    output += '```tsx\n';
    output += '// Thêm hook\n';
    output += 'const { t } = useTranslation();\n\n';

    for (const result of fileResults.slice(0, 5)) {
      output += `// Line ${result.line}:\n`;
      output += `// Before: "${result.text}"\n`;
      output += `// After: {t('${result.suggestedKey}')}\n\n`;
    }
    output += '```\n\n';
  }

  return output;
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Tìm kiếm hardcoded Vietnamese text...\n');

  const results = await scanFiles();
  printResults(results);

  if (AUTO_FIX && results.length > 0) {
    const suggestions = generateMigrationSuggestions(results);
    const outputPath = path.join(__dirname, '../MIGRATION_SUGGESTIONS.md');
    fs.writeFileSync(outputPath, suggestions, 'utf-8');
    console.log(`📝 Đã tạo file gợi ý migration: ${outputPath}\n`);
  }

  // Statistics
  if (results.length > 0) {
    const fileCount = new Set(results.map(r => r.file)).size;
    console.log(`📈 Tổng kết:`);
    console.log(`   ${results.length} hardcoded texts`);
    console.log(`   Trong ${fileCount} files`);
    console.log(`   Trung bình ${(results.length / fileCount).toFixed(1)} texts/file\n`);
  }
}

// Run
main().catch(console.error);
