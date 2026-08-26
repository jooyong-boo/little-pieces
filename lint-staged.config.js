const path = require('node:path');

// eslint.config.js / tsconfig.json / .prettierignore inside apps/mobile all
// resolve relative to process.cwd(), not to the linted file's location. Husky
// runs from the repo root, so eslint needs to actually run with apps/mobile
// as its cwd to find its own config and resolve `@/*` imports.
const MOBILE_ROOT = path.join(__dirname, 'apps/mobile');

module.exports = {
  'apps/mobile/**/*.{ts,tsx,js}': (files) => {
    const relativeFiles = files.map((file) => path.relative(MOBILE_ROOT, file));
    return [
      `sh -c 'cd "${MOBILE_ROOT}" && eslint --fix ${relativeFiles.map((f) => `"${f}"`).join(' ')}'`,
      `prettier --write ${files.map((f) => `"${f}"`).join(' ')}`,
    ];
  },
  'scripts/*.js': ['prettier --write'],
  'commitlint.config.js': ['prettier --write'],
  '*.{json,md,yml,yaml}': ['prettier --write'],
  'apps/api/**/*.rs': ['cargo fmt --manifest-path apps/api/Cargo.toml --'],
};
