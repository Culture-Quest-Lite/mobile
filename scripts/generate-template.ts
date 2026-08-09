#!/usr/bin/env ts-node
/**
 * Script để tạo translation template cho feature mới
 *
 * Chạy: npx ts-node scripts/generate-template.ts <feature-name>
 * Ví dụ: npx ts-node scripts/generate-template.ts checkout
 */

import * as fs from 'fs';
import * as path from 'path';

const LOCALES_DIR = path.join(__dirname, '../src/locales');

interface TemplateSection {
  [key: string]: string | TemplateSection;
}

/**
 * Template mặc định cho feature mới
 */
const DEFAULT_TEMPLATE: TemplateSection = {
  title: '',
  subtitle: '',
  description: '',
  button: {
    submit: '',
    cancel: '',
    confirm: '',
    back: '',
  },
  form: {
    label: {
      name: '',
      email: '',
      phone: '',
    },
    placeholder: {
      name: '',
      email: '',
      phone: '',
    },
    error: {
      required: '',
      invalid: '',
    },
  },
  message: {
    success: '',
    error: '',
    loading: '',
  },
  empty: {
    title: '',
    subtitle: '',
  },
};

/**
 * Convert camelCase/kebab-case to Title Case
 */
function toTitleCase(str: string): string {
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Tạo suggested translations
 */
function generateSuggestedTranslations(
  featureName: string,
  template: TemplateSection,
  language: 'vi' | 'en'
): TemplateSection {
  const result: TemplateSection = {};

  for (const [key, value] of Object.entries(template)) {
    if (typeof value === 'object') {
      result[key] = generateSuggestedTranslations(featureName, value, language);
    } else {
      // Generate suggested translation based on key
      const titleCased = toTitleCase(key);

      if (language === 'vi') {
        const viMap: Record<string, string> = {
          title: 'Tiêu đề',
          subtitle: 'Phụ đề',
          description: 'Mô tả',
          submit: 'Gửi',
          cancel: 'Hủy',
          confirm: 'Xác nhận',
          back: 'Quay lại',
          name: 'Tên',
          email: 'Email',
          phone: 'Số điện thoại',
          required: 'Trường này là bắt buộc',
          invalid: 'Giá trị không hợp lệ',
          success: 'Thành công',
          error: 'Đã xảy ra lỗi',
          loading: 'Đang tải...',
        };
        result[key] = viMap[key] || `[VI] ${titleCased}`;
      } else {
        result[key] = titleCased;
      }
    }
  }

  return result;
}

/**
 * Format JSON với comments
 */
function formatJsonWithComments(
  obj: TemplateSection,
  indent: number = 2,
  currentIndent: number = 0
): string {
  const space = ' '.repeat(currentIndent);
  const nextSpace = ' '.repeat(currentIndent + indent);
  let result = '{\n';

  const entries = Object.entries(obj);

  for (let i = 0; i < entries.length; i++) {
    const [key, value] = entries[i];
    const isLast = i === entries.length - 1;

    if (typeof value === 'object') {
      result += `${nextSpace}"${key}": ${formatJsonWithComments(value, indent, currentIndent + indent)}`;
    } else {
      result += `${nextSpace}"${key}": "${value}"`;
    }

    result += isLast ? '\n' : ',\n';
  }

  result += `${space}}`;
  return result;
}

/**
 * Kiểm tra xem feature đã tồn tại chưa
 */
function checkFeatureExists(featureName: string): { vi: boolean; en: boolean } {
  const viPath = path.join(LOCALES_DIR, 'vi.json');
  const enPath = path.join(LOCALES_DIR, 'en.json');

  let viExists = false;
  let enExists = false;

  try {
    const viContent = JSON.parse(fs.readFileSync(viPath, 'utf-8'));
    viExists = featureName in viContent;
  } catch (error) {
    // File không tồn tại hoặc parse lỗi
  }

  try {
    const enContent = JSON.parse(fs.readFileSync(enPath, 'utf-8'));
    enExists = featureName in enContent;
  } catch (error) {
    // File không tồn tại hoặc parse lỗi
  }

  return { vi: viExists, en: enExists };
}

/**
 * Main function
 */
function main() {
  const featureName = process.argv[2];

  if (!featureName) {
    console.error('❌ Thiếu tên feature!');
    console.error('');
    console.error('Cách dùng:');
    console.error('  npx ts-node scripts/generate-template.ts <feature-name>');
    console.error('');
    console.error('Ví dụ:');
    console.error('  npx ts-node scripts/generate-template.ts checkout');
    console.error('  npx ts-node scripts/generate-template.ts payment');
    process.exit(1);
  }

  // Validate feature name
  if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(featureName)) {
    console.error('❌ Tên feature không hợp lệ!');
    console.error('Tên feature phải bắt đầu bằng chữ cái và chỉ chứa chữ cái, số.');
    console.error('');
    console.error('Hợp lệ: checkout, myFeature, payment2');
    console.error('Không hợp lệ: 2checkout, my-feature, check_out');
    process.exit(1);
  }

  console.log(`🎨 Tạo template cho feature: ${featureName}\n`);

  // Check if exists
  const exists = checkFeatureExists(featureName);

  if (exists.vi || exists.en) {
    console.warn('⚠️  Cảnh báo: Feature đã tồn tại!');
    if (exists.vi) console.warn('   - Đã có trong vi.json');
    if (exists.en) console.warn('   - Đã có trong en.json');
    console.warn('');
    console.warn('Template sẽ được tạo ở dạng suggestion, bạn cần merge thủ công.\n');
  }

  // Generate templates
  const viTemplate = generateSuggestedTranslations(featureName, DEFAULT_TEMPLATE, 'vi');
  const enTemplate = generateSuggestedTranslations(featureName, DEFAULT_TEMPLATE, 'en');

  // Format output
  const viJson = formatJsonWithComments({ [featureName]: viTemplate });
  const enJson = formatJsonWithComments({ [featureName]: enTemplate });

  // Print results
  console.log('📝 Template cho vi.json:');
  console.log('─'.repeat(80));
  console.log(viJson);
  console.log('');

  console.log('📝 Template cho en.json:');
  console.log('─'.repeat(80));
  console.log(enJson);
  console.log('');

  // Save to files
  const outputDir = path.join(__dirname, '../generated-templates');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const viOutputPath = path.join(outputDir, `${featureName}.vi.json`);
  const enOutputPath = path.join(outputDir, `${featureName}.en.json`);

  fs.writeFileSync(viOutputPath, viJson, 'utf-8');
  fs.writeFileSync(enOutputPath, enJson, 'utf-8');

  console.log('💾 Đã lưu templates:');
  console.log(`   ${path.relative(process.cwd(), viOutputPath)}`);
  console.log(`   ${path.relative(process.cwd(), enOutputPath)}`);
  console.log('');

  // Instructions
  console.log('📋 Bước tiếp theo:');
  console.log('');
  console.log('1. Review và chỉnh sửa templates trong thư mục generated-templates/');
  console.log('');
  console.log('2. Copy nội dung vào src/locales/vi.json:');
  console.log(`   - Mở ${viOutputPath}`);
  console.log('   - Copy nội dung vào vi.json (chú ý format và vị trí)');
  console.log('');
  console.log('3. Copy nội dung vào src/locales/en.json:');
  console.log(`   - Mở ${enOutputPath}`);
  console.log('   - Copy nội dung vào en.json');
  console.log('');
  console.log('4. Validate:');
  console.log('   npm run i18n:validate');
  console.log('');
  console.log('5. Sử dụng trong code:');
  console.log('   const { t } = useTranslation();');
  console.log(`   <Text>{t('${featureName}.title')}</Text>`);
  console.log('');

  console.log('✨ Hoàn thành!\n');
}

// Run
main();
