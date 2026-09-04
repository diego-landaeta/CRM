import js from '@eslint/js';
import globals from 'globals';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'coverage/**',
      'public/**',
      'scripts/**',
      'dev-dist/**',
      '*.config.js',
      'src/test/**',
      'e2e/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    settings: {
      react: { version: '18.3' },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'jsx-a11y': jsxA11yPlugin,
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      // React
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs['jsx-runtime'].rules,
      'react/prop-types': 'off',
      'react/no-unescaped-entities': 'off',
      'react/display-name': 'off',

      // Hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // a11y — solo lo importante, sin ahogar al equipo
      'jsx-a11y/alt-text': 'warn',
      'jsx-a11y/anchor-has-content': 'warn',
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-proptypes': 'error',
      'jsx-a11y/aria-role': 'error',
      'jsx-a11y/role-has-required-aria-props': 'error',
      'jsx-a11y/no-redundant-roles': 'warn',

      // TS — apagado el más ruidoso porque strict no está activo aún
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-unused-vars': 'off', // TS-aware version arriba

      // JS general
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-undef': 'off', // en .ts/.tsx lo cubre TypeScript; ver el bloque de abajo
      'no-prototype-builtins': 'warn',
      'no-useless-escape': 'warn',
      'no-irregular-whitespace': 'warn',
    },
  },

  // ── El agujero de los .js y .jsx ────────────────────────────────────────────
  //
  // `no-undef` estaba apagado para todo con el motivo «TS lo cubre». Y lo cubre,
  // pero SOLO en .ts y .tsx: los .jsx no los mira nadie. Entre ellos estan
  // App.jsx, AppLayout.jsx y Sidebar.jsx, o sea lo que se monta en todas las
  // pantallas.
  //
  // El 21/08/2026 se subio un `moduloApagado(...)` sin su import en Sidebar.jsx.
  // Pasó lint, pasó typecheck, pasó el build, y tumbó el CRM entero al abrirlo:
  // «moduloApagado is not defined» en la pantalla de error, y nada mas. Una
  // variable mal escrita en uno de esos ficheros llega a produccion.
  //
  // Aqui se enciende solo para .js y .jsx, que es donde no hay nada mas que
  // mire. En .ts/.tsx sigue apagado, porque ahi si duplicaria a TypeScript y
  // ademas se confunde con los tipos globales.
  {
    files: ['**/*.js', '**/*.jsx'],
    rules: {
      'no-undef': 'error',
    },
  },
];
