const fs = require('fs');
const path = require('path');

const root = process.cwd();

const patches = [
  {
    file: path.join(root, 'node_modules', 'react-native-css-interop', 'src', 'runtime', 'components.ts'),
    replacements: [
      {
        from: '  Pressable,\n  SafeAreaView,\n  ScrollView,\n',
        to: '  Pressable,\n  ScrollView,\n',
      },
      {
        from: 'cssInterop(Pressable, { className: "style" });\ncssInterop(SafeAreaView, { className: "style" });\ncssInterop(Switch, { className: "style" });\n',
        to: 'cssInterop(Pressable, { className: "style" });\ncssInterop(Switch, { className: "style" });\n',
      },
    ],
  },
  {
    file: path.join(root, 'node_modules', 'react-native-css-interop', 'dist', 'runtime', 'components.js'),
    replacements: [
      {
        from: '(0, api_1.cssInterop)(react_native_1.Pressable, { className: "style" });\n(0, api_1.cssInterop)(react_native_1.SafeAreaView, { className: "style" });\n(0, api_1.cssInterop)(react_native_1.Switch, { className: "style" });\n',
        to: '(0, api_1.cssInterop)(react_native_1.Pressable, { className: "style" });\n(0, api_1.cssInterop)(react_native_1.Switch, { className: "style" });\n',
      },
    ],
  },
  {
    file: path.join(root, 'node_modules', '@react-native', 'gradle-plugin', 'settings.gradle.kts'),
    replacements: [
      {
        from: 'plugins { id("org.gradle.toolchains.foojay-resolver-convention").version("0.5.0") }\n',
        to: 'plugins { id("org.gradle.toolchains.foojay-resolver-convention").version("1.0.0") }\n',
      },
    ],
  },
];

for (const patch of patches) {
  if (!fs.existsSync(patch.file)) {
    continue;
  }

  const original = fs.readFileSync(patch.file, 'utf8');
  let updated = original;

  for (const replacement of patch.replacements) {
    updated = updated.replace(replacement.from, replacement.to);
  }

  if (updated !== original) {
    fs.writeFileSync(patch.file, updated, 'utf8');
    console.log(`patched ${path.relative(root, patch.file)}`);
  }
}
