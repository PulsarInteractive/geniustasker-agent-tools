import js from '@eslint/js';
import globals from 'globals';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  { ignores: ['node_modules/**', 'coverage/**', 'src/command-catalog.mjs'] },
  {
    files: ['**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
    rules: {
      curly: ['error', 'all'],
      eqeqeq: ['error', 'always'],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    },
  },
]);
